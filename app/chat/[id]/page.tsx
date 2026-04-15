'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getChat } from '@/lib/dataLoader';
import { gradeColor, gradeBg, formatDate } from '@/lib/utils';
import { CATEGORY_LABELS, CATEGORY_MAX, MessageAnalysis, MessageRating } from '@/lib/types';
import { GradeBadge } from '@/components/GradeBadge';
import { AgentLink } from '@/components/AgentLink';
import { FlagLink } from '@/components/FlagLink';

const RATING_CONFIG: Record<MessageRating, { label: string; color: string; bg: string; icon: string }> = {
  excellent:         { label: 'Excellent',         color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/30',  icon: '✅' },
  good:              { label: 'Good',              color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30',    icon: '👍' },
  needs_improvement: { label: 'Needs Work',        color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/30',  icon: '⚠️' },
  poor:              { label: 'Poor',              color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30',      icon: '❌' },
  na:                { label: 'Customer',          color: 'text-slate-400',  bg: 'bg-slate-700/30 border-slate-600/30',  icon: '💬' },
};

const TAG_COLORS: Record<string, string> = {
  greeting:    'bg-purple-500/20 text-purple-300',
  empathy:     'bg-pink-500/20 text-pink-300',
  jargon:      'bg-red-500/20 text-red-300',
  policy:      'bg-orange-500/20 text-orange-300',
  closing:     'bg-indigo-500/20 text-indigo-300',
  resolution:  'bg-green-500/20 text-green-300',
  discovery:   'bg-cyan-500/20 text-cyan-300',
  tone:        'bg-yellow-500/20 text-yellow-300',
};

function MessageCard({ msg, index }: { msg: MessageAnalysis; index: number }) {
  const isAgent = msg.speaker === 'AGENT';
  const isCustomer = msg.speaker === 'CUSTOMER';
  const cfg = RATING_CONFIG[msg.rating] || RATING_CONFIG.na;
  const anchorId = `msg-${msg.msg_id.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

  if (isCustomer) {
    return (
      <div id={anchorId} className="flex gap-3 scroll-mt-24">
        <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 mt-1">
          <span className="text-xs">👤</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-emerald-400">CUSTOMER</span>
            {msg.timestamp && <span className="text-xs font-mono text-slate-500">{msg.timestamp}</span>}
            <a href={`#${anchorId}`} className="text-xs font-mono text-slate-600 hover:text-slate-400">#{msg.msg_id}</a>
          </div>
          <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-xl rounded-tl-sm px-4 py-3">
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{cleanText(msg.text)}</p>
          </div>
        </div>
      </div>
    );
  }

  // Agent message — full analysis card
  return (
    <div id={anchorId} className="flex gap-3 scroll-mt-24">
      <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0 mt-1">
        <span className="text-xs">🎧</span>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-bold text-blue-400">AGENT</span>
          {msg.timestamp && <span className="text-xs font-mono text-slate-500">{msg.timestamp}</span>}
          <a href={`#${anchorId}`} className="text-xs font-mono text-slate-600 hover:text-slate-400">#{msg.msg_id}</a>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${cfg.bg} ${cfg.color}`}>
            {cfg.icon} {cfg.label}
          </span>
          <div className="flex gap-1 flex-wrap">
            {(msg.tags || []).slice(0, 4).map(tag => (
              <span key={tag} className={`text-xs px-1.5 py-0.5 rounded ${TAG_COLORS[tag] || 'bg-slate-600/50 text-slate-300'}`}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className={`border rounded-xl rounded-tl-sm overflow-hidden ${cfg.bg}`}>
          <div className="px-4 py-3">
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{cleanText(msg.text)}</p>
          </div>

          {(msg.positives?.length > 0 || msg.issues?.length > 0 || msg.suggestion) && (
            <div className="px-4 py-3 bg-slate-900/40 border-t border-slate-700/30 space-y-2">
              {msg.positives?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-green-400 mb-1">✓ What worked</div>
                  {msg.positives.map((p, i) => (
                    <div key={i} className="text-xs text-slate-300 flex gap-2">
                      <span className="text-green-500 mt-0.5 flex-shrink-0">•</span>{p}
                    </div>
                  ))}
                </div>
              )}
              {msg.issues?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-red-400 mb-1">✗ Issues</div>
                  {msg.issues.map((issue, i) => (
                    <div key={i} className="text-xs text-slate-300 flex gap-2">
                      <span className="text-red-500 mt-0.5 flex-shrink-0">•</span>{issue}
                    </div>
                  ))}
                </div>
              )}
              {msg.suggestion && (
                <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg px-3 py-2">
                  <div className="text-xs font-semibold text-blue-400 mb-1">💡 Better response</div>
                  <p className="text-xs text-slate-300 leading-relaxed italic">&ldquo;{msg.suggestion}&rdquo;</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Strip HTML from message text (WellyTalk pre-chat forms send HTML)
function cleanText(raw: string): string {
  if (!raw || !raw.includes('<')) return raw;
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}

export default function ChatDetail() {
  const { id } = useParams<{ id: string }>();
  const result = getChat(decodeURIComponent(id));

  // Scroll to anchor hash on mount (for deep-linked flags)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const el = document.querySelector(window.location.hash);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    }
  }, []);

  if (!result) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Chat not found.</div>
      </div>
    );
  }

  const { chat, agent } = result;
  const categories = Object.keys(CATEGORY_LABELS);
  const hasMessageAnalysis = chat.message_analysis && chat.message_analysis.length > 0;

  const agentMessages = chat.message_analysis?.filter(m => m.speaker === 'AGENT') || [];
  const ratingCounts = agentMessages.reduce((acc, m) => {
    acc[m.rating] = (acc[m.rating] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back */}
      <Link
        href={`/agent/${agent.id}`}
        className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
      >
        ← Back to {agent.name}
      </Link>

      {/* Header */}
      <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-xl font-black text-white font-mono text-sm">{chat.chat_id.substring(0, 20)}…</h1>
              <GradeBadge grade={chat.grade} size="lg" />
              {chat.auto_fail.triggered && (
                <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold px-2 py-0.5 rounded-md">
                  🚨 AUTO-FAIL
                </span>
              )}
              {hasMessageAnalysis && (
                <span className="bg-purple-500/20 text-purple-400 border border-purple-500/30 text-xs px-2 py-0.5 rounded-md">
                  🔬 Deep Analysis
                </span>
              )}
            </div>
            <p className="text-slate-400 text-sm flex items-center gap-2 flex-wrap">
              <span>Agent:</span>
              <AgentLink agentId={agent.id} agentName={chat.agent_name} grade={agent.grade} showGrade />
              {chat.website && <span>· {chat.website}</span>}
              <span>·</span><span>{formatDate(chat.timestamp)}</span>
              {chat.message_count && <span>· {chat.message_count} messages</span>}
            </p>
          </div>
          <div className="text-center">
            <div className="text-5xl font-black" style={{ color: gradeColor(chat.grade) }}>
              {chat.total_score}
            </div>
            <div className="text-xs text-slate-400">out of 100</div>
          </div>
        </div>
      </div>

      {/* Auto-Fail Banner */}
      {chat.auto_fail.triggered && (
        <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-4 flex items-start gap-3">
          <span className="text-2xl">🚨</span>
          <div>
            <div className="font-bold text-red-400">Auto-Fail Condition Triggered</div>
            <div className="text-red-300/80 text-sm mt-1">{chat.auto_fail.reason}</div>
          </div>
        </div>
      )}

      {/* Summary + Coaching */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-2">📋 QA Summary</h2>
          <p className="text-slate-300 text-sm leading-relaxed">{chat.summary}</p>
        </div>
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-blue-400 mb-2">💡 Top Coaching Tip</h2>
          <p className="text-slate-300 text-sm leading-relaxed">{chat.coaching_tip}</p>
        </div>
      </div>

      {/* Strengths & Weaknesses (Opus only) */}
      {((chat.strengths?.length ?? 0) > 0 || (chat.weaknesses?.length ?? 0) > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(chat.strengths?.length ?? 0) > 0 && (
            <div className="bg-green-900/10 border border-green-500/20 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-green-400 mb-3">💪 Strengths</h2>
              <ul className="space-y-1.5">
                {(chat.strengths ?? []).map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-300">
                    <span className="text-green-400 mt-0.5">✓</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(chat.weaknesses?.length ?? 0) > 0 && (
            <div className="bg-red-900/10 border border-red-500/20 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-red-400 mb-3">🎯 Areas to Improve</h2>
              <ul className="space-y-1.5">
                {(chat.weaknesses ?? []).map((w, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-300">
                    <span className="text-red-400 mt-0.5">✗</span>{w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Message Rating Summary (Opus only) */}
      {hasMessageAnalysis && (
        <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Message Rating Breakdown</h2>
          <div className="flex gap-3 flex-wrap">
            {(['excellent','good','needs_improvement','poor'] as MessageRating[]).map(r => {
              const count = ratingCounts[r] || 0;
              const cfg = RATING_CONFIG[r];
              return (
                <div key={r} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${cfg.bg}`}>
                  <span>{cfg.icon}</span>
                  <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                  <span className={`text-sm font-black ${cfg.color}`}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Scorecard */}
      <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-700/50">
          <h2 className="text-sm font-semibold text-slate-300">Category Scorecard</h2>
        </div>
        <div className="divide-y divide-slate-700/30">
          {categories.map(k => {
            const cat = chat.categories[k as keyof typeof chat.categories];
            const max = CATEGORY_MAX[k];
            const pct = Math.round((cat.score / max) * 100);
            const barColor = pct >= 80 ? '#22c55e' : pct >= 70 ? '#3b82f6' : pct >= 60 ? '#f59e0b' : '#ef4444';
            return (
              <div key={k} className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-white text-sm">{CATEGORY_LABELS[k]}</div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-lg" style={{ color: barColor }}>
                      {chat.auto_fail.triggered ? 0 : cat.score}
                    </span>
                    <span className="text-slate-500 text-sm">/ {max}</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-slate-700 rounded-full mb-2">
                  <div className="h-2 rounded-full transition-all"
                    style={{ width: `${chat.auto_fail.triggered ? 0 : pct}%`, background: barColor }} />
                </div>
                <div className="text-xs text-slate-400">{cat.notes}</div>
              </div>
            );
          })}
        </div>
        <div className="p-5 bg-slate-800/50 border-t border-slate-700/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="font-bold text-white">Total Score</div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-32 sm:w-48 h-3 bg-slate-700 rounded-full">
                <div className="h-3 rounded-full"
                  style={{ width: `${chat.total_score}%`, background: gradeColor(chat.grade) }} />
              </div>
              <span className="font-mono font-black text-2xl" style={{ color: gradeColor(chat.grade) }}>
                {chat.total_score}
              </span>
              <span className="text-slate-500">/ 100</span>
              <GradeBadge grade={chat.grade} size="lg" />
            </div>
          </div>
        </div>
      </div>

      {/* Full Conversation Transcript (raw) */}
      {chat.raw_transcript && (
        <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-700/50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-300">💬 Full Conversation</h2>
              <p className="text-xs text-slate-500 mt-0.5">Complete customer + agent transcript</p>
            </div>
          </div>
          <div className="divide-y divide-slate-700/20">
            {chat.raw_transcript.split('\n').filter(Boolean).map((line, i) => {
              const isAgent = line.includes(`] ${chat.agent_name}:`);
              // Match both 24hr [HH:MM:SS] and 12hr [HH:MM:SS AM/PM] formats
              const tsMatch = line.match(/^\[([\d:]+ ?(?:AM|PM)?)\] ([^:]+): (.+)/);
              const ts = tsMatch?.[1] || '';
              const speaker = tsMatch?.[2] || '';
              const text = tsMatch?.[3] || line;
              return (
                <div key={i} className={`flex gap-3 px-5 py-3 ${isAgent ? 'bg-slate-800/20' : ''}`}>
                  <div className="w-24 flex-shrink-0 text-xs text-slate-500 font-mono pt-0.5">{ts}</div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-bold mb-1 ${isAgent ? 'text-blue-400' : 'text-emerald-400'}`}>
                      {isAgent ? '🎧' : '👤'} {speaker}
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{cleanText(text)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-Message Breakdown */}
      {hasMessageAnalysis ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white">🔬 Per-Message Training Breakdown</h2>
            <span className="text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-1 rounded">
              Powered by Claude Opus
            </span>
          </div>
          <p className="text-slate-400 text-sm">
            Every message annotated with what worked, what didn&apos;t, and exactly how to improve it.
          </p>
          <div className="space-y-3">
            {chat.message_analysis!.map((msg, i) => (
              <MessageCard key={i} msg={msg} index={i} />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-blue-900/10 border border-blue-500/20 rounded-xl p-6 text-center space-y-2">
          <div className="text-2xl">⏳</div>
          <div className="text-white font-semibold">Per-Message Breakdown Pending</div>
          <div className="text-slate-400 text-sm">
            This chat is in the scoring queue. Full per-message breakdown will appear automatically once processed.
          </div>
          <div className="text-xs text-blue-400 mt-1">Deep scoring runs automatically in batches — check back shortly.</div>
        </div>
      )}
    </div>
  );
}
