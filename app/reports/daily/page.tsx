'use client';
import { useMemo } from 'react';
import { AGENTS } from '@/lib/dataLoader';
import { gradeColor } from '@/lib/utils';
import { GradeBadge } from '@/components/GradeBadge';
import { AgentLink } from '@/components/AgentLink';
import { FlagLink, ChatJumpLink } from '@/components/FlagLink';

export default function DailyReport() {
  const todayChats = useMemo(() => {
    const today = new Date().toISOString().substring(0, 10);
    // Fall back to most recent day with data if no chats today
    const allChats = AGENTS.flatMap(a => a.chats.map(c => ({ ...c, agent: a })));
    const todayFiltered = allChats.filter(c => c.timestamp.startsWith(today));
    if (todayFiltered.length > 0) return todayFiltered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    // Show most recent day
    const sorted = allChats.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    if (sorted.length === 0) return [];
    const latestDay = sorted[0].timestamp.substring(0, 10);
    return sorted.filter(c => c.timestamp.startsWith(latestDay));
  }, []);

  const latestDay = todayChats.length > 0 ? todayChats[0].timestamp.substring(0, 10) : null;
  const avgScore = todayChats.length > 0
    ? Math.round(todayChats.reduce((s, c) => s + c.total_score, 0) / todayChats.length)
    : 0;
  const autoFails = todayChats.filter(c => c.auto_fail.triggered).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">📅 Daily Report</h1>
        <p className="text-slate-400 text-sm mt-1">
          {latestDay ? new Date(latestDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'No data'}
        </p>
      </div>

      {/* Summary */}
      {todayChats.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4 text-center">
            <div className="text-2xl font-black text-white">{todayChats.length}</div>
            <div className="text-xs text-slate-400 mt-1">Chats Scored</div>
          </div>
          <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4 text-center">
            <div className="text-2xl font-black" style={{ color: gradeColor(avgScore >= 90 ? 'A' : avgScore >= 80 ? 'B' : avgScore >= 70 ? 'C' : avgScore >= 60 ? 'D' : 'F') }}>{avgScore}</div>
            <div className="text-xs text-slate-400 mt-1">Avg Score</div>
          </div>
          <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4 text-center">
            <div className={`text-2xl font-black ${autoFails > 0 ? 'text-red-400' : 'text-green-400'}`}>{autoFails}</div>
            <div className="text-xs text-slate-400 mt-1">Auto-Fails</div>
          </div>
        </div>
      )}

      {/* Table */}
      {todayChats.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📭</div>
          <div className="text-white font-semibold">No chats scored today yet</div>
          <div className="text-slate-400 text-sm mt-2">The realtime watcher scores new chats every 5 minutes.</div>
        </div>
      ) : (
        <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl overflow-hidden">
          {/* Mobile card list */}
          <div className="block md:hidden divide-y divide-slate-700/30">
            {todayChats.map((chat, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <GradeBadge grade={chat.grade} />
                    <span className="font-mono font-bold text-sm" style={{ color: gradeColor(chat.grade) }}>{chat.total_score}</span>
                    <span className="text-xs text-slate-400 font-mono">{new Date(chat.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <ChatJumpLink chatId={chat.chat_id} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <AgentLink agentId={chat.agent.id} agentName={chat.agent_name} />
                  {chat.website && <span className="text-xs text-slate-500">{chat.website}</span>}
                  {chat.auto_fail.triggered && <FlagLink chatId={chat.chat_id} type="auto_fail" reason={chat.auto_fail.reason || 'Auto-fail'} showLabel />}
                </div>
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#2D1B4E]/30">
                <tr>
                  {['Time', 'Agent', 'Score', 'Grade', 'Website', 'Auto-Fail', ''].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {todayChats.map((chat, i) => (
                  <tr key={i} className="hover:bg-[#2D1B4E]/15 transition-colors">
                    <td className="py-3 px-4 text-sm text-slate-400 font-mono">{new Date(chat.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="py-3 px-4">
                      <AgentLink agentId={chat.agent.id} agentName={chat.agent_name} />
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-sm" style={{ color: gradeColor(chat.grade) }}>{chat.total_score}</td>
                    <td className="py-3 px-4"><GradeBadge grade={chat.grade} /></td>
                    <td className="py-3 px-4 text-xs text-slate-400">{chat.website || '—'}</td>
                    <td className="py-3 px-4">
                      {chat.auto_fail.triggered
                        ? <FlagLink chatId={chat.chat_id} type="auto_fail" reason={chat.auto_fail.reason || 'Auto-fail'} showLabel />
                        : <span className="text-xs text-slate-500">—</span>}
                    </td>
                    <td className="py-3 px-4"><ChatJumpLink chatId={chat.chat_id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
