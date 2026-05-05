/**
 * POST /api/pipeline/run
 * Automated QA report pipeline
 *
 * Accepts: {weekOffset: 0}
 * Returns: {ok: boolean, period: string, files: string[]}
 */

export const maxDuration = 300; // 5 minutes for processing
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
// Storage: Supabase (Vercel Blob removed)
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { createClient } from '@supabase/supabase-js';

import { fetchAllChatRecordsForPeriod, fetchConversationDetail } from '../wellytalk-client';
import {
  classifyTicket,
  getPrimaryAgent,
  parseTicketFromWellyDetail,
  computeAggregates,
  computePerAgent,
  computeInquiryCategories,
  sampleTicketsForAgent,
  trimContent,
  hashCode,
} from '../parser';
import { Ticket, PipelineReport, WellyChat } from '../types';
import { SYSTEM_PROMPT, getAgentDisplayName } from '../reference-data';

const MAX_GRADED = 150; // Increased from 30
const BATCH_SIZE = 5; // Grade 5 at a time
const BATCH_DELAY_MS = 300; // 300ms pause between batches

function getPeriodLabel(startDate: Date, endDate: Date): string {
  const fmt = (d: Date) => {
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${month}-${day}`;
  };
  return `${fmt(startDate)} to ${fmt(endDate)}, ${endDate.getUTCFullYear()}`;
}

/** Sanitise a string so it's safe to embed in a docx TextRun */
function safe(s: unknown): string {
  if (s === null || s === undefined) return '';
  return String(s)
    // strip null-bytes and other control chars that trip Word's validator
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

/** Build a bold heading paragraph */
function heading(text: string, size = 32): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: safe(text), bold: true, size })],
    spacing: { before: 300, after: 120 },
  });
}

/** Build a plain body paragraph — splits on \n to avoid embedded newlines */
function body(text: string): Paragraph[] {
  return safe(text)
    .split('\n')
    .map(
      line =>
        new Paragraph({
          children: [new TextRun({ text: line || ' ' })],
          spacing: { after: 80 },
        })
    );
}

/** Key-value row */
function kv(label: string, value: unknown): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${safe(label)}: `, bold: true }),
      new TextRun({ text: safe(String(value ?? '—')) }),
    ],
    spacing: { after: 80 },
  });
}

/** Build a QA Report docx from structured report data */
function buildQAReportDocx(periodLabel: string, report: PipelineReport, gradedCount: number): Promise<Buffer> {
  const agg = report.team_aggregates;
  const totalClosed = Math.round((agg.closure_pct / 100) * agg.total_tickets);
  const children: Paragraph[] = [
    heading(`QA Report — ${periodLabel}`, 48),
    kv('Generated', new Date().toUTCString()),
    new Paragraph({ children: [] }),

    heading('Team Summary'),
    kv('Total Tickets', agg.total_tickets),
    kv('Closed', totalClosed),
    kv('Closure Rate', `${agg.closure_pct.toFixed(1)}%`),
    kv('Avg First Response Time', `${(agg.avg_frt_seconds / 60).toFixed(1)} min`),
    kv('Slow FRT Rate', `${agg.slow_frt_pct.toFixed(1)}%`),
    kv('Bot Abandoned Rate', `${agg.bot_abandoned_pct.toFixed(1)}%`),
    kv('Tickets Graded This Run', gradedCount),
    new Paragraph({ children: [] }),

    heading('Per-Agent Breakdown'),
    ...report.per_agent_stats.flatMap(a => [
      kv('Agent', a.agent),
      kv('  Total Tickets', a.total),
      kv('  Closed', a.closed),
      kv('  Closure Rate', `${a.closure_pct.toFixed(1)}%`),
      kv('  Recalls', a.recalls),
      kv('  Avg FRT', a.avg_frt_seconds != null ? `${(a.avg_frt_seconds / 60).toFixed(1)} min` : 'N/A'),
      new Paragraph({ children: [] }),
    ]),

    heading('Inquiry Category Breakdown'),
    ...report.inquiry_categories.map(ic =>
      kv(ic.name, `${ic.count} tickets (${ic.pct_of_total.toFixed(1)}%)`)
    ),
  ];

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

/** Build an Inquiry Report docx */
function buildInquiryReportDocx(periodLabel: string, report: PipelineReport): Promise<Buffer> {
  const children: Paragraph[] = [
    heading(`Inquiry Report — ${periodLabel}`, 48),
    kv('Generated', new Date().toUTCString()),
    new Paragraph({ children: [] }),

    heading('Category Breakdown'),
    ...report.inquiry_categories.map(ic =>
      kv(ic.name, `${ic.count} tickets (${ic.pct_of_total.toFixed(1)}%)`)
    ),
    new Paragraph({ children: [] }),

    heading('Sample Tickets by Agent'),
    ...Object.entries(report.sampled_tickets).flatMap(([agent, tickets]) => [
      heading(`Agent: ${agent}`, 28),
      ...tickets.flatMap(t => [
        kv('  Category', t.category),
        kv('  Closed', t.is_closed ? 'Yes' : 'No'),
        kv('  Has Recall', t.has_recall ? 'Yes' : 'No'),
        kv('  Grade', t.grade ?? 'Ungraded'),
        new Paragraph({ children: [] }),
      ]),
    ]),
  ];

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

/** Build an Agent Performance Report docx */
function buildAgentReportDocx(periodLabel: string, report: PipelineReport): Promise<Buffer> {
  const children: Paragraph[] = [
    heading(`Agent Performance Report — ${periodLabel}`, 48),
    kv('Generated', new Date().toUTCString()),
    new Paragraph({ children: [] }),
  ];

  for (const a of report.per_agent_stats) {
    children.push(
      heading(`${a.agent}`, 32),
      kv('Total Tickets', a.total),
      kv('Closed', a.closed),
      kv('Closure Rate', `${a.closure_pct.toFixed(1)}%`),
      kv('Recalls', a.recalls),
      kv('Avg FRT', a.avg_frt_seconds != null ? `${(a.avg_frt_seconds / 60).toFixed(1)} min` : 'N/A'),
    );

    // Include graded samples
    const samples = report.sampled_tickets[a.agent] || [];
    const graded = samples.filter(t => t.grade);
    if (graded.length) {
      children.push(heading('Graded Samples', 26));
      for (const t of graded) {
        children.push(
          kv('  Grade', `${t.grade} (${t.score ?? '—'})`),
          kv('  Category', t.category),
          kv('  Auto-Fail', t.auto_fail ? `YES — ${(t as any).auto_fail_reason || 'see scorecard'}` : 'No'),
          kv('  Coaching Tip', t.coaching_tip || '—'),
          new Paragraph({ children: [] }),
        );
      }
    }
    children.push(new Paragraph({ children: [] }));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

// Priority-based ticket selection for grading
function selectTicketsToGrade(tickets: Ticket[], maxToGrade: number): Ticket[] {
  const alreadyGraded = new Set(tickets.filter(t => t.grade).map(t => t.id));
  const ungraded = tickets.filter(t => !alreadyGraded.has(t.id) && t.welly_conversation_id);
  
  const recalls = ungraded.filter(t => t.has_recall);
  const slowFrt = ungraded.filter(t => !recalls.includes(t) && (t.frt_seconds || 0) > 300);
  const unresolved = ungraded.filter(t => !recalls.includes(t) && !slowFrt.includes(t) && !t.is_closed);
  const rest = ungraded.filter(t => !recalls.includes(t) && !slowFrt.includes(t) && t.is_closed);
  
  // Shuffle rest for random sampling (Fisher-Yates)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  
  return [...recalls, ...slowFrt, ...unresolved, ...rest].slice(0, maxToGrade);
}

// ─── JackpotDaily-specific grading system prompt ─────────────────────────────
const TICKET_GRADING_SYSTEM = `You are a QA analyst for JackpotDaily, a US sweepstakes/social casino platform.
You grade individual customer support chat transcripts against JackpotDaily-specific standards.

## PLATFORM FACTS (source of truth — any agent statement contradicting these is a factual error)
- Redemption max: $2,500 per transaction/day (NOT $1,000 or $5,000)
- Redemption minimum play-through: 100 SC (NOT 1,000 SC)
- Debit card timeline: 1-3 business days (NOT 24-48 hours)
- ACH/bank transfer: up to 10 business days (NOT 3-5 days)
- Daily login bonus: FREE, no purchase required (agents commonly and incorrectly say it requires $10+ purchase)
- Referral threshold: $30 cumulative qualifying purchases (NOT $70)
- Welcome bonus: 2 SC + 100,000 GC + Golden Egg (up to 100 SC) — NOT "$25-30 cash"
- W-9 required for $600+ lifetime redemptions
- Weekend processing: NO (redemptions not processed Sat/Sun)
- KYC timeline: minutes to ~1 hour (NOT 10 days)
- GC (Gold Coins) = free play only, NOT redeemable for cash
- SC (Sweepstakes Coins) = redeemable after 100 SC play-through

## AUTO-FAIL CONDITIONS (any ONE triggers grade F, score 0-44)
1. FACTUAL ERROR: Agent stated wrong policy value (wrong dollar amount, wrong timeline, wrong play-through)
2. FABRICATED OUTAGE: Agent claimed "high volume of requests," "technical issues," or "system maintenance" to cover going idle — without a confirmed real outage
3. QUESTION-THEN-CLOSE: Agent asked a diagnostic question then immediately said farewell and closed WITHOUT waiting for the client reply
4. ZERO RESPONSE: Client sent one or more messages, agent never replied
5. WRONG HARM FAREWELL: Client mentioned addiction/problem gambling and agent closed with "Hope you enjoy your games" instead of care-focused farewell + helpline 1-800-522-4700
6. PII REQUEST: Agent shared or requested credit card numbers, full SSN, bank routing numbers, or passwords

## SCORING RUBRIC
- 90-100 (A): Accurate policy, resolved issue, proper greeting/farewell, fast response, proactive
- 75-89 (B): Mostly correct, minor style issue, resolved but slightly rough
- 60-74 (C): Partial resolution, process issue, or minor factual imprecision (not auto-fail level)
- 45-59 (D): Did not resolve, significant process failure, or multiple minor issues
- 0-44 (F): Auto-fail triggered OR complete failure to handle the issue

## EVALUATION CHECKLIST
1. Greeting: Did agent greet warmly? (deduct for "Dear Player" or cold opener)
2. Policy accuracy: Cross-check every factual claim against Platform Facts above
3. Resolution: Did agent actually solve the issue or just close it?
4. Farewell: Appropriate tone? Harm-related closure handled correctly?
5. Response speed: Any indication of long delays before first reply?
6. Language: Approved scripts vs fabricated explanations?

## IMPORTANT: ALIASES ARE APPROVED POLICY
Agents operate under company-assigned chat names. Never flag an agent for using their assigned chat alias.

Respond ONLY with valid JSON. No markdown, no preamble, no extra text.`;

// Grade a single ticket using JackpotDaily-specific QA criteria
async function gradeTicket(ticket: Ticket, messages: Array<{content?: string}>): Promise<{
  score: number;
  grade: string;
  auto_fail: boolean;
  auto_fail_reason: string | null;
  coaching_tip: string;
  strengths: string[];
  issues: string[];
}> {
  const conversation = messages.map(m => m.content || '').join('\n');
  const agentName = ticket.primary_agent || 'Unknown Agent';
  const prompt = `Grade this JackpotDaily customer support chat transcript.

Agent: ${agentName}
Category: ${ticket.category || 'Unknown'}
Ticket ID: ${ticket.id}
Closed by agent: ${ticket.is_closed ? 'Yes' : 'No'}
Has recall: ${ticket.has_recall ? 'Yes' : 'No'}
FRT seconds: ${ticket.frt_seconds ?? 'Unknown'}

--- TRANSCRIPT ---
${conversation.slice(0, 4500)}
--- END TRANSCRIPT ---

Check auto-fail conditions first. If ANY auto-fail condition applies, set score<=44, grade="F", auto_fail=true.
Return ONLY this JSON (no markdown):
{
  "score": <integer 0-100>,
  "grade": <"A"|"B"|"C"|"D"|"F">,
  "auto_fail": <true|false>,
  "auto_fail_reason": <null or exact quote/description of the violation>,
  "coaching_tip": <one specific actionable sentence with exact language the agent should use>,
  "strengths": [<1-3 specific observations, or []>],
  "issues": [<1-3 specific issues, or []>]
}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4-5',
        messages: [
          { role: 'system', content: TICKET_GRADING_SYSTEM },
          { role: 'user', content: prompt },
        ],
        temperature: 0.5,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error(`[Grading] OpenRouter error: ${response.status}`);
      throw new Error(`OpenRouter returned ${response.status}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices[0]?.message?.content || '{}';
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return {
      score: parsed.score || 50,
      grade: parsed.grade || 'C',
      auto_fail: parsed.auto_fail || false,
      auto_fail_reason: parsed.auto_fail_reason || null,
      coaching_tip: parsed.coaching_tip || 'See agent for feedback',
      strengths: parsed.strengths || [],
      issues: parsed.issues || [],
    };
  } catch (e) {
    console.error(`[Grading] Error grading ticket ${ticket.id}:`, e);
    // Return default on error
    return {
      score: 50,
      grade: 'C',
      auto_fail: false,
      auto_fail_reason: null,
      coaching_tip: 'Unable to grade due to processing error',
      strengths: [],
      issues: [],
    };
  }
}

async function callLLMAnalysis(data: PipelineReport): Promise<{
  qa_report: Record<string, unknown>;
  inquiry_report: Record<string, unknown>;
  agent_report: Record<string, unknown>;
}> {
  // For now, return a stub response. In production, this would call OpenRouter.
  // Since we're building the pipeline structure, the LLM integration can be added later.
  return {
    qa_report: {
      period_label: data.period_label,
      critical_flags: [],
      recommendations: [],
    },
    inquiry_report: {
      category_breakdown: data.inquiry_categories,
      top_deep_dives: [],
    },
    agent_report: {
      agents: data.per_agent_stats.map(s => ({
        agent: s.agent,
        total: s.total,
        closed: s.closed,
        closure_pct: s.closure_pct,
      })),
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const weekOffset = body.weekOffset || 0;

    // Calculate period: last 7 days (or N weeks back if offset)
    const today = new Date();
    const startDate = new Date(today);
    startDate.setUTCDate(today.getUTCDate() - weekOffset * 7);
    startDate.setUTCHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + 6);
    endDate.setUTCHours(23, 59, 59, 999);

    const fromDate = Math.floor(startDate.getTime() / 1000);
    const toDate = Math.floor(endDate.getTime() / 1000);
    const periodLabel = getPeriodLabel(startDate, endDate);

    console.log(`[Pipeline] Starting run for period: ${periodLabel} (${fromDate} - ${toDate})`);

    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // 1. Fetch all chats from WellyTalk
    console.log('[Pipeline] Fetching chat records...');
    const chats = await fetchAllChatRecordsForPeriod(fromDate, toDate);
    console.log(`[Pipeline] Fetched ${chats.length} chats`);

    // 2. Parse each chat into a ticket
    console.log('[Pipeline] Parsing tickets...');
    const tickets: Ticket[] = [];
    let skipped = 0;

    for (const chat of chats) {
      try {
        // Fetch full conversation details
        const detail = await fetchConversationDetail(chat.conversation_id);

        if (detail.code !== 0 || !detail.data) {
          skipped++;
          continue;
        }

        const agents = (chat.participants || [])
          .filter(p => p.source_type === 'INTERNAL')
          .map(p => p.source_user_id || p.name);

        const visitorParticipant = (chat.participants || []).find(p => p.source_type === 'CLIENT_USER');
        const visitorName = visitorParticipant?.name || 'Unknown visitor';

        // Build content from messages
        const messages = detail.data.messages || [];
        const content = messages.map(m => m.content || '').join('\n');

        const ticket = parseTicketFromWellyDetail(
          chat.conversation_id,
          agents,
          chat.created_at > 1e12 ? new Date(chat.created_at).toISOString() : new Date(chat.created_at * 1000).toISOString(),
          chat.first_response_time || null,
          messages,
          visitorName
        );

        // Store messages for later grading
        (ticket as any).welly_messages = messages;

        tickets.push(ticket);
      } catch (e) {
        console.warn(`Failed to parse ticket ${chat.conversation_id}:`, e);
        skipped++;
      }
    }

    console.log(`[Pipeline] Parsed ${tickets.length} tickets, skipped ${skipped}`);

    // 3. GRADING: Select tickets to grade using smart priority sampling
    console.log('[Pipeline] Starting smart priority grading...');
    const ticketsToGrade = selectTicketsToGrade(tickets, MAX_GRADED);
    console.log(`[Pipeline] Selected ${ticketsToGrade.length} tickets for grading`);

    let gradedCount = 0;
    let gradeFailures = 0;

    // Grade in batches
    for (let i = 0; i < ticketsToGrade.length; i += BATCH_SIZE) {
      const batch = ticketsToGrade.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(ticketsToGrade.length / BATCH_SIZE);

      console.log(`[Pipeline] Grading batch ${batchNum}/${totalBatches} (${batch.length} tickets)...`);

      const gradePromises = batch.map(async ticket => {
        try {
          const messages = (ticket as any).welly_messages || [];
          const grading = await gradeTicket(ticket, messages);

          // Store grade in Supabase
          const { error } = await supabase
            .from('pipeline_tickets')
            .upsert(
              {
                welly_conversation_id: ticket.welly_conversation_id,
                week_start: startDate.toISOString(),
                score: grading.score,
                grade: grading.grade,
                auto_fail: grading.auto_fail,
                auto_fail_reason: grading.auto_fail_reason,
                coaching_tip: grading.coaching_tip,
                strengths: grading.strengths,
                issues: grading.issues,
                transcript: messages.map((m: any) => m.content).join('\n').slice(0, 10000),
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'welly_conversation_id' }
            );

          if (error) {
            console.error(`[Grading] Failed to store grade for ${ticket.id}:`, error);
            gradeFailures++;
          } else {
            gradedCount++;
            console.log(`[Grading] Graded ${ticket.id}: ${grading.grade} (${grading.score})`);
          }
        } catch (e) {
          console.error(`[Grading] Error processing ticket ${ticket.id}:`, e);
          gradeFailures++;
        }
      });

      await Promise.all(gradePromises);

      // Delay between batches
      if (i + BATCH_SIZE < ticketsToGrade.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    console.log(`[Pipeline] Grading complete: ${gradedCount} graded, ${gradeFailures} failed`);

    // 4. Compute aggregates
    const teamAggregates = computeAggregates(tickets);
    const perAgentStats = computePerAgent(tickets);
    const inquiryCategories = computeInquiryCategories(tickets);

    // 5. Sample tickets per agent
    const sampledTickets: Record<string, Ticket[]> = {};
    for (const agent of perAgentStats) {
      sampledTickets[agent.agent] = sampleTicketsForAgent(tickets, agent.agent, 7);
    }

    // 6. Build report data
    const report: PipelineReport = {
      period_label: periodLabel,
      period_start: startDate.toISOString(),
      period_end: endDate.toISOString(),
      generated_at: new Date().toISOString(),
      team_aggregates: teamAggregates,
      per_agent_stats: perAgentStats,
      inquiry_categories: inquiryCategories,
      sampled_tickets: sampledTickets,
    };

    // 7. LLM analysis stub — reserved for future deep analysis; not used for docx generation
    console.log('[Pipeline] Skipping stub LLM analysis...');
    void callLLMAnalysis; // suppress unused warning

    // 8. Generate docx reports — structured content, no raw JSON
    console.log('[Pipeline] Generating reports...');
    const qaReportBuffer = await buildQAReportDocx(periodLabel, report, gradedCount);
    const inquiryReportBuffer = await buildInquiryReportDocx(periodLabel, report);
    const agentReportBuffer = await buildAgentReportDocx(periodLabel, report);

    // 9. Upload to Supabase Storage
    console.log('[Pipeline] Uploading reports to Supabase Storage...');
    const timestamp = Date.now();
    const periodKey = periodLabel.replace(/[\s,]/g, '_');

    const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    const uploadFile = async (path: string, buffer: Buffer) => {
      // Convert Node Buffer → Blob. Must copy the underlying ArrayBuffer correctly
      // (Buffer may have byteOffset so we slice to get the exact bytes)
      const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
      const blob = new Blob([ab], { type: DOCX_MIME });
      const { error } = await supabase.storage
        .from('qa-reports')
        .upload(path, blob, {
          contentType: DOCX_MIME,
          upsert: true,
        });
      if (error) throw new Error(`Upload failed for ${path}: ${error.message}`);
      return path;
    };

    const qaPath = await uploadFile(`${periodKey}/qa_report_${timestamp}.docx`, qaReportBuffer);
    const inquiryPath = await uploadFile(`${periodKey}/inquiry_report_${timestamp}.docx`, inquiryReportBuffer);
    const agentPath = await uploadFile(`${periodKey}/agent_report_${timestamp}.docx`, agentReportBuffer);

    console.log('[Pipeline] Uploaded:', qaPath, inquiryPath, agentPath);

    // 10. Upsert pipeline_runs row
    const storagePaths = {
      qa_report: qaPath,
      inquiry_report: inquiryPath,
      agent_report: agentPath,
    };

    const { error: upsertErr } = await supabase
      .from('pipeline_runs')
      .upsert(
        {
          period_label: periodLabel,
          period_start: startDate.toISOString(),
          period_end: endDate.toISOString(),
          status: 'completed',
          completed_at: new Date().toISOString(),
          total_tickets: teamAggregates.total_tickets,
          agent_count: perAgentStats.length,
          storage_paths: storagePaths,
          grading_summary: {
            tickets_graded: gradedCount,
            tickets_failed: gradeFailures,
            total_selected: ticketsToGrade.length,
          },
        },
        { onConflict: 'period_label' }
      );

    if (upsertErr) {
      console.error('[Pipeline] Failed to update pipeline_runs:', upsertErr);
    }

    console.log('[Pipeline] Complete');

    return NextResponse.json({
      ok: true,
      period: periodLabel,
      files: [qaPath, inquiryPath, agentPath],
      grading: {
        tickets_graded: gradedCount,
        tickets_failed: gradeFailures,
        total_selected: ticketsToGrade.length,
      },
      metrics: {
        total_tickets: teamAggregates.total_tickets,
        avg_frt_seconds: teamAggregates.avg_frt_seconds.toFixed(1),
        closure_pct: teamAggregates.closure_pct.toFixed(1),
      },
    });
  } catch (err) {
    console.error('[Pipeline] Error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: String(err),
      },
      { status: 500 }
    );
  }
}
