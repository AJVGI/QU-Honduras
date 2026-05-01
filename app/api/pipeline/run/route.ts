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
import { put } from '@vercel/blob';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType } from 'docx';

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
import { Ticket, PipelineReport, ReportIndex, WellyChat } from '../types';
import { SYSTEM_PROMPT, getAgentDisplayName } from '../reference-data';

function getMondayUTC(date: Date): number {
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  const monday = new Date(date.setUTCDate(diff));
  monday.setUTCHours(0, 0, 0, 0);
  return Math.floor(monday.getTime() / 1000);
}

function getSundayUTC(date: Date): number {
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? 0 : 7);
  const sunday = new Date(date.setUTCDate(diff));
  sunday.setUTCHours(23, 59, 59, 999);
  return Math.floor(sunday.getTime() / 1000);
}

function getPeriodLabel(startDate: Date, endDate: Date): string {
  const fmt = (d: Date) => {
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${month}-${day}`;
  };
  return `${fmt(startDate)} to ${fmt(endDate)}, ${endDate.getUTCFullYear()}`;
}

function createSimpleDocx(title: string, content: string): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: title,
            heading: 'Heading1',
            bold: true,
            fontSize: 28,
          }),
          new Paragraph({
            text: `Generated: ${new Date().toISOString()}`,
            italics: true,
            spacing: { after: 400 },
          }),
          ...content.split('\n').map(line =>
            new Paragraph({
              text: line || ' ',
              spacing: { after: 100 },
            })
          ),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
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

        tickets.push(ticket);
      } catch (e) {
        console.warn(`Failed to parse ticket ${chat.conversation_id}:`, e);
        skipped++;
      }
    }

    console.log(`[Pipeline] Parsed ${tickets.length} tickets, skipped ${skipped}`);

    // 3. Compute aggregates
    const teamAggregates = computeAggregates(tickets);
    const perAgentStats = computePerAgent(tickets);
    const inquiryCategories = computeInquiryCategories(tickets);

    // 4. Sample tickets per agent
    const sampledTickets: Record<string, Ticket[]> = {};
    for (const agent of perAgentStats) {
      sampledTickets[agent.agent] = sampleTicketsForAgent(tickets, agent.agent, 7);
    }

    // 5. Build report data
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

    // 6. Call LLM for analysis (stub for now)
    console.log('[Pipeline] Calling LLM for analysis...');
    const analysis = await callLLMAnalysis(report);

    // 7. Generate docx reports
    console.log('[Pipeline] Generating reports...');
    const qaReportBuffer = await createSimpleDocx(
      `QA Report - ${periodLabel}`,
      JSON.stringify(analysis.qa_report, null, 2)
    );
    const inquiryReportBuffer = await createSimpleDocx(
      `Inquiry Report - ${periodLabel}`,
      JSON.stringify(analysis.inquiry_report, null, 2)
    );
    const agentReportBuffer = await createSimpleDocx(
      `Agent Report - ${periodLabel}`,
      JSON.stringify(analysis.agent_report, null, 2)
    );

    // 8. Upload to Vercel Blob
    console.log('[Pipeline] Uploading reports to Vercel Blob...');
    const timestamp = Date.now();
    const periodKey = periodLabel.replace(/[\s,]/g, '_');

    const qaUrl = await put(`reports/${periodKey}/qa_report_${timestamp}.docx`, qaReportBuffer, {
      access: 'public',
    });
    const inquiryUrl = await put(`reports/${periodKey}/inquiry_report_${timestamp}.docx`, inquiryReportBuffer, {
      access: 'public',
    });
    const agentUrl = await put(`reports/${periodKey}/agent_report_${timestamp}.docx`, agentReportBuffer, {
      access: 'public',
    });

    console.log('[Pipeline] Uploaded:', qaUrl, inquiryUrl, agentUrl);

    // 9. Update index
    let index: ReportIndex = { periods: [], last_updated: new Date().toISOString() };
    try {
      const indexBlob = await fetch('https://blob.vercelusercontent.com/reports/index.json');
      if (indexBlob.ok) {
        index = await indexBlob.json();
      }
    } catch (e) {
      console.warn('Could not fetch existing index:', e);
    }

    const newPeriod = {
      label: periodLabel,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      generated_at: new Date().toISOString(),
      files: {
        qa_report: qaUrl.url,
        inquiry_report: inquiryUrl.url,
        agent_report: agentUrl.url,
      },
    };

    // Remove old period if it exists
    index.periods = index.periods.filter(p => p.label !== periodLabel);
    index.periods.unshift(newPeriod);
    index.last_updated = new Date().toISOString();

    await put('reports/index.json', JSON.stringify(index, null, 2), { access: 'public' });

    console.log('[Pipeline] Complete');

    return NextResponse.json({
      ok: true,
      period: periodLabel,
      files: [qaUrl.url, inquiryUrl.url, agentUrl.url],
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
