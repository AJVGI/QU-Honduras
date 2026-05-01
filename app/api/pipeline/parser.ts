/**
 * Ticket parsing and KPI computation
 */

import { Ticket, AgentStats, TeamAggregates, InquiryCategory } from './types';

const SKIP_AGENTS = new Set(['Bot', '-2147483648', '', 'xtractadmin01']);

const INQUIRY_CATEGORIES: Array<[string, string[]]> = [
  ['Verification / KYC', ['verif', 'kyc', 'identity', 'not verified', 'verify my']],
  ['Redemption / Withdrawal', ['redeem', 'redemption', 'withdraw', 'cash out', 'payout', 'cant redeem']],
  ['Welcome / Sign-up Bonus', ['welcome bonus', 'sign up bonus', 'signup bonus', 'sign in bonus']],
  ['Login / Account Access', ['log in', 'login', 'cant log', 'locked out', 'password', 'unable to log']],
  ['Location / State', ['location', 'state', 'virginia', 'restricted state', 'not available', 'geo']],
  ['Promotions / Bonuses', ['promo', 'promotion', 'bonus', 'free gc', 'free sc', 'golden egg']],
  ['Coins / Balance / Purchase', ['sweepstake', 'balance', 'purchase', 'bought', 'missing coins']],
  ['Referral', ['referral', 'refer', 'referral code']],
  ['Technical / Platform', ['not working', 'error', 'bug', 'glitch', 'cant load', 'frozen', 'crash']],
  ['VIP / Loyalty', ['vip', 'loyalty', 'tier', 'level up']],
];

export function classifyTicket(content: string): {
  is_closed_by_agent: boolean;
  is_closed_visitor_left: boolean;
  is_closed_inactivity: boolean;
  has_recall: boolean;
  recall_count: number;
} {
  return {
    is_closed_by_agent: content.includes('Closed - by agent'),
    is_closed_visitor_left: content.includes('Closed - visitor left'),
    is_closed_inactivity:
      content.includes('Closed - 10 min inactivity') || content.includes('Closed - inactivity'),
    has_recall: content.includes('recalled the message'),
    recall_count: (content.match(/recalled the message/g) || []).length,
  };
}

export function getPrimaryAgent(participatedAgentField: string): string | null {
  if (!participatedAgentField) return null;
  const agents = participatedAgentField
    .split(',')
    .map(s => s.trim())
    .filter(a => !SKIP_AGENTS.has(a));
  return agents.length > 0 ? agents[0] : null;
}

export function parseFrt(frtField: string | undefined | null): number | null {
  if (!frtField || frtField.trim() === '') return null;
  const n = parseInt(frtField, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function categorizeTicket(subject: string, content: string): string {
  const haystack = (subject + ' ' + content.slice(0, 400)).toLowerCase();
  for (const [name, keywords] of INQUIRY_CATEGORIES) {
    if (keywords.length === 0) return name;
    if (keywords.some(k => haystack.includes(k))) return name;
  }
  return 'General Inquiry';
}

export function parseTicketFromWellyDetail(
  conversationId: string,
  agents: string[],
  startTime: string,
  frt: number | null,
  messages: Array<{ content: string; created_at?: number }>,
  visitorName: string
): Ticket {
  const content = messages.map(m => m.content || '').join('\n');
  const classification = classifyTicket(content);
  const primary_agent = getPrimaryAgent(agents.join(','));
  const is_human_handled = !!primary_agent;
  const is_bot_only = !is_human_handled;
  const is_bot_abandoned = is_bot_only && classification.is_closed_visitor_left;

  return {
    id: conversationId,
    visitor: visitorName || 'Unknown visitor',
    agents,
    primary_agent,
    start_time: startTime,
    frt_seconds: frt,
    content,
    category: categorizeTicket('', content),
    is_human_handled,
    is_bot_only,
    is_closed_by_agent: classification.is_closed_by_agent,
    is_closed_visitor_left: classification.is_closed_visitor_left,
    is_closed_inactivity: classification.is_closed_inactivity,
    has_recall: classification.has_recall,
    recall_count: classification.recall_count,
    is_slow_frt: frt !== null && frt > 300,
    is_bot_abandoned,
  };
}

export function computeAggregates(tickets: Ticket[]): TeamAggregates {
  const total = tickets.length;
  const frts = tickets.map(t => t.frt_seconds).filter(n => n !== null) as number[];
  const avg_frt = frts.length > 0 ? frts.reduce((a, b) => a + b, 0) / frts.length : 0;

  return {
    total_tickets: total,
    avg_frt_seconds: avg_frt,
    closure_pct: total > 0 ? (tickets.filter(t => t.is_closed_by_agent).length / total) * 100 : 0,
    recalls: tickets.reduce((sum, t) => sum + t.recall_count, 0),
    slow_frt_pct: total > 0 ? (tickets.filter(t => t.is_slow_frt).length / total) * 100 : 0,
    bot_abandoned_pct:
      total > 0 ? (tickets.filter(t => t.is_bot_abandoned).length / total) * 100 : 0,
    visitor_left_pct:
      total > 0 ? (tickets.filter(t => t.is_closed_visitor_left).length / total) * 100 : 0,
  };
}

export function computePerAgent(tickets: Ticket[]): AgentStats[] {
  const byAgent = new Map<string, AgentStats>();

  for (const t of tickets) {
    if (!t.primary_agent) continue;

    if (!byAgent.has(t.primary_agent)) {
      byAgent.set(t.primary_agent, {
        agent: t.primary_agent,
        total: 0,
        closed: 0,
        closure_pct: 0,
        recalls: 0,
        visitor_left: 0,
        avg_frt_seconds: null,
        frts: [],
      });
    }
    const a = byAgent.get(t.primary_agent)!;
    a.total += 1;
    if (t.is_closed_by_agent) a.closed += 1;
    if (t.has_recall) a.recalls += 1;
    if (t.is_closed_visitor_left) a.visitor_left += 1;
    if (t.frt_seconds !== null) a.frts.push(t.frt_seconds);
  }

  const result: AgentStats[] = [];
  for (const [, stats] of byAgent) {
    stats.closure_pct = stats.total > 0 ? (stats.closed / stats.total) * 100 : 0;
    stats.avg_frt_seconds = stats.frts.length > 0 ? stats.frts.reduce((a, b) => a + b, 0) / stats.frts.length : null;
    result.push(stats);
  }

  return result.sort((a, b) => b.closure_pct - a.closure_pct);
}

export function computeInquiryCategories(tickets: Ticket[]): InquiryCategory[] {
  const total = tickets.length;
  const byCategory = new Map<string, number>();

  for (const t of tickets) {
    byCategory.set(t.category, (byCategory.get(t.category) || 0) + 1);
  }

  const result: InquiryCategory[] = [];
  for (const [name, count] of byCategory) {
    result.push({
      name,
      count,
      pct_of_total: total > 0 ? (count / total) * 100 : 0,
    });
  }

  return result.sort((a, b) => b.count - a.count);
}

export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let random = seed;
  for (let i = result.length - 1; i > 0; i--) {
    random = (random * 9301 + 49297) % 233280;
    const j = Math.floor((random / 233280) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export function sampleTicketsForAgent(tickets: Ticket[], agent: string, n: number = 7): Ticket[] {
  const agentTickets = tickets.filter(t => t.agents.includes(agent));
  const seed = hashCode(agent);
  const shuffled = seededShuffle(agentTickets, seed);
  return shuffled.slice(0, n);
}

export function trimContent(content: string, maxChars: number = 2000): string {
  return content.length > maxChars ? content.slice(0, maxChars) + '\n[...truncated]' : content;
}
