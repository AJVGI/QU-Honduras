'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getChat } from '@/lib/mockData';
import { gradeColor, gradeBg, formatDate } from '@/lib/utils';
import { CATEGORY_LABELS, CATEGORY_MAX } from '@/lib/types';
import { GradeBadge } from '@/components/GradeBadge';

export default function ChatDetail() {
  const { id } = useParams<{ id: string }>();
  const result = getChat(decodeURIComponent(id));

  if (!result) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Chat not found.</div>
      </div>
    );
  }

  const { chat, agent } = result;
  const categories = Object.keys(CATEGORY_LABELS);

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
              <h1 className="text-xl font-black text-white font-mono">{chat.chat_id}</h1>
              <GradeBadge grade={chat.grade} size="lg" />
              {chat.auto_fail.triggered && (
                <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold px-2 py-0.5 rounded-md">
                  AUTO-FAIL
                </span>
              )}
            </div>
            <p className="text-slate-400 text-sm">
              Agent: <Link href={`/agent/${agent.id}`} className="text-blue-400 hover:text-blue-300">{chat.agent_name}</Link>
              {' · '}{formatDate(chat.timestamp)}
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
            <div className="text-red-400/60 text-xs mt-1">Score overridden to 0. Immediate review required.</div>
          </div>
        </div>
      )}

      {/* Summary + Coaching Tip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-2">📋 QA Summary</h2>
          <p className="text-slate-300 text-sm leading-relaxed">{chat.summary}</p>
        </div>
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-blue-400 mb-2">💡 Coaching Tip</h2>
          <p className="text-slate-300 text-sm leading-relaxed">{chat.coaching_tip}</p>
        </div>
      </div>

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
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${chat.auto_fail.triggered ? 0 : pct}%`,
                      background: barColor,
                    }}
                  />
                </div>
                <div className="text-xs text-slate-400">{cat.notes}</div>
              </div>
            );
          })}
        </div>

        {/* Total Row */}
        <div className="p-5 bg-slate-800/50 border-t border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="font-bold text-white">Total Score</div>
            <div className="flex items-center gap-3">
              <div className="w-48 h-3 bg-slate-700 rounded-full">
                <div
                  className="h-3 rounded-full"
                  style={{
                    width: `${chat.total_score}%`,
                    background: gradeColor(chat.grade),
                  }}
                />
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

      {/* Transcript Placeholder */}
      <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-5 text-center">
        <div className="text-slate-500 text-sm">
          📄 <span className="font-medium">Transcript viewer</span> — connect your chat platform to view the original transcript for {chat.chat_id}
        </div>
      </div>
    </div>
  );
}
