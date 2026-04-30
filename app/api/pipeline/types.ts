/**
 * Shared types for the QA pipeline
 */

export interface Ticket {
  id: string;
  conversationId: string;
  visitor: string;
  agents: string[];
  primaryAgent: string | null;
  startTime: string;
  frtSeconds: number | null;
  content: string;
  category: string;
  isHumanHandled: boolean;
  isBotOnly: boolean;
  isClosedByAgent: boolean;
  isClosedVisitorLeft: boolean;
  isClosedInactivity: boolean;
  hasRecall: boolean;
  recallCount: number;
  isSlowFrt: boolean;
  isBotAbandoned: boolean;
}

export interface AgentStats {
  agent: string;
  total: number;
  closed: number;
  closurePct: number;
  recalls: number;
  visitorLeft: number;
  avgFrtSeconds: number | null;
}

export interface AggregateStats {
  totalTickets: number;
  avgFrtSeconds: number;
  medianFrtSeconds: number;
  closedByAgentCount: number;
  closedByAgentPct: number;
  visitorLeftCount: number;
  visitorLeftPct: number;
  recallCount: number;
  slowFrtCount: number;
  slowFrtPct: number;
  botAbandonedCount: number;
  botAbandonedPct: number;
}

export interface LLMInput {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  aggregateStats: AggregateStats;
  perAgentStats: AgentStats[];
  inquiryCategoryCounts: Record<string, number>;
  agentTicketSamples: Record<string, { ticket: Ticket; content: string }[]>;
  systemPrompt: string;
  references: {
    agentMapping: unknown;
    platformFacts: unknown;
    thresholds: unknown;
    inquiryKeywords: unknown;
    knownIssues: unknown;
    recurringFlags: unknown;
  };
}

export interface LLMOutput {
  qaReportContent: unknown;
  inquiryReportContent: unknown;
  individualReportContent: unknown;
}

export interface PipelineRun {
  id: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  qaReportPath: string | null;
  inquiryReportPath: string | null;
  individualReportPath: string | null;
  totalTickets: number | null;
  agentCount: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}
