'use client';
import Link from 'next/link';
import { useMemo, useEffect, useState } from 'react';

interface Agent {
  agent_name: string;
  agent_alias: string;
  tickets: number;
  closed: number;
  closure_pct: number;
  avg_frt_seconds: number | null;
  recalls: number;
  week_start: string;
}

interface Week {
  week_start: string;
  week_end: string;
  completed_at: string;
}

export default function WeeklyReport() {
  const [thisWeekAgents, setThisWeekAgents] = useState<Agent[]>([]);
  const [lastWeekAgents, setLastWeekAgents] = useState<Agent[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch weeks and agents on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Get weeks
        const weeksRes = await fetch('/api/data/weeks');
        const weeksData = await weeksRes.json();
        const allWeeks = weeksData.weeks || [];
        setWeeks(allWeeks);

        // Get this week
        if (allWeeks.length > 0) {
          const thisWeekStart = allWeeks[0].week_start;
          const thisRes = await fetch(`/api/data/agents?week_start=${thisWeekStart}`);
          const thisData = await thisRes.json();
          setThisWeekAgents(thisData.agents || []);

          // Get last week
          if (allWeeks.length > 1) {
            const lastWeekStart = allWeeks[1].week_start;
            const lastRes = await fetch(`/api/data/agents?week_start=${lastWeekStart}`);
            const lastData = await lastRes.json();
            setLastWeekAgents(lastData.agents || []);
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Build comparison report
  const report = useMemo(() => {
    return thisWeekAgents.map(agent => {
      const lastAgent = lastWeekAgents.find(a => a.agent_name === agent.agent_name);
      const closureChange = lastAgent 
        ? (agent.closure_pct - lastAgent.closure_pct).toFixed(1)
        : null;
      const frtChange = (agent.avg_frt_seconds && lastAgent?.avg_frt_seconds)
        ? (agent.avg_frt_seconds - lastAgent.avg_frt_seconds).toFixed(1)
        : null;

      return {
        agent,
        lastAgent,
        closureChange,
        frtChange,
      };
    }).sort((a, b) => parseFloat(b.closureChange || '0') - parseFloat(a.closureChange || '0'));
  }, [thisWeekAgents, lastWeekAgents]);

  const stats = useMemo(() => ({
    totalTickets: thisWeekAgents.reduce((s, a) => s + a.tickets, 0),
    avgClosure: thisWeekAgents.length > 0
      ? (thisWeekAgents.reduce((s, a) => s + a.closure_pct, 0) / thisWeekAgents.length).toFixed(1)
      : '0',
  }), [thisWeekAgents]);

  const formatFRT = (seconds: number | null) => {
    if (seconds === null) return 'N/A';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    return `${(seconds / 60).toFixed(1)}m`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">📈 Weekly Report</h1>
        <p className="text-slate-400 text-sm mt-1">Week-over-week agent performance · Closure %, FRT, Recalls</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading agents...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4 text-center">
              <div className="text-2xl font-black text-white">{stats.totalTickets}</div>
              <div className="text-xs text-slate-400 mt-1">Total Tickets This Week</div>
            </div>
            <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4 text-center">
              <div className="text-2xl font-black text-green-400">{stats.avgClosure}%</div>
              <div className="text-xs text-slate-400 mt-1">Team Avg Closure %</div>
            </div>
          </div>

          <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl overflow-hidden">
            {report.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">📊</div>
                <div className="text-slate-400">No agents with data for this week.</div>
              </div>
            ) : (
              <>
                {/* Mobile card list */}
                <div className="block md:hidden divide-y divide-slate-700/30">
                  {report.map(({ agent, lastAgent, closureChange, frtChange }) => (
                    <div key={agent.agent_name} className="px-4 py-3 space-y-2">
                      <div>
                        <Link href={`/agent/${agent.agent_name}`} className="text-sm font-semibold text-white hover:text-[#E91E8C] truncate block">
                          {agent.agent_name}
                        </Link>
                        <div className="text-xs text-slate-400 mt-1">{agent.agent_alias}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-slate-400">Closure %</div>
                          <div className="text-white font-bold">{agent.closure_pct.toFixed(1)}%</div>
                          {closureChange && (
                            <div className={parseFloat(closureChange) > 0 ? 'text-green-400' : 'text-red-400'}>
                              {parseFloat(closureChange) > 0 ? '+' : ''}{closureChange}%
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-slate-400">Avg FRT</div>
                          <div className="text-white font-bold">{formatFRT(agent.avg_frt_seconds)}</div>
                          {frtChange && (
                            <div className={parseFloat(frtChange) < 0 ? 'text-green-400' : 'text-red-400'}>
                              {parseFloat(frtChange) < 0 ? '' : '+'}{frtChange}s
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-slate-400">
                        {agent.tickets} tickets · {agent.recalls} recalls
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#2D1B4E]/30">
                      <tr>
                        {[
                          'Agent',
                          'This Week Closure %',
                          'Last Week Closure %',
                          'Change',
                          'Avg FRT',
                          'Tickets',
                          'Recalls',
                        ].map(h => (
                          <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/30">
                      {report.map(({ agent, lastAgent, closureChange, frtChange }) => (
                        <tr key={agent.agent_name} className="hover:bg-[#2D1B4E]/15 transition-colors">
                          <td className="py-3 px-4">
                            <div>
                              <Link href={`/agent/${agent.agent_name}`} className="text-sm font-semibold text-white hover:text-[#E91E8C]">
                                {agent.agent_name}
                              </Link>
                              <div className="text-xs text-slate-400">{agent.agent_alias}</div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-sm text-green-400">
                            {agent.closure_pct.toFixed(1)}%
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-400 font-mono">
                            {lastAgent ? `${lastAgent.closure_pct.toFixed(1)}%` : '—'}
                          </td>
                          <td className="py-3 px-4">
                            {closureChange ? (
                              <span className={`text-sm font-bold ${parseFloat(closureChange) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {parseFloat(closureChange) > 0 ? '↑' : '↓'} {Math.abs(parseFloat(closureChange))}%
                              </span>
                            ) : (
                              <span className="text-slate-500 text-xs">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-300">
                            {formatFRT(agent.avg_frt_seconds)}
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-300">{agent.tickets}</td>
                          <td className="py-3 px-4 text-sm text-slate-300">
                            {agent.recalls > 0 ? <span className="text-red-400">🔔 {agent.recalls}</span> : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
