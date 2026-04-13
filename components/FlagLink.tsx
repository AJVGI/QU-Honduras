'use client';
import Link from 'next/link';

export type FlagType = 'auto_fail' | 'needs_improvement' | 'poor' | 'coaching' | 'issue';

const FLAG_CONFIG: Record<FlagType, { icon: string; label: string; color: string }> = {
  auto_fail:         { icon: '🚨', label: 'Auto-Fail',       color: 'text-red-400 border-red-500/30 bg-red-500/10' },
  poor:              { icon: '❌', label: 'Poor',            color: 'text-red-400 border-red-500/20 bg-red-500/10' },
  needs_improvement: { icon: '⚠️', label: 'Needs Work',      color: 'text-amber-400 border-amber-500/20 bg-amber-500/10' },
  coaching:          { icon: '💡', label: 'Coaching Tip',    color: 'text-blue-400 border-blue-500/20 bg-blue-500/10' },
  issue:             { icon: '🔴', label: 'Issue Flagged',   color: 'text-orange-400 border-orange-500/20 bg-orange-500/10' },
};

interface FlagLinkProps {
  chatId: string;
  /** msg_id from message_analysis, e.g. "MSG-03". Links to that anchor in the chat. */
  msgId?: string;
  type: FlagType;
  reason?: string;
  /** Show inline label */
  showLabel?: boolean;
  className?: string;
}

/**
 * Clickable flag that links directly to a specific message in a chat transcript.
 * If msgId is provided, links to /chat/[chatId]#MSG-03
 * Otherwise links to /chat/[chatId]
 */
export function FlagLink({ chatId, msgId, type, reason, showLabel = false, className = '' }: FlagLinkProps) {
  const cfg = FLAG_CONFIG[type];
  const href = msgId
    ? `/chat/${encodeURIComponent(chatId)}#msg-${msgId.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
    : `/chat/${encodeURIComponent(chatId)}`;

  return (
    <Link
      href={href}
      title={reason || cfg.label}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold transition-opacity hover:opacity-80 ${cfg.color} ${className}`}
    >
      <span>{cfg.icon}</span>
      {showLabel && <span>{cfg.label}</span>}
      {reason && !showLabel && <span className="max-w-[140px] truncate">{reason}</span>}
    </Link>
  );
}

/**
 * Inline "View in chat →" link that jumps to a specific message.
 */
export function ChatJumpLink({
  chatId,
  msgId,
  label = 'View →',
  className = '',
}: {
  chatId: string;
  msgId?: string;
  label?: string;
  className?: string;
}) {
  const href = msgId
    ? `/chat/${encodeURIComponent(chatId)}#msg-${msgId.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
    : `/chat/${encodeURIComponent(chatId)}`;

  return (
    <Link href={href} className={`text-xs text-blue-400 hover:text-blue-300 font-medium ${className}`}>
      {label}
    </Link>
  );
}
