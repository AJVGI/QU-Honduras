/**
 * Core types for the QA pipeline
 */

export interface WellyChat {
  conversation_id: string;
  participants: WellyParticipant[];
  status: string;
  updated_at: number;
  created_at: number;
  website_name: string;
  first_response_time?: number;
}

export interface WellyParticipant {
  source_type: string;
  source_user_id: string;
  name: string;
  nick_name: string;
  chat_user_id: string;
}

export interface WellyConversationDetail {
  code: number;
  data: {
    conversation_id: string;
    participants: WellyParticipant[];
    messages: WellyMessage[];
    status: string;
    created_at: number;
    updated_at: number;
  };
}

export interface WellyMessage {
  id: string;
  content: string;
  from_user_id: string;
  created_at: number;
  message_type: string;
  from_name?: string;
}

export interface Ticket {
  id: string;
  welly_conversation_id?: string;
  visitor: string;
  agents: string[];
  primary_agent: string | null;
  start_time: string;
  frt_seconds: number | null;
  content: string;
  category: string;
  is_human_handled: boolean;
  is_bot_only: boolean;
  is_closed_by_agent: boolean;
  is_closed_visitor_left: boolean;
  is_closed_inactivity: boolean;
  has_recall: boolean;
  recall_count: number;
  is_slow_frt: boolean;
  is_bot_abandoned: boolean;
  is_closed?: boolean;
  grade?: string;
  score?: number;
  auto_fail?: boolean;
  coaching_tip?: string;
}

export interface AgentStats {
  agent: string;
  total: number;
  closed: number;
  closure_pct: number;
  recalls: number;
  visitor_left: number;
  avg_frt_seconds: number | null;
  frts: number[];
}

export interface TeamAggregates {
  total_tickets: number;
  avg_frt_seconds: number;
  closure_pct: number;
  recalls: number;
  slow_frt_pct: number;
  bot_abandoned_pct: number;
  visitor_left_pct: number;
}

export interface InquiryCategory {
  name: string;
  count: number;
  pct_of_total: number;
}

export interface PipelineReport {
  period_label: string;
  period_start: string;
  period_end: string;
  generated_at: string;
  team_aggregates: TeamAggregates;
  per_agent_stats: AgentStats[];
  inquiry_categories: InquiryCategory[];
  sampled_tickets: Record<string, Ticket[]>;
}

export interface ReportIndex {
  periods: Array<{
    label: string;
    start: string;
    end: string;
    generated_at: string;
    files: {
      qa_report: string;
      inquiry_report: string;
      agent_report: string;
    };
  }>;
  last_updated: string;
}
