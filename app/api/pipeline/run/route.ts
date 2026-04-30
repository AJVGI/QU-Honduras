/**
 * POST /api/pipeline/run
 * 
 * Automated QA pipeline: fetch transcripts, parse KPIs, generate reports
 * 
 * Body: { weekOffset?: number } — 0 = last week (default), 1 = 2 weeks ago
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min max for Vercel Pro

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType } from 'docx';

import { Ticket, AggregateStats, AgentStats, LLMInput, LLMOutput, PipelineRun } from '../types';

// ─── Configuration ────────────────────────────────────────────────────────

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

const API_BASE = 'https://api.stacktech.org';
const AUTH_BASE = 'https://auth.stacktech.org';
const COMPANY_ID = '3046';

// Reference data embedded as constants (read from /tmp/jackpot-qa-new at build time)
const SYSTEM_PROMPT = `You are a senior customer support QA analyst for JackpotDaily...`; // Truncated for space

const AGENT_MAPPING = {
  manager: { real_name: 'Maria Martinez', chat_alias: 'Katie Stewart' },
  team_leads: [
    { real_name: 'Ernesto Centeno', chat_alias: 'David Miller' },
    { real_name: 'Ricardo Palada', chat_alias: 'William Harris' },
    { real_name: 'Marvin Espinal', chat_alias: 'Michael Brown' },
  ],
  agents: [
    { real_name: 'Ana Erazo', chat_alias: 'Brittany Carter' },
    { real_name: 'Andrea Hernandez', chat_alias: 'Emily Davis' },
  ],
};

const PLATFORM_FACTS = {
  redemption: {
    max_per_transaction_per_day_usd: 2500,
    minimum_sc_played_through: 100,
  },
  daily_login_bonus: {
    free: true,
    purchase_required: false,
  },
};

// ─── Token Cache ──────────────────────────────────────────────────────────

interface TokenCache {
  ac_token: string;
  rf_token: string;
  exp: number;
}

let tokenCache: TokenCache | null = null;

async function wt(url: string, opts: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) {
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: { 'content-type': 'application/json', origin: 'https://cs.wellytalk.com', ...opts.headers },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

async function login(): Promise<TokenCache> {
  const d = (await wt(`${AUTH_BASE}/backend/auth/v1/user/sign-in`, {
    method: 'POST',
    body: { account: process.env.WELLYTALK_USER || 'xtractadmin01', password: process.env.WELLYTALK_PASS || 'Wellytalk2026!' },
  })) as any;
  if (d.code !== 0) throw new Error(`Login failed: code ${d.code}`);
  return { ac_token: d.data.ac_token, rf_token: d.data.rf_token, exp: Date.now() + 3300 * 1000 };
}

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.exp) return tokenCache.ac_token;
  tokenCache = await login();
  return tokenCache.ac_token;
}

// ─── WellyTalk API ────────────────────────────────────────────────────────

interface WellyParticipant {
  source_type: string;
  source_user_id: string;
  name: string;
  nick_name: string;
  chat_user_id: string;
}

interface WellyChat {
  conversation_id: string;
  participants: WellyParticipant[];
  status: string;
  created_at: number;
  closed_at: number;
  website_name: string;
  rating?: number;
}

interface WellyMessage {
  sender_id: string;
  source_type: string;
  created_at: number;
  content: {
    body_content?: string;
    message?: string;
  };
}

async function getAllChatRecords(fromDate: number, toDate: number): Promise<WellyChat[]> {
  const token = await getToken();
  const authHdrs = {
    Authorization: `Bearer ${token}`,
    'x-company-id': COMPANY_ID,
    'x-timezone': 'America/New_York',
  };

  const all: WellyChat[] = [];
  let timeUpdated = 0;
  let hasMore = true;
  const seenIds = new Set<string>();

  console.log(`Fetching chat records from ${new Date(fromDate * 1000).toISOString()} to ${new Date(toDate * 1000).toISOString()}`);

  while (hasMore) {
    const params = new URLSearchParams({
      limit: '100',
      is_personal: 'false',
      is_get_total: 'false',
      is_chat_bot: 'true',
      is_ai_agent: 'true',
      filter_mode: '1',
      search_type: '1',
      time_updated: String(timeUpdated),
      from_date: String(fromDate),
      to_date: String(toDate),
    });

    const data = (await wt(`${API_BASE}/backend/cs-agent/v1/conversation/chat-records?${params}`, {
      headers: authHdrs,
    })) as any;

    if (data.code !== 0) throw new Error(`API error: ${data.message}`);

    const records = data.data?.list || [];
    if (!records.length) {
      hasMore = false;
      break;
    }

    let newCount = 0;
    for (const r of records) {
      if (!seenIds.has(r.conversation_id)) {
        seenIds.add(r.conversation_id);
        all.push(r);
        newCount++;
      }
    }

    console.log(`  Fetched ${all.length} unique records (+${newCount} this page)`);

    if (records.length < 100) {
      hasMore = false;
    } else {
      const oldest = records[records.length - 1];
      const cursorSec = oldest.updated_at || oldest.created_at || 0;
      if (!cursorSec) hasMore = false;
      else timeUpdated = cursorSec;
    }
  }

  return all;
}

async function getTranscript(conversationId: string, lastMessageId: number): Promise<WellyMessage[]> {
  const token = await getToken();
  const authHdrs = {
    Authorization: `Bearer ${token}`,
    'x-company-id': COMPANY_ID,
    'x-timezone': 'America/New_York',
  };

  const params = new URLSearchParams({
    ConversationIds: conversationId,
    LastMessageId: String(lastMessageId),
    limit: '200',
    direction: 'previous',
  });

  const data = (await wt(`${API_BASE}/backend/cs-agent/v1/conversation/histories?${params}`, {
    headers: authHdrs,
  })) as any;

  if (data.code !== 0) throw new Error(`Transcript error: ${data.message}`);
  return data.data?.items || [];
}

// ─── Parsing Logic ────────────────────────────────────────────────────────

const SKIP_AGENTS = new Set(['Bot', '-2147483648', '', 'xtractadmin01']);
const SLOW_FRT_THRESHOLD = 300;

function parseTicket(chat: WellyChat, messages: WellyMessage[]): Ticket {
  // Participants
  const agents = chat.participants
    ?.filter((p) => p.source_type === 'INTERNAL')
    ?.map((p) => p.name || p.nick_name || 'Unknown')
    ?.filter((a) => !SKIP_AGENTS.has(a)) || [];

  const primaryAgent = agents.length > 0 ? agents[0] : null;
  const isHumanHandled = agents.length > 0;
  const isBotOnly = !isHumanHandled;

  // FRT
  let frtSeconds: number | null = null;
  if (isHumanHandled && messages.length > 0) {
    const firstMessage = messages[messages.length - 1]; // Oldest message
    frtSeconds = Math.max(0, (firstMessage.created_at - chat.created_at) * 1000);
  }

  // Content
  const content = messages
    .map((m) => m.content?.body_content || m.content?.message || '')
    .filter((c) => c)
    .join('\n');

  // Classification
  const contentLower = content.toLowerCase();
  const isClosedByAgent = contentLower.includes('closed - by agent');
  const isClosedVisitorLeft = contentLower.includes('closed - visitor left');
  const isClosedInactivity = contentLower.includes('closed - inactivity') || contentLower.includes('closed - 10 min inactivity');
  const recallCount = (content.match(/recalled the message/gi) || []).length;

  const isSlowFrt = frtSeconds !== null && frtSeconds > SLOW_FRT_THRESHOLD;
  const isBotAbandoned = isBotOnly && isClosedVisitorLeft;

  // Category (simplified keyword matching)
  let category = 'General Inquiry';
  const haystack = contentLower.slice(0, 400);
  if (haystack.includes('redeem') || haystack.includes('withdraw') || haystack.includes('cash')) category = 'Redemption';
  else if (haystack.includes('verif') || haystack.includes('kyc')) category = 'Verification';
  else if (haystack.includes('login') || haystack.includes('password')) category = 'Login';
  else if (haystack.includes('bonus') || haystack.includes('promo')) category = 'Promotions';

  return {
    id: chat.conversation_id,
    conversationId: chat.conversation_id,
    visitor: 'Customer',
    agents,
    primaryAgent,
    startTime: new Date(chat.created_at * 1000).toISOString(),
    frtSeconds,
    content,
    category,
    isHumanHandled,
    isBotOnly,
    isClosedByAgent,
    isClosedVisitorLeft,
    isClosedInactivity,
    hasRecall: recallCount > 0,
    recallCount,
    isSlowFrt,
    isBotAbandoned,
  };
}

function computeAggregates(tickets: Ticket[]): AggregateStats {
  const totalTickets = tickets.length;
  const frts = tickets.map((t) => t.frtSeconds).filter((n) => n !== null) as number[];

  const sorted = [...frts].sort((a, b) => a - b);
  const medianFrtSeconds = sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.floor(sorted.length / 2)];

  return {
    totalTickets,
    avgFrtSeconds: frts.length > 0 ? frts.reduce((a, b) => a + b, 0) / frts.length : 0,
    medianFrtSeconds: medianFrtSeconds || 0,
    closedByAgentCount: tickets.filter((t) => t.isClosedByAgent).length,
    closedByAgentPct: (tickets.filter((t) => t.isClosedByAgent).length / totalTickets) * 100,
    visitorLeftCount: tickets.filter((t) => t.isClosedVisitorLeft).length,
    visitorLeftPct: (tickets.filter((t) => t.isClosedVisitorLeft).length / totalTickets) * 100,
    recallCount: tickets.reduce((sum, t) => sum + t.recallCount, 0),
    slowFrtCount: tickets.filter((t) => t.isSlowFrt).length,
    slowFrtPct: (tickets.filter((t) => t.isSlowFrt).length / totalTickets) * 100,
    botAbandonedCount: tickets.filter((t) => t.isBotAbandoned).length,
    botAbandonedPct: (tickets.filter((t) => t.isBotAbandoned).length / totalTickets) * 100,
  };
}

function computePerAgent(tickets: Ticket[]): AgentStats[] {
  const byAgent = new Map<string, { total: number; closed: number; recalled: number; visitorLeft: number; frts: number[] }>();

  for (const t of tickets) {
    if (!t.primaryAgent) continue;
    if (!byAgent.has(t.primaryAgent)) {
      byAgent.set(t.primaryAgent, { total: 0, closed: 0, recalled: 0, visitorLeft: 0, frts: [] });
    }
    const a = byAgent.get(t.primaryAgent)!;
    a.total += 1;
    if (t.isClosedByAgent) a.closed += 1;
    if (t.hasRecall) a.recalled += 1;
    if (t.isClosedVisitorLeft) a.visitorLeft += 1;
    if (t.frtSeconds !== null) a.frts.push(t.frtSeconds);
  }

  const result: AgentStats[] = [];
  for (const [agent, stats] of byAgent) {
    result.push({
      agent,
      total: stats.total,
      closed: stats.closed,
      closurePct: stats.total > 0 ? (stats.closed / stats.total) * 100 : 0,
      recalls: stats.recalled,
      visitorLeft: stats.visitorLeft,
      avgFrtSeconds: stats.frts.length > 0 ? stats.frts.reduce((a, b) => a + b, 0) / stats.frts.length : null,
    });
  }

  return result.sort((a, b) => b.closurePct - a.closurePct);
}

// ─── Mock Report Generation (Simplified) ──────────────────────────────────

async function generateMockReports(
  periodLabel: string,
  aggregates: AggregateStats,
  perAgent: AgentStats[]
): Promise<{ qa: Buffer; inquiry: Buffer; individual: Buffer }> {
  // Create minimal Word documents for testing
  const createSimpleDocx = (title: string) => {
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: title,
              bold: true,
              size: 28,
            }),
            new Paragraph({
              text: `Period: ${periodLabel}`,
              size: 20,
            }),
            new Paragraph({
              text: `Total Tickets: ${aggregates.totalTickets}`,
              size: 20,
            }),
            new Paragraph({
              text: `Avg FRT: ${aggregates.avgFrtSeconds.toFixed(1)}s`,
              size: 20,
            }),
          ],
        },
      ],
    });
    return Packer.toBuffer(doc);
  };

  return {
    qa: await createSimpleDocx('QA Report'),
    inquiry: await createSimpleDocx('Client Inquiry Report'),
    individual: await createSimpleDocx('Individual Agent Report'),
  };
}

// ─── Main Handler ─────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { weekOffset?: number };
    const weekOffset = body.weekOffset || 0;

    // Calculate week range (Monday 00:00 ET → Sunday 23:59 ET)
    const now = new Date();
    const etNow = new Date(now.getTime() - 4 * 60 * 60 * 1000); // Convert to ET
    const dayOfWeek = etNow.getUTCDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const weekStart = new Date(etNow);
    weekStart.setUTCDate(weekStart.getUTCDate() - daysToMonday - 7 * weekOffset);
    weekStart.setUTCHours(4, 0, 0, 0); // 00:00 ET = 04:00 UTC

    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    weekEnd.setUTCHours(23, 59, 59, 999); // 23:59:59 ET = 03:59:59 UTC next day

    const periodLabel = `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
    const periodStartStr = weekStart.toISOString().split('T')[0];
    const periodEndStr = weekEnd.toISOString().split('T')[0];

    console.log(`Processing period: ${periodLabel}`);

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Insert run record
    const { data: runRecord, error: insertError } = await supabase
      .from('pipeline_runs')
      .insert({
        period_label: periodLabel,
        period_start: periodStartStr,
        period_end: periodEndStr,
        status: 'running',
      })
      .select()
      .single();

    if (insertError) throw insertError;
    const runId = runRecord?.id;

    try {
      // Fetch chat records from WellyTalk
      const fromSec = Math.floor(weekStart.getTime() / 1000);
      const toSec = Math.floor(weekEnd.getTime() / 1000);

      console.log('Fetching chat records from WellyTalk...');
      const chatRecords = await getAllChatRecords(fromSec, toSec);
      console.log(`✓ Fetched ${chatRecords.length} chat records`);

      // Parse each chat into a ticket
      const tickets: Ticket[] = [];
      for (const chat of chatRecords.slice(0, 50)) {
        // Limit to first 50 for testing
        try {
          const messages = await getTranscript(chat.conversation_id, 0);
          const ticket = parseTicket(chat, messages);
          tickets.push(ticket);
        } catch (e) {
          console.warn(`Failed to parse ticket ${chat.conversation_id}: ${(e as Error).message}`);
        }
      }
      console.log(`✓ Parsed ${tickets.length} tickets`);

      // Compute metrics
      const aggregates = computeAggregates(tickets);
      const perAgent = computePerAgent(tickets);
      const agentCount = perAgent.length;

      console.log(`Aggregates: ${aggregates.totalTickets} tickets, ${aggregates.avgFrtSeconds.toFixed(1)}s avg FRT`);
      console.log(`Per-agent: ${agentCount} agents active`);

      // Generate mock reports (LLM step would go here in production)
      const reports = await generateMockReports(periodLabel, aggregates, perAgent);

      // Upload to Supabase Storage
      const qaPath = `${periodStartStr}_${periodEndStr}/QA_Report.docx`;
      const inquiryPath = `${periodStartStr}_${periodEndStr}/Client_Inquiry_Report.docx`;
      const individualPath = `${periodStartStr}_${periodEndStr}/Individual_Agent_Report.docx`;

      console.log('Uploading reports to Supabase Storage...');
      const [qaUpload, inquiryUpload, individualUpload] = await Promise.all([
        supabase.storage.from('qa-reports').upload(qaPath, reports.qa, { upsert: false }),
        supabase.storage.from('qa-reports').upload(inquiryPath, reports.inquiry, { upsert: false }),
        supabase.storage.from('qa-reports').upload(individualPath, reports.individual, { upsert: false }),
      ]);

      if (qaUpload.error || inquiryUpload.error || individualUpload.error) {
        throw new Error(`Storage upload failed: ${qaUpload.error?.message || inquiryUpload.error?.message || individualUpload.error?.message}`);
      }

      // Update run record
      const { error: updateError } = await supabase
        .from('pipeline_runs')
        .update({
          status: 'completed',
          qa_report_path: qaPath,
          inquiry_report_path: inquiryPath,
          individual_report_path: individualPath,
          total_tickets: aggregates.totalTickets,
          agent_count: agentCount,
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId);

      if (updateError) throw updateError;

      console.log('✓ Pipeline completed successfully');

      return NextResponse.json({
        ok: true,
        period: periodLabel,
        runId,
        totalTickets: aggregates.totalTickets,
        agentCount,
      });
    } catch (error) {
      const errorMsg = (error as Error).message;
      console.error('Pipeline failed:', errorMsg);

      // Update run record with error
      await supabase
        .from('pipeline_runs')
        .update({
          status: 'failed',
          error_message: errorMsg,
        })
        .eq('id', runId);

      throw error;
    }
  } catch (error) {
    console.error('Request error:', (error as Error).message);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
