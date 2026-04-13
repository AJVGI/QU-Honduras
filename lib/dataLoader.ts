/**
 * Data Loader — switches between real scored data and mock data.
 * Reads from realData.json if it exists and has scored chats,
 * otherwise falls back to generated mock data.
 */

import { Agent, ChatScore, Grade } from './types';
import { scoreToGrade } from './utils';

// Try to import real data (will fail gracefully if not present)
let realData: { agents: Agent[]; chats: ChatScore[]; scored_at: string; total_chats: number } | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = require('./realData.json');
  if (raw?.agents?.length > 0) {
    realData = raw;
  }
} catch (_e) {
  // No real data yet — use mock
}

// ─── Mock Data (fallback) ─────────────────────────────────────────────────────

const agentNames = [
  'Carlos Mejía', 'María López', 'José Hernández', 'Ana Reyes', 'Luis Flores',
  'Rosa Martínez', 'Diego Amador', 'Sofía Núñez', 'Andrés Paz', 'Valeria Ruiz',
  'Fernando Castillo', 'Gabriela Soto', 'Ricardo Banegas', 'Patricia Villanueva',
  'Marcos Pineda', 'Elena Orellana', 'Javier Aguilar', 'Claudia Zelaya',
  'Omar Lara', 'Natalia Espinal',
];

const casinoIssues = [
  { topic: 'Deposit Not Showing', resolutionNotes: 'Agent confirmed deposit via payment gateway and escalated to payments team.' },
  { topic: 'Withdrawal Pending', resolutionNotes: 'Agent verified KYC status and informed 3-5 business day processing time.' },
  { topic: 'Bonus Not Credited', resolutionNotes: 'Agent checked bonus eligibility and manually triggered bonus credit.' },
  { topic: 'Account Verification', resolutionNotes: 'Agent guided customer through document upload for KYC verification.' },
  { topic: 'Login Issues', resolutionNotes: 'Agent reset password and confirmed account access restored.' },
  { topic: 'Game Crash / Technical Issue', resolutionNotes: 'Agent logged incident, offered courtesy credit, escalated to tech team.' },
  { topic: 'Responsible Gaming Limit', resolutionNotes: 'Agent applied deposit limit per customer request and confirmed policy.' },
  { topic: 'Promo Code Not Working', resolutionNotes: 'Agent verified code validity and reapplied promotion manually.' },
  { topic: 'Account Locked / Suspended', resolutionNotes: 'Agent verified identity and escalated to compliance for review.' },
  { topic: 'Wrong Balance Shown', resolutionNotes: 'Agent refreshed account balance and confirmed correct amount.' },
];

const coachingTips = [
  'Ask clarifying questions before jumping to solutions — confirm the exact amount and payment method first.',
  'Always paraphrase the customer\'s issue back to them before providing the solution.',
  'Use the standard closing script: "Is there anything else I can help you with today?"',
  'Avoid jargon like "KYC" — explain it as "identity verification" for customer clarity.',
  'When escalating, give the customer a reference number and expected timeframe.',
  'Shorten responses — customers prefer concise answers over paragraphs.',
  'Always offer the CSAT survey link at the close of each resolved chat.',
  'Document follow-up actions in the ticket before closing the chat.',
  'Confirm the customer\'s name at the start of every interaction.',
  'Never speculate about processing times — always reference the official policy.',
];

const summaries = [
  'Agent handled the interaction professionally with strong issue discovery but could improve closing procedures.',
  'Excellent performance across all categories — customer left satisfied with a complete resolution.',
  'Agent resolved the issue correctly but missed the CSAT survey and failed to summarize the resolution.',
  'Below-average performance — agent jumped to solution without asking clarifying questions.',
  'Strong communication skills demonstrated; minor compliance gap noted in disclosure script.',
  'Agent escalated appropriately when issue was outside their scope. Documentation was thorough.',
  'Response quality was good but message length was excessive for a simple inquiry.',
  'Issue was resolved in first contact with professional tone throughout the interaction.',
  'Agent showed good empathy but the solution provided was partially incorrect per current policy.',
  'Solid performance overall; coaching recommended on active listening and paraphrasing techniques.',
];

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDateInLast30Days(): string {
  const now = new Date('2026-04-10T18:00:00Z');
  const offset = Math.random() * 30 * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - offset).toISOString();
}

function generateChatScore(agentName: string, agentId: string, chatIndex: number): ChatScore {
  const baseScore = randomBetween(55, 98);
  const variance = () => randomBetween(-8, 8);
  const issue = randomFrom(casinoIssues);

  const greeting = Math.min(10, Math.max(0, Math.round((baseScore / 100) * 10 + variance())));
  const issue_discovery = Math.min(20, Math.max(0, Math.round((baseScore / 100) * 20 + variance() * 1.5)));
  const resolution = Math.min(30, Math.max(0, Math.round((baseScore / 100) * 30 + variance() * 2)));
  const communication = Math.min(20, Math.max(0, Math.round((baseScore / 100) * 20 + variance() * 1.5)));
  const compliance = Math.min(10, Math.max(0, Math.round((baseScore / 100) * 10 + variance())));
  const closing = Math.min(10, Math.max(0, Math.round((baseScore / 100) * 10 + variance())));

  const total_score = greeting + issue_discovery + resolution + communication + compliance + closing;
  const grade = scoreToGrade(total_score);
  const autoFail = total_score < 45 && Math.random() < 0.3;

  return {
    chat_id: `MOCK-${agentId}-${chatIndex.toString().padStart(4, '0')}`,
    agent_name: agentName,
    agent_id: agentId,
    timestamp: randomDateInLast30Days(),
    categories: {
      greeting: { score: greeting, notes: `Greeting score: ${greeting}/10` },
      issue_discovery: { score: issue_discovery, notes: issue.topic },
      resolution: { score: resolution, notes: issue.resolutionNotes },
      communication: { score: communication, notes: 'Communication quality assessed.' },
      compliance: { score: compliance, notes: 'Compliance check completed.' },
      closing: { score: closing, notes: 'Closing interaction reviewed.' },
    },
    auto_fail: { triggered: autoFail, reason: autoFail ? 'Score below auto-fail threshold' : null },
    total_score,
    grade,
    summary: randomFrom(summaries),
    coaching_tip: randomFrom(coachingTips),
  };
}

function generateMockAgents(): Agent[] {
  return agentNames.map((name, idx) => {
    const agentId = name.toLowerCase().replace(/\s+/g, '_').replace(/[áéíóú]/g, c =>
      ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' }[c] || c));
    const chatCount = randomBetween(10, 30);
    const chats: ChatScore[] = Array.from({ length: chatCount }, (_, ci) =>
      generateChatScore(name, agentId, idx * 100 + ci));
    const scores = chats.map(c => c.total_score);
    const avg_score = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    const grade = scoreToGrade(avg_score);
    const trend = randomBetween(-8, 12);
    return { id: agentId, name, chats, avg_score, grade, trend };
  });
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export const IS_REAL_DATA = realData !== null;
export const DATA_TIMESTAMP = realData?.scored_at || null;

// All raw chats (flat, across all agents)
export const ALL_CHATS: ChatScore[] = realData
  ? realData.agents.flatMap((a: Agent) => a.chats)
  : generateMockAgents().flatMap(a => a.chats);

export const AGENTS: Agent[] = realData ? realData.agents : generateMockAgents();

export function getAgent(agentId: string): Agent | undefined {
  return AGENTS.find(a => a.id === agentId);
}

export function getChat(chatId: string): { chat: ChatScore; agent: Agent } | undefined {
  for (const agent of AGENTS) {
    const chat = agent.chats.find(c => c.chat_id === chatId);
    if (chat) return { chat, agent };
  }
  return undefined;
}

// ─── Date Filtering ───────────────────────────────────────────────────────────

export interface DateRange {
  from?: Date;
  to?: Date;
  day?: string; // 'YYYY-MM-DD'
}

export function filterChatsByDate(chats: ChatScore[], range: DateRange): ChatScore[] {
  if (!range.from && !range.to && !range.day) return chats;

  return chats.filter(c => {
    const d = new Date(c.timestamp);
    if (range.day) {
      const chatDay = d.toISOString().slice(0, 10);
      return chatDay === range.day;
    }
    if (range.from && d < range.from) return false;
    if (range.to && d > range.to) return false;
    return true;
  });
}

export function getAgentsByDateRange(range: DateRange): Agent[] {
  if (!range.from && !range.to && !range.day) return AGENTS;

  return AGENTS.map(agent => {
    const filteredChats = filterChatsByDate(agent.chats, range);
    if (filteredChats.length === 0) return null;
    const scores = filteredChats.map(c => c.total_score);
    const avg_score = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    const grade = avg_score >= 90 ? 'A' : avg_score >= 80 ? 'B' : avg_score >= 70 ? 'C' : avg_score >= 60 ? 'D' : 'F';
    return { ...agent, chats: filteredChats, avg_score, grade } as Agent;
  }).filter(Boolean) as Agent[];
}

// Get all unique days that have chat data
export function getAvailableDays(): string[] {
  const days = new Set<string>();
  ALL_CHATS.forEach(c => {
    days.add(new Date(c.timestamp).toISOString().slice(0, 10));
  });
  return Array.from(days).sort().reverse();
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function getTeamStats(chatsOverride?: ChatScore[], agentsOverride?: Agent[]) {
  const allChats = chatsOverride || AGENTS.flatMap(a => a.chats);
  const agents = agentsOverride || AGENTS;
  const totalChats = allChats.length;
  if (totalChats === 0) return null;

  const avgScore = Math.round(allChats.reduce((s, c) => s + c.total_score, 0) / totalChats);
  const autoFails = allChats.filter(c => c.auto_fail.triggered).length;
  const autoFailRate = Math.round((autoFails / totalChats) * 100);
  const topPerformer = [...agents].sort((a, b) => b.avg_score - a.avg_score)[0];

  const gradeCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  allChats.forEach(c => { gradeCounts[c.grade]++; });

  const catTotals: Record<string, number> = {
    greeting: 0, issue_discovery: 0, resolution: 0,
    communication: 0, compliance: 0, closing: 0,
  };
  const catMaxes: Record<string, number> = {
    greeting: 10, issue_discovery: 20, resolution: 30,
    communication: 20, compliance: 10, closing: 10,
  };
  allChats.forEach(c => {
    Object.keys(catTotals).forEach(k => {
      catTotals[k] += c.categories[k as keyof typeof c.categories].score;
    });
  });
  const catAvgPct = Object.keys(catTotals).map(k => ({
    category: k,
    avg: Math.round((catTotals[k] / totalChats / catMaxes[k]) * 100),
  }));

  const now = new Date();
  const weeklyTrend = Array.from({ length: 5 }, (_, wi) => {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - wi * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);
    const weekChats = allChats.filter(c => {
      const d = new Date(c.timestamp);
      return d >= weekStart && d < weekEnd;
    });
    const wAvg = weekChats.length
      ? Math.round(weekChats.reduce((s, c) => s + c.total_score, 0) / weekChats.length)
      : null;
    return { week: `W${5 - wi}`, avg: wAvg };
  }).reverse();

  return { totalChats, avgScore, autoFailRate, topPerformer, gradeCounts, catAvgPct, weeklyTrend };
}
