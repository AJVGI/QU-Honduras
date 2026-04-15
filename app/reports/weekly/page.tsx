'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { AGENTS } from '@/lib/dataLoader';
import { gradeColor } from '@/lib/utils';
import { GradeBadge } from '@/components/GradeBadge';
import { Grade } from '@/lib/types';

export default function WeeklyReport() {
  const report = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7); weekStart.setHours(0,0,0,0);
    const prevWeekStart = new Date(now); prevWeekStart.setDate(now.getDate() - 14); prevWeekStart.setHours(0,0,0,0);

    return AGENTS.map(agent => {
      const thisWeek = agent.chats.filter(c => new Date(c.timestamp) >= weekStart);
      const prevWeek = agent.chats.filter(c => new Date(c.timestamp) >= prevWeekStart && new Date(c.timestamp) < weekStart);
      const thisAvg = thisWeek.length ? Math.round(thisWeek.reduce((s, c) => s + c.total_score, 0) / thisWeek.length) : null;
      const prevAvg = prevWeek.length ? Math.round(prevWeek.reduce((s, c) => s + c.total_score, 0) / prevWeek.length) : null;
      const change = thisAvg !== null && prevAvg !== null ? thisAvg - prevAvg : null;
      const autoFails = thisWeek.filter(c => c.auto_fail.triggered).length;
      return { agent, thisWeek: thisWeek.length, thisAvg, prevAvg, change, autoFails };
    }).sort((a, b) => (b.change ?? -99) - (a.change ?? -99));
  }, []);

  const totalThisWeek = report.reduce((s, r) => s + r.thisWeek, 0);
  const avgThisWeek = report.filter(r => r.thisAvg !== null).length > 0
    ? Math.round(report.filter(r => r.thisAvg !== null).reduce((s, r) => s + (r.thisAvg ?? 0), 0) / report.filter(r => r.thisAvg !== null).length)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">📈 Weekly Report</h1>
        <p className="text-slate-400 text-sm mt-1">Week-over-week agent performance · Last 7 days vs previous 7 days</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-white">{totalThisWeek}</div>
          <div className="text-xs text-slate-400 mt-1">Chats This Week</div>
        </div>
        <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4 text-center">
          <div className="text-2xl font-black" style={{ color: gradeColor(avgThisWeek >= 90 ? 'A' : avgThisWeek >= 80 ? 'B' : avgThisWeek >= 70 ? 'C' : avgThisWeek >= 60 ? 'D' : 'F') }}>{avgThisWeek || '—'}</div>
          <div className="text-xs text-slate-400 mt-1">Team Avg This Week</div>
        </div>
      </div>

      <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl overflow-hidden">
        {/* Mobile card list */}
        <div className="block md:hidden divide-y divide-slate-700/30">
          {report.map(({ agent, thisWeek, thisAvg, prevAvg, change, autoFails }) => (
            <div key={agent.id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <Link href={`/agent/${agent.id}`} className="text-sm font-semibold text-white hover:text-[#E91E8C] truncate block">{agent.name}</Link>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {change !== null ? (
                    <span className={`text-xs font-bold ${change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                      {change > 0 ? '↑' : change < 0 ? '↓' : '→'}{Math.abs(change)} WoW
                    </span>
                  ) : null}
                  <span className="text-xs text-slate-400">{thisWeek} chats</span>
                  {autoFails > 0 && <span className="text-xs text-red-400">🚨 {autoFails}</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-mono font-bold text-sm" style={{ color: thisAvg ? gradeColor(thisAvg >= 90 ? 'A' : thisAvg >= 80 ? 'B' : thisAvg >= 70 ? 'C' : thisAvg >= 60 ? 'D' : 'F') : '#64748b' }}>{thisAvg ?? '—'}</div>
                <GradeBadge grade={agent.grade} />
              </div>
            </div>
          ))}
        </div>
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#2D1B4E]/30">
              <tr>
                {['Agent', 'This Week Avg', 'Last Week Avg', 'Change', 'Grade', 'Chats', 'Auto-Fails'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {report.map(({ agent, thisWeek, thisAvg, prevAvg, change, autoFails }) => (
                <tr key={agent.id} className="hover:bg-[#2D1B4E]/15 transition-colors">
                  <td className="py-3 px-4">
                    <Link href={`/agent/${agent.id}`} className="text-sm font-semibold text-white hover:text-[#E91E8C]">{agent.name}</Link>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-sm" style={{ color: thisAvg ? gradeColor(thisAvg >= 90 ? 'A' : thisAvg >= 80 ? 'B' : thisAvg >= 70 ? 'C' : thisAvg >= 60 ? 'D' : 'F') : '#64748b' }}>
                    {thisAvg ?? '—'}
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-400 font-mono">{prevAvg ?? '—'}</td>
                  <td className="py-3 px-4">
                    {change !== null ? (
                      <span className={`text-sm font-bold ${change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                        {change > 0 ? '↑' : change < 0 ? '↓' : '→'} {Math.abs(change)}
                      </span>
                    ) : <span className="text-slate-500 text-xs">No prior data</span>}
                  </td>
                  <td className="py-3 px-4"><GradeBadge grade={agent.grade} /></td>
                  <td className="py-3 px-4 text-sm text-slate-300">{thisWeek}</td>
                  <td className="py-3 px-4">{autoFails > 0 ? <span className="text-xs text-red-400">🚨 {autoFails}</span> : <span className="text-xs text-slate-500">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalThisWeek === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📊</div>
            <div className="text-slate-400">No chats scored this week yet.</div>
          </div>
        )}
      </div>
    </div>
  );
}
