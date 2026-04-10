import { Agent, ChatScore, Grade } from './types';
import { scoreToGrade } from './utils';

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
  const daysAgo = randomBetween(0, 30);
  const hoursAgo = randomBetween(0, 23);
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hoursAgo, randomBetween(0, 59), 0, 0);
  return d.toISOString();
}

function generateChat(agentId: string, agentName: string, chatIndex: number, isAutoFail = false): ChatScore {
  const issue = randomFrom(casinoIssues);
  const chatId = `JD-${agentId.toUpperCase()}-${String(chatIndex + 1).padStart(4, '0')}`;

  if (isAutoFail) {
    const failReasons = [
      'Agent exposed customer account number in chat',
      'Agent used abusive language toward customer',
      'Agent fabricated bonus policy not in knowledge base',
      'Agent issued unauthorized $50 credit without manager approval',
      'Agent abandoned chat without resolution or handoff',
    ];
    return {
      chat_id: chatId,
      agent_name: agentName,
      agent_id: agentId,
      timestamp: randomDateInLast30Days(),
      categories: {
        greeting: { score: 0, notes: 'Auto-fail override applied.' },
        issue_discovery: { score: 0, notes: 'Auto-fail override applied.' },
        resolution: { score: 0, notes: 'Auto-fail override applied.' },
        communication: { score: 0, notes: 'Auto-fail override applied.' },
        compliance: { score: 0, notes: 'Auto-fail override applied.' },
        closing: { score: 0, notes: 'Auto-fail override applied.' },
      },
      auto_fail: { triggered: true, reason: randomFrom(failReasons) },
      total_score: 0,
      grade: 'F',
      summary: 'Auto-fail condition triggered. Score overridden to 0.',
      coaching_tip: 'Immediate coaching session required. Review compliance and conduct policies.',
    };
  }

  // Generate scores based on agent skill level (passed via agentIndex logic in parent)
  const g = randomBetween(2, 10);
  const id = randomBetween(10, 20);
  const r = randomBetween(15, 30);
  const c = randomBetween(12, 20);
  const comp = randomBetween(6, 10);
  const cl = randomBetween(5, 10);
  const total = g + id + r + c + comp + cl;
  const grade = scoreToGrade(total);

  return {
    chat_id: chatId,
    agent_name: agentName,
    agent_id: agentId,
    timestamp: randomDateInLast30Days(),
    categories: {
      greeting: { score: g, notes: g >= 8 ? 'Professional greeting with personalization.' : 'Greeting lacked warmth or customer acknowledgment.' },
      issue_discovery: { score: id, notes: id >= 16 ? 'Asked clarifying questions and confirmed understanding.' : 'Jumped to solution without fully diagnosing the issue.' },
      resolution: { score: r, notes: issue.resolutionNotes },
      communication: { score: c, notes: c >= 17 ? 'Clear, concise, professional language throughout.' : 'Some jargon used; response length could be reduced.' },
      compliance: { score: comp, notes: comp >= 9 ? 'All disclosures and PII protocols followed correctly.' : 'Minor gap in required disclosure script.' },
      closing: { score: cl, notes: cl >= 8 ? 'Strong closing with summary and CSAT offer.' : 'Missed CSAT survey or did not summarize resolution.' },
    },
    auto_fail: { triggered: false, reason: null },
    total_score: total,
    grade,
    summary: randomFrom(summaries),
    coaching_tip: randomFrom(coachingTips),
  };
}

function calcAvg(chats: ChatScore[]): number {
  if (!chats.length) return 0;
  return Math.round(chats.reduce((sum, c) => sum + c.total_score, 0) / chats.length);
}

// Skill tiers: top performers, mid, struggling
const skillTiers: number[] = [
  90, 85, 88, 72, 65, 78, 91, 83, 69, 55,
  87, 74, 80, 62, 76, 93, 68, 81, 70, 58,
];

export const AGENTS: Agent[] = agentNames.map((name, i) => {
  const id = `agent-${String(i + 1).padStart(2, '0')}`;
  const chatCount = randomBetween(10, 30);
  const autoFailCount = i === 5 || i === 9 || i === 13 ? 1 : 0; // a few agents have auto-fails

  const chats: ChatScore[] = [];

  for (let j = 0; j < chatCount - autoFailCount; j++) {
    // Bias scores based on skill tier
    const raw = generateChat(id, name, j);
    // Adjust scores toward agent's skill level
    const bias = (skillTiers[i] - 75) / 100;
    const adjTotal = Math.min(100, Math.max(0, Math.round(raw.total_score + raw.total_score * bias)));
    const adjGrade = scoreToGrade(adjTotal);
    chats.push({ ...raw, total_score: adjTotal, grade: adjGrade });
  }

  for (let j = 0; j < autoFailCount; j++) {
    chats.push(generateChat(id, name, chatCount - autoFailCount + j, true));
  }

  // Sort by timestamp
  chats.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const avg = calcAvg(chats);
  const trend = randomBetween(-8, 12);

  return {
    id,
    name,
    chats,
    avg_score: avg,
    grade: scoreToGrade(avg),
    trend,
  };
});

export function getAgent(id: string): Agent | undefined {
  return AGENTS.find(a => a.id === id);
}

export function getChat(chatId: string): { chat: ChatScore; agent: Agent } | undefined {
  for (const agent of AGENTS) {
    const chat = agent.chats.find(c => c.chat_id === chatId);
    if (chat) return { chat, agent };
  }
  return undefined;
}

export function getTeamStats() {
  const allChats = AGENTS.flatMap(a => a.chats);
  const totalChats = allChats.length;
  const avgScore = Math.round(allChats.reduce((s, c) => s + c.total_score, 0) / totalChats);
  const autoFails = allChats.filter(c => c.auto_fail.triggered).length;
  const autoFailRate = Math.round((autoFails / totalChats) * 100);
  const topPerformer = [...AGENTS].sort((a, b) => b.avg_score - a.avg_score)[0];

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

  // Weekly trend — last 5 weeks
  const now = new Date('2026-04-10T18:00:00Z');
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
    return {
      week: `W${5 - wi}`,
      avg: wAvg,
    };
  }).reverse();

  return { totalChats, avgScore, autoFailRate, topPerformer, gradeCounts, catAvgPct, weeklyTrend };
}
