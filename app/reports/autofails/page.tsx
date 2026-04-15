'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { AGENTS } from '@/lib/dataLoader';
import { gradeColor, formatDate } from '@/lib/utils';
import { GradeBadge } from '@/components/GradeBadge';
import { AgentLink } from '@/components/AgentLink';
import { FlagLink, ChatJumpLink } from '@/components/FlagLink';

export default function AutoFailsReport() {
  const grouped = useMemo(() => {
    const result: { agent: typeof AGENTS[0]; fails: (typeof AGENTS[0]['chats'][0])[] }[] = [];
    for (const agent of AGENTS) {
      const fails = agent.chats
        .filter(c => c.auto_fail.triggered)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      if (fails.length > 0) result.push({ agent, fails });
    }
    return result.sort((a, b) => b.fails.length - a.fails.length);
  }, []);

  const totalFails = grouped.reduce((s, g) => s + g.fails.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">🚨 Auto-Fail Report</h1>
        <p className="text-slate-400 text-sm mt-1">All chats that triggered auto-fail conditions · {totalFails} total</p>
      </div>

      {grouped.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">✅</div>
          <div className="text-white font-semibold text-lg">No Auto-Fails!</div>
          <div className="text-slate-400 text-sm mt-2">Great job team — no auto-fail conditions triggered.</div>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ agent, fails }) => (
            <div key={agent.id} className="bg-[#1e293b] border border-red-500/30 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between gap-2 flex-wrap px-5 py-4 bg-red-900/10 border-b border-red-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 font-black text-sm">
                    {fails.length}
                  </div>
                  <AgentLink agentId={agent.id} agentName={agent.name} grade={agent.grade} showGrade />
                </div>
                <span className="text-xs text-red-400 font-semibold">{fails.length} auto-fail{fails.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-slate-700/30">
                {fails.map((chat, i) => (
                  <div key={i} className="flex items-start gap-4 px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <span className="text-xs text-slate-400">{formatDate(chat.timestamp)}</span>
                        <GradeBadge grade={chat.grade} />
                        <span className="font-mono font-bold text-sm" style={{ color: gradeColor(chat.grade) }}>{chat.total_score}</span>
                      </div>
                      <p className="text-sm text-red-300">{chat.auto_fail.reason || 'Auto-fail condition triggered'}</p>
                      {chat.summary && <p className="text-xs text-slate-500 mt-1 truncate">{chat.summary}</p>}
                    </div>
                    <ChatJumpLink chatId={chat.chat_id} label="View Chat →" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
