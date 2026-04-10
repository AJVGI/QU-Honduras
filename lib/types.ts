export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface CategoryScore {
  score: number;
  notes: string;
}

export interface ChatScore {
  chat_id: string;
  agent_name: string;
  agent_id: string;
  timestamp: string;
  categories: {
    greeting: CategoryScore;
    issue_discovery: CategoryScore;
    resolution: CategoryScore;
    communication: CategoryScore;
    compliance: CategoryScore;
    closing: CategoryScore;
  };
  auto_fail: { triggered: boolean; reason: string | null };
  total_score: number;
  grade: Grade;
  summary: string;
  coaching_tip: string;
}

export interface Agent {
  id: string;
  name: string;
  chats: ChatScore[];
  avg_score: number;
  grade: Grade;
  trend: number;
}

export const CATEGORY_MAX: Record<string, number> = {
  greeting: 10,
  issue_discovery: 20,
  resolution: 30,
  communication: 20,
  compliance: 10,
  closing: 10,
};

export const CATEGORY_LABELS: Record<string, string> = {
  greeting: 'Greeting & Opening',
  issue_discovery: 'Issue Discovery',
  resolution: 'Resolution & Accuracy',
  communication: 'Communication Quality',
  compliance: 'Compliance & Policy',
  closing: 'Closing & Wrap-Up',
};
