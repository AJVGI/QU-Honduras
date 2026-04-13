'use client';
import Link from 'next/link';
import { Grade } from '@/lib/types';
import { gradeColor } from '@/lib/utils';
import { GradeBadge } from './GradeBadge';

interface AgentLinkProps {
  agentId: string;
  agentName: string;
  grade?: Grade;
  avgScore?: number;
  /** Show inline grade badge */
  showGrade?: boolean;
  /** Extra classes */
  className?: string;
}

/**
 * Clickable agent name — links to /agent/[id].
 * Used everywhere: leaderboards, chat headers, flags, activity feeds.
 */
export function AgentLink({ agentId, agentName, grade, avgScore, showGrade, className = '' }: AgentLinkProps) {
  return (
    <Link
      href={`/agent/${agentId}`}
      className={`inline-flex items-center gap-1.5 font-semibold text-white hover:text-blue-400 transition-colors group ${className}`}
    >
      <span className="group-hover:underline underline-offset-2">{agentName}</span>
      {showGrade && grade && <GradeBadge grade={grade} />}
      {avgScore !== undefined && (
        <span className="text-xs font-mono" style={{ color: gradeColor(grade || 'F') }}>
          {avgScore}
        </span>
      )}
    </Link>
  );
}
