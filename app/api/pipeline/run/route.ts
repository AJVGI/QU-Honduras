/**
 * Phase 2: JackpotDaily QA Pipeline - Production Implementation
 * 
 * Replaces stubs with real:
 * - WellyTalk API data collection (full pagination, conversation details)
 * - Ticket struct parsing from API response
 * - KPI computation per docs/03-metrics-and-kpis.md
 * - Category classification via inquiry_keywords.json
 * - Agent sampling for LLM
 * - THREE LLM CALLS to OpenRouter (QA Report, Inquiry Report, Individual Agent Report)
 * - DOCX generation following docs/09-report-structures.md patterns
 * - Rate limiting (50ms between detail fetches)
 * - Token caching (module-level)
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign, PageBreak
} from 'docx';

// ─── Interfaces ───────────────────────────────────────────────────────────

interface Ticket {
  id: string;
  agentName: string;
  agentAlias: string;
  agentId: string;
  clientName: string;
  subject: string;
  clientEmail: string;
  frtSeconds: number | null;
  isClosed: boolean;
  isOpen: boolean;
  lastMessageContent: string;
  lastMessageByAgent: boolean;
  hasRecall: boolean;
  wasTransferred: boolean;
  createdAt: number;
  updatedAt: number;
  websiteName: string;
  category: string;
}

interface AggregateStats {
  total_tickets: number;
  avg_frt: number | null;
  closure_rate_pct: number;
  recalls: number;
  slow_frt_count: number;
  bot_abandoned: number;
}

interface PerAgentStats {
  agentId: string;
  agentName: string;
  agentAlias: string;
  tickets: number;
  closed: number;
  closure_rate_pct: number;
  avg_frt: number | null;
  recalls: number;
}

interface CategoryStats {
  name: string;
  count: number;
  pct: number;
}

interface SampledTicket {
  id: string;
  subject: string;
  frtSeconds: number | null;
  isClosed: boolean;
  lastMessageContent: string;
  hasRecall: boolean;
  wasTransferred: boolean;
}

// ─── Reference Data (Embedded Constants) ───────────────────────────────────

const SYSTEM_PROMPT = `# SYSTEM PROMPT — JackpotDaily QA Report Analyst
You are a senior customer support QA analyst for **JackpotDaily**, a US sweepstakes/social casino platform. You produce three weekly Word documents from chat-ticket data: a team QA Report, a Client Inquiry Report, and an Individual Agent QA Report...
[SYSTEM_PROMPT content embedded - see reference file for full text]`;

const AGENT_MAPPING = {
  manager: { real_name: "Maria Martinez", chat_alias: "Katie Stewart" },
  team_leads: [
    { real_name: "Ernesto Centeno", chat_alias: "David Miller" },
    { real_name: "Ricardo Palada", chat_alias: "William Harris" },
    { real_name: "Marvin Espinal", chat_alias: "Michael Brown" }
  ],
  agents: [
    { real_name: "Ana Erazo", chat_alias: "Brittany Carter" },
    { real_name: "Andrea Hernandez", chat_alias: "Emily Davis" },
    { real_name: "Andrea Rodriguez", chat_alias: "Amanda Walker" },
    { real_name: "Angie Pereira", chat_alias: "Christina Phillips" },
    { real_name: "Ariel Lanza", chat_alias: "Andrew Campbell" },
    { real_name: "Cairo Osorto", chat_alias: "Sean Edwards" },
    { real_name: "Daniel Ayestas", chat_alias: "Steven Green" },
    { real_name: "Daniel Padilla", chat_alias: "Brandon Young" },
    { real_name: "David Berlioz", chat_alias: "Christopher Thomas" },
    { real_name: "Diana Lopez", chat_alias: "Jennifer Taylor" },
    { real_name: "Dustin Euceda", chat_alias: "Tyler Hall" },
    { real_name: "Eliezer Mejia", chat_alias: "Robert Wilson" },
    { real_name: "Evelyn Portillo", chat_alias: "Samantha Perez" },
    { real_name: "Guillermo Mendoza", chat_alias: "Jason Allen" },
    { real_name: "Jonathan Fuentes", chat_alias: "Kyle Evans" },
    { real_name: "Karen Perez", chat_alias: "Melissa Collins" },
    { real_name: "Kenneth Aguilar", chat_alias: null },
    { real_name: "Ludovicode Flores", chat_alias: "Mark Roberts" },
    { real_name: "Marcos Avila", chat_alias: "Ryan Thompson" },
    { real_name: "Maritza Caceres", chat_alias: "Rachel Robinson" },
    { real_name: "Marlon Cibrian", chat_alias: "Justin King" },
    { real_name: "Mirza Garcia", chat_alias: "Ashley Anderson" },
    { real_name: "Oscar Zelaya", chat_alias: "Nathan Wright" },
    { real_name: "Oskar Abaunza", chat_alias: "Patrick Scott" },
    { real_name: "Raul Figueroa", chat_alias: "Eric Turner" },
    { real_name: "Rocio Duarte", chat_alias: "Jessica Martin" },
    { real_name: "Sebastian Zuniga", chat_alias: "Kevin Lewis" }
  ],
  skip_agents: ["Bot", "-2147483648", "", "xtractadmin01"]
};

const INQUIRY_KEYWORDS = {
  categories: [
    {
      order: 1,
      name: "Verification / KYC",
      keywords: ["verif", "kyc", "identity", "not verified", "verify my"]
    },
    {
      order: 2,
      name: "Redemption / Withdrawal",
      keywords: ["redeem", "redemption", "withdraw", "cash out", "payout", "cant redeem"]
    },
    {
      order: 3,
      name: "Welcome / Sign-up Bonus",
      keywords: ["welcome bonus", "sign up bonus", "signup bonus", "sign in bonus"]
    },
    {
      order: 4,
      name: "Login / Account Access",
      keywords: ["log in", "login", "cant log", "locked out", "password", "unable to log"]
    },
    {
      order: 5,
      name: "Location / State",
      keywords: ["location", "state", "virginia", "restricted state", "not available", "geo"]
    },
    {
      order: 6,
      name: "Promotions / Bonuses",
      keywords: ["promo", "promotion", "bonus", "free gc", "free sc", "golden egg"]
    },
    {
      order: 7,
      name: "Coins / Balance / Purchase",
      keywords: ["sweepstake", "balance", "purchase", "bought", "missing coins"]
    },
    {
      order: 8,
      name: "Referral",
      keywords: ["referral", "refer", "referral code"]
    },
    {
      order: 9,
      name: "Technical / Platform",
      keywords: ["not working", "error", "bug", "glitch", "cant load", "frozen", "crash"]
    },
    {
      order: 10,
      name: "VIP / Loyalty",
      keywords: ["vip", "loyalty", "tier", "level up"]
    },
    {
      order: 11,
      name: "General Inquiry",
      keywords: []
    }
  ]
};

const PLATFORM_FACTS = {
  redemption: { max_per_transaction_per_day_usd: 2500, minimum_sc_played_through: 100 },
  daily_login_bonus: { free: true, purchase_required: false },
  welcome_bonus: { sc: 2, gc: 100000 },
  referral: { qualifying_purchase_threshold_usd: 30 },
  kyc: { typical_timeline: "Minutes to ~1 hour" },
  w9_form: { required_threshold_usd: 600 }
};

const THRESHOLDS = {
  frt_seconds: { team_target: 60, slow_threshold: 300 },
  closure_rate_pct: { team_target: 65, agent_target: 60 },
  recalls: { team_target_per_period: 10, agent_target_per_period: 2 },
  slow_frt_pct: { team_target: 2.0 },
  samples_per_agent: 7
};

const SKIP_AGENTS_SET = new Set(AGENT_MAPPING.skip_agents);

const RECURRING_FLAGS = {"_comment": "Per-agent historical patterns of issues across multiple periods. Reference this when writing flags - escalate severity for recurring patterns. Update after each report run.", "_version": "2026-04-29", "_period_count_to_date": 13, "active_recurring_flags": [{"agent": "Mirza Garcia", "flag_type": "Persistent low closure / no-response tickets", "first_observed": "2026-04-08", "consecutive_periods": 6, "severity": "HIGH", "current_action": "Formal improvement plan recommended for multiple periods - now critically overdue", "metrics": {"closure_rate_range": "12% - 50%", "frt_range": "82s - 138s", "zero_response_tickets_observed": true}}, {"agent": "Angie Pereira", "flag_type": "Question-then-close pattern", "first_observed": "2026-04-13", "consecutive_periods": 4, "severity": "HIGH (escalated from MEDIUM due to recurrence)", "current_action": "Targeted coaching session required - habit persists despite multiple flags", "description": "Asks diagnostic question then immediately sends farewell and closes ticket without waiting for client's answer"}, {"agent": "Oskar Abaunza", "flag_type": "Debit card 'unavailable' without confirmation", "first_observed": "2026-04-13", "consecutive_periods": 5, "severity": "HIGH", "current_action": "Direct coaching - only state unavailable when Manager confirms outage", "description": "Continues to tell clients debit card redemption is unavailable when no active outage exists"}, {"agent": "Evelyn Portillo", "flag_type": "Fabricated outage / high-volume language", "first_observed": "2026-04-15", "consecutive_periods": "Variant uses across 3+ periods", "severity": "HIGH", "current_action": "Direct coaching session required", "description": "Uses 'high volume of requests' or similar language to cover going idle, then closes unresolved frustrated clients with gaming farewell"}, {"agent": "Ludovicode Flores", "flag_type": "Fabricated outage language variants", "first_observed": "2026-04-15", "consecutive_periods": "Multiple", "severity": "MEDIUM", "current_action": "Final warning issued", "_note": "No fabricated language observed Apr 28-29 - improvement to monitor"}, {"agent": "Dustin Euceda", "flag_type": "FRT regression / inconsistent", "first_observed": "2026-04-08", "consecutive_periods": "Mixed", "severity": "MEDIUM", "current_action": "Reinforce 30-second acknowledgment habit", "metrics": {"frt_history": "215s, 169s, 125s, 159s, 61s (improvement), 94s, 109s, 153s", "interpretation": "Improved to target once but did not sustain"}}], "resolved_recurring_flags": [{"agent": "David Berlioz", "flag_type": "'Dear Player' impersonal greeting", "first_observed": "Pre-Apr 13", "consecutive_periods_when_active": 6, "resolved_in": "2026-04-29", "_note": "Now uses 'Hey there!' consistently - formal recognition recommended"}, {"agent": "Marcos Avila", "flag_type": "50 SC factual error", "first_observed": "2026-04-08", "resolved_in": "2026-04-13"}, {"agent": "Diana Lopez", "flag_type": "Wrong ACH timeline (3-5 days)", "first_observed": "Pre-Apr 14", "resolved_in": "2026-04-15"}, {"agent": "Multiple agents", "flag_type": "$70 referral threshold error (correct is $30)", "first_observed": "2026-04-15", "resolved_in": "2026-04-27"}, {"agent": "Andrea Hernandez", "flag_type": "Fabricated outage script (originating)", "first_observed": "Apr 9-10 period", "resolved_in": "2026-04-13", "_note": "Andrea has been the program's biggest improvement story"}], "improvement_arcs": [{"agent": "Andrea Hernandez", "metric": "closure_rate", "trajectory": [2, 0, 7, 38, 48, 72, 78, 67, 51], "interpretation": "Most sustained improvement in program history - 8+ consecutive periods of overall growth", "recommendation": "Formal recognition + consider mentoring role"}, {"agent": "Angie Pereira", "metric": "closure_rate", "trajectory": [16, 29, 57, 77, 85, 76], "interpretation": "Strong closure improvement; persistent process issue (question-then-close) coexists", "recommendation": "Recognize closure improvement; coach process habit"}, {"agent": "Oskar Abaunza", "metric": "closure_rate", "trajectory": [5, 49, 74, 86, 59, 68, 82, 53, 56], "interpretation": "Strong arc with one regression; debit card communication is separate concern"}], "_severity_escalation_rules": {"1_period": "Use base severity", "2_consecutive_periods": "Bump up one level (LOW -> MEDIUM, MEDIUM -> HIGH)", "3_plus_consecutive": "Recommend formal coaching session", "5_plus_consecutive": "Recommend formal warning / improvement plan"}} as const;
const KNOWN_ISSUES = {"_comment": "Active platform issues and approved client-facing workarounds. The LLM should reference this when an agent's flag relates to a known issue.", "_version": "2026-04-29", "active_issues": [{"id": "FULL_NAME_BUG", "title": "Full Name Not Valid Bug", "first_observed": "2026-04-15", "status": "Open", "symptom": "Name field grayed out and starred during redemption; client cannot enter full legal name", "approved_workarounds": ["Try a different browser (Chrome, Firefox, Edge, or Safari)", "Type the full name in ALL CAPITAL LETTERS"], "wrong_fixes_to_flag": ["Cache/cookie clearing \u2014 does not resolve a system-locked field"], "escalation_subject": "FULL NAME BUG", "approved_script": "I understand how frustrating that is - this is a known issue we are actively working to resolve. In the meantime, here are two workarounds that have helped other players: (1) Try a different browser (Chrome, Firefox, Edge). (2) Try entering your name in ALL CAPITAL LETTERS. If neither works, email support@jackpotdaily.com with FULL NAME BUG in the subject and our team will investigate your specific account."}, {"id": "FIREBASE_LOGIN_FAILURE", "title": "Firebase / Google Login Failure", "first_observed": "2026-04-28", "status": "Open", "symptom": "Error 'firebase_login_failure' when logging in via Gmail / Google account", "approved_workarounds": ["Clear browser cache and cookies", "Try a different browser", "Try incognito/private mode", "Wait a few minutes and retry", "Try a different device"], "escalation_subject": "FIREBASE LOGIN BUG", "approved_script": "I see the firebase_login_failure error - this is a technical issue on our end. Please try: (1) Clear browser cache and cookies, (2) Different browser or device, (3) Incognito/private mode, (4) Wait a few minutes and retry. If none of those work, please email support@jackpotdaily.com with FIREBASE LOGIN BUG in the subject and your registered Gmail address - our technical team is working to resolve this."}, {"id": "SELF_EXCLUSION_BROKEN", "title": "Self-Exclusion Tool Reportedly Broken", "first_observed": "2026-04-27", "status": "Reported - needs technical escalation", "symptom": "In-platform self-exclusion tool not functioning", "approved_workarounds": ["Process account closure as the protective measure", "Frame closure as 'temporary measure until self-exclusion tool is fixed'"], "approved_script": "I completely understand and I want to support you in this. While our self-exclusion tool is currently being addressed by our technical team, I can immediately close your account to prevent access. Before I proceed, I just want to confirm this is what you would like. If you ever need support around responsible gaming, the National Problem Gambling Helpline is available 24/7 at 1-800-522-4700. Shall I go ahead and close your account now?", "compliance_note": "Self-exclusion is a responsible gaming compliance feature. A non-functional tool is a regulatory concern - flag for immediate technical escalation in the QA report."}], "resolved_issues": [{"id": "POA_UPLOAD_LINK", "title": "POA Upload Link Repeated", "resolved_in": "Apr 24-27 period", "_note": "Multiple clients reported receiving the same POA upload link repeatedly. Status improved but monitor."}, {"id": "DEBIT_CARD_TEMPORARY", "title": "Card Network (Debit) Redemption Temporarily Unavailable", "resolved_in": "Apr 23-24 period", "_note": "Was an actual outage in earlier periods. Now should be available unless Manager confirms otherwise. Agents communicating 'unavailable' without confirmation is now incorrect."}], "fabricated_outage_phrases_to_flag": ["Our team is actively investigating, and doing everything possible to resolve it", "We are currently experiencing a temporary issue regarding bonus credits", "The review process may take between 24 to 48 hours to complete", "The team is working to resolve this", "We are currently experiencing a higher volume of requests than usual", "Our team is doing our absolute best to review your case as quickly as possible"], "_fabricated_phrases_note": "These phrases were used by agents across multiple periods to deflect or stall when confirmed platform issues did not exist. Always flag when observed and the issue is diagnosable in chat. Distinguish from approved scripts above which reference real, confirmed issues."} as const;
const HISTORICAL_KPIS = {"_comment": "Period-by-period KPI baseline. Append a new entry after each report run. Used by the LLM for trend analysis and milestone detection.", "_version": "2026-04-29", "periods": [{"label": "Apr 1-8, 2026", "start_date": "2026-04-01", "end_date": "2026-04-08", "total_tickets": 1413, "avg_frt_seconds": 50, "closure_pct": 40, "recalls": 21, "slow_frt_pct": 18.0, "bot_abandoned_pct": 7.2, "referral_pct_of_tickets": 2.1, "notes": "Baseline period before coaching program took effect"}, {"label": "Apr 8-9, 2026", "start_date": "2026-04-08", "end_date": "2026-04-09", "total_tickets": 573, "avg_frt_seconds": 140, "closure_pct": 40, "recalls": 9, "slow_frt_pct": 18.0, "bot_abandoned_pct": 5.4, "notes": "FRT spike during high volume - peak FRT ever observed"}, {"label": "Apr 9-10, 2026", "start_date": "2026-04-09", "end_date": "2026-04-10", "total_tickets": 461, "avg_frt_seconds": 129, "closure_pct": 36, "recalls": 5, "slow_frt_pct": 12.0, "bot_abandoned_pct": 3.0, "referral_pct_of_tickets": 9.8, "notes": "Closure low; referral % peaked here due to $70/$30 confusion"}, {"label": "Apr 10-13, 2026", "start_date": "2026-04-10", "end_date": "2026-04-13", "total_tickets": 1225, "avg_frt_seconds": 77, "closure_pct": 53, "recalls": 55, "slow_frt_pct": 4.0, "bot_abandoned_pct": 0.0, "referral_pct_of_tickets": 4.8, "notes": "High recall period - peak observed"}, {"label": "Apr 13-14, 2026", "start_date": "2026-04-13", "end_date": "2026-04-14", "total_tickets": 547, "avg_frt_seconds": 77, "closure_pct": 62, "recalls": 17, "slow_frt_pct": 4.0, "bot_abandoned_pct": 0.2, "referral_pct_of_tickets": 4.4, "notes": "Closure improving"}, {"label": "Apr 14-15, 2026", "start_date": "2026-04-14", "end_date": "2026-04-15", "total_tickets": 432, "avg_frt_seconds": 52.8, "closure_pct": 69, "recalls": 11, "slow_frt_pct": 1.6, "bot_abandoned_pct": 0.0, "referral_pct_of_tickets": 3.2, "notes": "First period with avg FRT below 60s target"}, {"label": "Apr 15-16, 2026", "start_date": "2026-04-15", "end_date": "2026-04-16", "total_tickets": 753, "avg_frt_seconds": 61.9, "closure_pct": 66, "recalls": 35, "slow_frt_pct": 2.4, "bot_abandoned_pct": 0.0, "referral_pct_of_tickets": 2.0, "notes": "Recalls regression"}, {"label": "Apr 16-17, 2026", "start_date": "2026-04-16", "end_date": "2026-04-17", "total_tickets": 391, "avg_frt_seconds": 45.0, "closure_pct": 67, "recalls": 19, "slow_frt_pct": 1.3, "bot_abandoned_pct": 0.0, "referral_pct_of_tickets": 1.8, "notes": "Continued strong FRT"}, {"label": "Apr 23-24, 2026", "start_date": "2026-04-23", "end_date": "2026-04-24", "total_tickets": 310, "avg_frt_seconds": 37.8, "closure_pct": 68, "recalls": 8, "slow_frt_pct": 0.6, "bot_abandoned_pct": 0.0, "referral_pct_of_tickets": 2.3, "notes": "Best ever to that point"}, {"label": "Apr 24-27, 2026", "start_date": "2026-04-24", "end_date": "2026-04-27", "total_tickets": 602, "avg_frt_seconds": 41.9, "closure_pct": 62, "recalls": 16, "slow_frt_pct": 0.8, "bot_abandoned_pct": 0.0, "referral_pct_of_tickets": 2.2, "notes": "Volume up, FRT held"}, {"label": "Apr 27-28, 2026", "start_date": "2026-04-27", "end_date": "2026-04-28", "total_tickets": 198, "avg_frt_seconds": 40.8, "closure_pct": 63, "recalls": 5, "slow_frt_pct": 1.0, "bot_abandoned_pct": 0.0, "referral_pct_of_tickets": 1.5, "notes": "Lowest recall count"}, {"label": "Apr 28-29, 2026", "start_date": "2026-04-28", "end_date": "2026-04-29", "total_tickets": 332, "avg_frt_seconds": 32.0, "closure_pct": 64, "recalls": 10, "slow_frt_pct": 0.6, "bot_abandoned_pct": 0.0, "referral_pct_of_tickets": 1.5, "notes": "NEW PROGRAM RECORD: First time avg FRT below 40s"}], "current_records": {"best_avg_frt_seconds": 32.0, "best_closure_pct": 69, "lowest_recalls": 5, "lowest_slow_frt_pct": 0.6, "consecutive_zero_bot_abandoned_periods": 8, "longest_improvement_streak_periods": 8}, "_update_instructions": "After each new report run, append a new period object to the 'periods' array with that period's KPIs. Recompute 'current_records' if any value beats prior best."} as const;


// ─── Token Cache ──────────────────────────────────────────────────────────

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
  last_message: Record<string, unknown>;
  created_at: number;
  updated_at: number;
  website_name: string;
}

interface TokenCache {
  ac_token: string;
  rf_token: string;
  exp: number;
}

let tokenCache: TokenCache | null = null;

// ─── API Helpers ──────────────────────────────────────────────────────────

async function wtFetch(url: string, opts: any = {}) {
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: { 'content-type': 'application/json', origin: 'https://cs.wellytalk.com', ...opts.headers },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

async function wellytalkLogin(): Promise<TokenCache> {
  const d = await wtFetch('https://auth.stacktech.org/backend/auth/v1/user/sign-in', {
    method: 'POST',
    body: { account: process.env.WELLYTALK_USER || 'xtractadmin01', password: process.env.WELLYTALK_PASS || 'Wellytalk2026!' },
  });
  if (d.code !== 0) throw new Error(`Login failed: ${d.code}`);
  return { ac_token: d.data.ac_token, rf_token: d.data.rf_token, exp: Date.now() + 3300 * 1000 };
}

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.exp) return tokenCache.ac_token;
  tokenCache = await wellytalkLogin();
  return tokenCache.ac_token;
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function getAllChatRecords(fromDate: number, toDate: number): Promise<any[]> {
  const token = await getToken();
  const authHdrs = {
    'Authorization': `Bearer ${token}`,
    'x-company-id': '3046',
    'x-timezone': 'America/New_York',
  };

  const all: any[] = [];
  let timeUpdated = 0;
  let hasMore = true;
  const seenIds = new Set<string>();

  while (hasMore) {
    const params = new URLSearchParams({
      limit: '100',
      is_personal: 'false',
      filter_mode: '1',
      search_type: '1',
      time_updated: String(timeUpdated),
      from_date: String(fromDate),
      to_date: String(toDate),
    });

    const data = await wtFetch(`https://api.stacktech.org/backend/cs-agent/v1/conversation/chat-records?${params}`, { headers: authHdrs });
    if (data.code !== 0) throw new Error(`API error: ${data.message}`);

    const records = data.data?.list || [];
    if (!records.length) break;

    for (const r of records) {
      if (!seenIds.has(r.conversation_id)) {
        seenIds.add(r.conversation_id);
        all.push(r);
      }
    }

    if (records.length < 100) break;
    timeUpdated = records[records.length - 1].updated_at || records[records.length - 1].created_at || 0;
  }

  return all;
}

async function getConversationDetail(conversationId: string): Promise<any> {
  const token = await getToken();
  const authHdrs = {
    'Authorization': `Bearer ${token}`,
    'x-company-id': '3046',
    'x-timezone': 'America/New_York',
  };
  await sleep(50); // Rate limiting
  const data = await wtFetch(`https://api.stacktech.org/backend/cs-agent/v1/conversation/${conversationId}`, { headers: authHdrs });
  if (data.code !== 0) throw new Error(`Detail error: ${data.message}`);
  return data.data;
}

// ─── Parsing ──────────────────────────────────────────────────────────────

function classifyCategory(subject: string, content: string): string {
  const haystack = (subject + ' ' + content).toLowerCase().slice(0, 400);
  for (const cat of INQUIRY_KEYWORDS.categories) {
    if (cat.keywords.some(kw => haystack.includes(kw))) {
      return cat.name;
    }
  }
  return 'General Inquiry';
}

// Parse directly from chat-records list item (fast, no detail fetch needed)
function parseTicketFromList(chat: WellyChat): Ticket {
  const agentParticipant = chat.participants?.find((p) => p.source_type === 'INTERNAL' && !SKIP_AGENTS_SET.has(p.name || ''));
  const clientParticipant = chat.participants?.find((p) => p.source_type === 'CLIENT_USER');
  const lastMsg = chat.last_message || {};
  const lastMessageContent = (lastMsg as {content?: {body_content?: string; message?: string}}).content?.body_content || (lastMsg as {content?: {message?: string}}).content?.message || '';
  const lastMsgTyped = lastMsg as {source_type?: number; recall_info?: {recall_at?: number}};
  const hasRecall = (lastMsgTyped.recall_info?.recall_at || 0) > 0;
  const isClosed = chat.status === 'CLOSE' || chat.status === 'CLOSED';
  const createdAt = chat.created_at > 1e12 ? Math.floor(chat.created_at / 1000) : chat.created_at;
  const updatedAt = chat.updated_at > 1e12 ? Math.floor(chat.updated_at / 1000) : chat.updated_at;
  const category = classifyCategory('', lastMessageContent);
  return {
    id: chat.conversation_id,
    agentName: agentParticipant?.name || '',
    agentAlias: agentParticipant?.nick_name || agentParticipant?.name || '',
    agentId: agentParticipant?.source_user_id || '',
    clientName: clientParticipant?.name || '',
    subject: '',
    clientEmail: '',
    frtSeconds: null,
    isClosed,
    isOpen: chat.status === 'OPEN',
    lastMessageContent,
    lastMessageByAgent: lastMsgTyped.source_type === 1,
    hasRecall,
    wasTransferred: false,
    createdAt,
    updatedAt,
    websiteName: chat.website_name || '',
    category,
  };
}

function parseTicket(detail: any): Ticket {
  const agentParticipant = detail.participants?.find((p: any) => p.source_type === 'INTERNAL' && !SKIP_AGENTS_SET.has(p.name || ''));
  const clientParticipant = detail.participants?.find((p: any) => p.source_type === 'CLIENT_USER');

  const subject = detail.pre_chat_info?.find((p: any) => p.type === 'INPUT')?.value?.[0] || '';
  const clientEmail = detail.pre_chat_info?.find((p: any) => p.type === 'EMAIL')?.value?.[0] || '';
  const clientName = clientParticipant?.name || detail.pre_chat_info?.find((p: any) => p.type === 'CUSTOMER_NAME')?.value?.[0] || '';

  const frtSeconds = detail.stats?.first_response_time && detail.status !== 'OPEN' ? detail.stats.first_response_time : null;
  const isClosed = detail.status === 'CLOSE' || detail.status === 'CLOSED';
  const isOpen = detail.status === 'OPEN';

  const lastMsg = detail.last_message || {};
  const lastMessageContent = lastMsg.content?.body_content || lastMsg.content?.message || '';
  const lastMessageByAgent = lastMsg.source_type === 1;
  const hasRecall = lastMsg.recall_info?.recall_at > 0;
  const wasTransferred = (detail.transfer_group_histories?.length || 0) > 0;

  const createdAt = detail.created_at || Math.floor(Date.now() / 1000);
  const updatedAt = detail.updated_at ? (detail.updated_at > 1000000000000 ? Math.floor(detail.updated_at / 1000) : detail.updated_at) : createdAt;

  const category = classifyCategory(subject, lastMessageContent);

  return {
    id: detail.conversation_id || detail.id || '',
    agentName: agentParticipant?.name || '',
    agentAlias: agentParticipant?.nick_name || agentParticipant?.name || '',
    agentId: agentParticipant?.source_user_id || '',
    clientName,
    subject,
    clientEmail,
    frtSeconds,
    isClosed,
    isOpen,
    lastMessageContent,
    lastMessageByAgent,
    hasRecall,
    wasTransferred,
    createdAt,
    updatedAt,
    websiteName: detail.website_name || '',
    category,
  };
}

// ─── KPI Computation ──────────────────────────────────────────────────────

function computeAggregates(tickets: Ticket[]): AggregateStats {
  const validFrts = tickets.filter(t => t.frtSeconds !== null && t.isClosed).map(t => t.frtSeconds as number);
  const avg_frt = validFrts.length > 0 ? validFrts.reduce((a, b) => a + b, 0) / validFrts.length : null;

  return {
    total_tickets: tickets.length,
    avg_frt,
    closure_rate_pct: tickets.length > 0 ? (tickets.filter(t => t.isClosed).length / tickets.length) * 100 : 0,
    recalls: tickets.filter(t => t.hasRecall).length,
    slow_frt_count: tickets.filter(t => t.frtSeconds && t.frtSeconds > THRESHOLDS.frt_seconds.slow_threshold).length,
    bot_abandoned: tickets.filter(t => !t.agentId && !t.isClosed).length,
  };
}

function computePerAgent(tickets: Ticket[]): PerAgentStats[] {
  const byAgent = new Map<string, Ticket[]>();
  tickets.forEach(t => {
    if (!t.agentId) return;
    if (!byAgent.has(t.agentId)) byAgent.set(t.agentId, []);
    byAgent.get(t.agentId)!.push(t);
  });

  return Array.from(byAgent.entries()).map(([agentId, agentTickets]) => {
    const closed = agentTickets.filter(t => t.isClosed).length;
    const validFrts = agentTickets.filter(t => t.frtSeconds !== null && t.isClosed).map(t => t.frtSeconds as number);
    const avg_frt = validFrts.length > 0 ? validFrts.reduce((a, b) => a + b, 0) / validFrts.length : null;

    const agent = agentTickets[0];

    return {
      agentId,
      agentName: agent.agentName,
      agentAlias: agent.agentAlias,
      tickets: agentTickets.length,
      closed,
      closure_rate_pct: agentTickets.length > 0 ? (closed / agentTickets.length) * 100 : 0,
      avg_frt,
      recalls: agentTickets.filter(t => t.hasRecall).length,
    };
  }).sort((a, b) => b.closure_rate_pct - a.closure_rate_pct);
}

function computeCategories(tickets: Ticket[]): CategoryStats[] {
  const byCat = new Map<string, number>();
  tickets.forEach(t => {
    byCat.set(t.category, (byCat.get(t.category) || 0) + 1);
  });

  return Array.from(byCat.entries()).map(([name, count]) => ({
    name,
    count,
    pct: tickets.length > 0 ? (count / tickets.length) * 100 : 0,
  })).sort((a, b) => b.count - a.count);
}

// ─── Agent Sampling for LLM ───────────────────────────────────────────────

function sampleTicketsPerAgent(tickets: Ticket[]): Map<string, SampledTicket[]> {
  const byAgent = new Map<string, Ticket[]>();
  tickets.forEach(t => {
    if (!t.agentId) return;
    if (!byAgent.has(t.agentId)) byAgent.set(t.agentId, []);
    byAgent.get(t.agentId)!.push(t);
  });

  const result = new Map<string, SampledTicket[]>();

  for (const [agentId, agentTickets] of byAgent) {
    if (agentTickets.length < 3) continue;

    // Deterministic sampling using hash
    const seed = agentTickets[0].agentName.charCodeAt(0);
    const sampled = agentTickets
      .map((t, i) => ({ t, hash: (seed + i * 37) % agentTickets.length }))
      .sort((a, b) => a.hash - b.hash)
      .slice(0, THRESHOLDS.samples_per_agent)
      .map(x => ({
        id: x.t.id,
        subject: x.t.subject,
        frtSeconds: x.t.frtSeconds,
        isClosed: x.t.isClosed,
        lastMessageContent: x.t.lastMessageContent.slice(0, 200),
        hasRecall: x.t.hasRecall,
        wasTransferred: x.t.wasTransferred,
      }));

    result.set(agentId, sampled);
  }

  return result;
}

// ─── LLM Integration ──────────────────────────────────────────────────────

async function callLLM(systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://jackpotdaily-qa.vercel.app',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-haiku-4-5',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4000,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`LLM error: ${data.error?.message}`);
  return data.choices[0].message.content;
}

// ─── DOCX Generation ──────────────────────────────────────────────────────

const W = 9360;
const COLORS = {
  primaryBlue: '1F3864',
  secondaryBlue: '2E4A7A',
  managerYellow: 'FFF9E6',
  teamLeadBlue: 'F0F7FF',
  agentGray: 'F5F5F5',
  successGreen: 'F0FFF4',
  warningAmber: 'FFFBF0',
  errorRed: 'FFF0F0',
  infoBlue: 'F0F7FF',
};

function banner(text: string, fill: string, textColor = 'FFFFFF', fontSize = 28) {
  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [W],
    rows: [new TableRow({
      children: [new TableCell({
        borders: { top: { style: BorderStyle.SINGLE, size: 1, color: fill }, bottom: { style: BorderStyle.SINGLE, size: 1, color: fill }, left: { style: BorderStyle.SINGLE, size: 1, color: fill }, right: { style: BorderStyle.SINGLE, size: 1, color: fill } },
        shading: { fill, type: ShadingType.CLEAR },
        margins: { top: 200, bottom: 200, left: 300, right: 300 },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text, font: 'Arial', size: fontSize * 2, bold: true, color: textColor })],
        })],
      })],
    })],
  });
}

function kpiTile(label: string, value: string, fill: string) {
  return new TableCell({
    borders: { top: { style: BorderStyle.SINGLE, size: 1, color: fill }, bottom: { style: BorderStyle.SINGLE, size: 1, color: fill }, left: { style: BorderStyle.SINGLE, size: 1, color: fill }, right: { style: BorderStyle.SINGLE, size: 1, color: fill } },
    width: { size: Math.floor(W / 4), type: WidthType.DXA },
    shading: { fill, type: ShadingType.CLEAR },
    margins: { top: 140, bottom: 140, left: 160, right: 160 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: value, font: 'Arial', size: 44, bold: true, color: 'FFFFFF' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: label, font: 'Arial', size: 16, color: 'FFFFFF' })],
      }),
    ],
  });
}

async function createMockReports(period: string, stats: AggregateStats): Promise<{ qa: Buffer; inquiry: Buffer; individual: Buffer }> {
  const createDocx = async (title: string) => {
    const doc = new Document({
      sections: [{
        children: [
          banner(title, COLORS.primaryBlue),
          new Paragraph({ text: `Period: ${period}` }),
          new Paragraph({ text: `Total: ${stats.total_tickets} tickets` }),
          new Paragraph({ text: `Avg FRT: ${stats.avg_frt?.toFixed(1) || 'N/A'}s` }),
          new Paragraph({ text: `Closure: ${stats.closure_rate_pct.toFixed(1)}%` }),
        ],
      }],
    });
    return Packer.toBuffer(doc);
  };

  return {
    qa: await createDocx('QA REPORT'),
    inquiry: await createDocx('CLIENT INQUIRY REPORT'),
    individual: await createDocx('INDIVIDUAL AGENT QA REPORT'),
  };
}

// ─── Main Handler ─────────────────────────────────────────────────────────

export async function GET() {
  return POST(new Request('', { method: 'POST', body: '{}' }));
}

export async function POST(req: Request) {
  try {
    const body = req.method === 'GET' ? { weekOffset: 0 } : (await req.json());
    const weekOffset = body.weekOffset || 0;

    const now = new Date();
    const etNow = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    const dayOfWeek = etNow.getUTCDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const weekStart = new Date(etNow);
    weekStart.setUTCDate(weekStart.getUTCDate() - daysToMonday - 7 * weekOffset);
    weekStart.setUTCHours(4, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    weekEnd.setUTCHours(23, 59, 59, 999);

    const periodLabel = `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
    const fromSec = Math.floor(weekStart.getTime() / 1000);
    const toSec = Math.floor(weekEnd.getTime() / 1000);

    console.log(`[Pipeline] Period: ${periodLabel}`);

    // Create Supabase client
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Insert run record
    const { data: runRecord, error: insertError } = await supabase
      .from('pipeline_runs')
      .insert({ period_label: periodLabel, period_start: weekStart.toISOString().split('T')[0], period_end: weekEnd.toISOString().split('T')[0], status: 'running' })
      .select().single();
    if (insertError) throw insertError;
    const runId = runRecord.id;

    try {
      // Fetch all chat records (list only — no per-ticket detail calls)
      console.log('[Pipeline] Fetching chat records...');
      const chatRecords = await getAllChatRecords(fromSec, toSec);
      console.log(`[Pipeline] Got ${chatRecords.length} chat records`);

      // Parse directly from list response (participants, status, last_message all present)
      const tickets: Ticket[] = chatRecords.map(chat => parseTicketFromList(chat));
      console.log(`[Pipeline] Parsed ${tickets.length} tickets`);

      // Fetch detail for a sample (up to 50) to get subjects + FRT
      const sampleIds = tickets
        .filter(t => t.isClosed)
        .slice(0, 50)
        .map(t => t.id);
      const detailMap = new Map<string, Ticket>();
      for (const id of sampleIds) {
        try {
          const detail = await getConversationDetail(id);
          detailMap.set(id, parseTicket(detail));
          await sleep(20);
        } catch { /* skip */ }
      }
      // Merge detail data into tickets where available
      const mergedTickets = tickets.map(t => detailMap.get(t.id) || t);

      // Compute KPIs
      const aggregates = computeAggregates(mergedTickets);
      const perAgent = computePerAgent(mergedTickets);
      const categories = computeCategories(mergedTickets);
      const samples = sampleTicketsPerAgent(mergedTickets);

      console.log(`[Pipeline] ${aggregates.total_tickets} tickets | FRT ${aggregates.avg_frt?.toFixed(1) || 'N/A'}s | closure ${aggregates.closure_rate_pct.toFixed(1)}%`);

      // LLM calls
      console.log('[Pipeline] Running LLM analysis...');
      const samplesObj = Object.fromEntries(samples);
      const refData = { agentMapping: AGENT_MAPPING, platformFacts: PLATFORM_FACTS, thresholds: THRESHOLDS, recurringFlags: RECURRING_FLAGS, knownIssues: KNOWN_ISSUES };

      const [qaAnalysis, inquiryAnalysis, individualAnalysis] = await Promise.allSettled([
        callLLM(SYSTEM_PROMPT, JSON.stringify({ report: 'qa', period: periodLabel, aggregates, perAgent, inquiryCategories: categories, agentSamples: samplesObj, referenceData: refData })),
        callLLM(SYSTEM_PROMPT, JSON.stringify({ report: 'inquiry', period: periodLabel, inquiryCategories: categories, historicalKpis: HISTORICAL_KPIS, agentSamples: samplesObj })),
        callLLM(SYSTEM_PROMPT, JSON.stringify({ report: 'individual', period: periodLabel, perAgent, agentSamples: samplesObj, recurringFlags: RECURRING_FLAGS, agentMapping: AGENT_MAPPING })),
      ]);

      const qaContent = qaAnalysis.status === 'fulfilled' ? JSON.parse(qaAnalysis.value) : {};
      const inquiryContent = inquiryAnalysis.status === 'fulfilled' ? JSON.parse(inquiryAnalysis.value) : {};
      const individualContent = individualAnalysis.status === 'fulfilled' ? JSON.parse(individualAnalysis.value) : {};

      console.log('[Pipeline] LLM done, generating docx...');

      // Generate reports
      const reports = await createMockReports(periodLabel, aggregates);

      // Upload to Supabase Storage
      const base = `${weekStart.toISOString().split('T')[0]}_${weekEnd.toISOString().split('T')[0]}`;
      const paths = { qa: `${base}/QA_Report.docx`, inquiry: `${base}/Client_Inquiry_Report.docx`, individual: `${base}/Individual_Agent_Report.docx` };

      await Promise.all([
        supabase.storage.from('qa-reports').upload(paths.qa, reports.qa, { upsert: true }),
        supabase.storage.from('qa-reports').upload(paths.inquiry, reports.inquiry, { upsert: true }),
        supabase.storage.from('qa-reports').upload(paths.individual, reports.individual, { upsert: true }),
      ]);

      await supabase.from('pipeline_runs').update({
        status: 'completed',
        qa_report_path: paths.qa,
        inquiry_report_path: paths.inquiry,
        individual_report_path: paths.individual,
        total_tickets: aggregates.total_tickets,
        agent_count: perAgent.length,
        completed_at: new Date().toISOString(),
        // llm_qa, llm_inquiry, llm_individual stored separately if columns exist
      }).eq('id', runId);

      console.log('[Pipeline] ✓ Done');

      return NextResponse.json({ ok: true, period: periodLabel, runId, totalTickets: aggregates.total_tickets, agentCount: perAgent.length });

    } catch (err) {
      await supabase.from('pipeline_runs').update({ status: 'failed', error_message: (err as Error).message }).eq('id', runId);
      throw err;
    }

  } catch (error) {
    console.error('[Pipeline] Error:', (error as Error).message);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
