'use client';
import Link from 'next/link';
import { useMemo, useEffect, useState } from 'react';

interface AgentRow {
  id: string;
  agent_name: string;
  agent_alias: string;
  tickets: number;
  closed: number;
  closure_pct: number;
  avg_frt_seconds: number | null;
  recalls: number;
  week_start: string;
}

interface TicketSummary {
  id: string;
  agent_name: string;
  auto_fail: boolean;
  has_recall: boolean;
  category: string;
  is_closed: boolean;
}

function fmt(s: number | null): string {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function getGrade(closure: number): string {
  if (closure >= 90) return 'A';
  if (closure >= 75) return 'B';
  if (closure >= 60) return 'C';
  if (closure >= 45) return 'D';
  return 'F';
}

function getGradeColor(grade: string): string {
  const colors: Record<string, string> = {
    'A': '#10b981',
    'B': '#14b8a6',
    'C': '#eab308',
    'D': '#f97316',
    'F': '#ef4444',
  };
  return colors[grade] || '#94a3b8';
}

function StatCard({ label, value, icon, color }: {
  label: string; value: string | number; icon: string; color?: string;
}) {
  return (
    <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4 glow-panel">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</div>
          <div className="text-2xl font-black" style={color ? { color } : {}}>{value}</div>
        </div>
      </div>
    </div>
  );
}

export default function WeeklyReportPage() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekPeriod, setWeekPeriod] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Get agents data
        const agentsRes = await fetch('/api/data/agents');
        const agentsData = await agentsRes.json();
        const agentsList = agentsData.agents || [];
        setAgents(agentsList);

        // Extract week period for display
        if (agentsList.length > 0) {
          const weekStart = agentsList[0].week_start;
          const startDate = new Date(weekStart);
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 6);
          setWeekPeriod(
            `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
          );
        }

        // Get tickets data
        const ticketsRes = await fetch('/api/data/tickets?limit=2000');
        const ticketsData = ticketsRes.ok ? await ticketsRes.json() : { tickets: [] };
        setTickets(ticketsData.tickets || []);
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate stats
  const stats = useMemo(() => {
    const totalTickets = tickets.length;
    const recalls = tickets.filter(t => t.has_recall).length;
    const avgClosure = agents.length > 0
      ? (agents.reduce((sum, a) => sum + a.closure_pct, 0) / agents.length).toFixed(1)
      : '0';

    const avgFrt = agents.filter(a => a.avg_frt_seconds !== null).length > 0
      ? agents.reduce((sum, a) => sum + (a.avg_frt_seconds || 0), 0) /
        agents.filter(a => a.avg_frt_seconds !== null).length
      : null;

    return {
      totalTickets,
      avgClosure,
      avgFrt,
      recalls,
    };
  }, [tickets, agents]);

  // Build leaderboard with grades
  const leaderboard = useMemo(() => {
    return agents
      .sort((a, b) => b.closure_pct - a.closure_pct)
      .map((agent, index) => ({
        rank: index + 1,
        ...agent,
        grade: getGrade(agent.closure_pct),
      }));
  }, [agents]);

  // Grade distribution
  const gradeDistribution = useMemo(() => {
    const dist = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    leaderboard.forEach(a => {
      dist[a.grade as keyof typeof dist]++;
    });
    return dist;
  }, [leaderboard]);

  // Top issues (auto_fail)
  const topIssues = useMemo(() => {
    const byAgent = new Map<string, number>();
    tickets.forEach(t => {
      if (t.auto_fail) {
        byAgent.set(t.agent_name, (byAgent.get(t.agent_name) || 0) + 1);
      }
    });
    return Array.from(byAgent.entries())
      .map(([name, count]) => ({ agent_name: name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [tickets]);

  // Recall leaders
  const recallLeaders = useMemo(() => {
    const byAgent = new Map<string, number>();
    tickets.forEach(t => {
      if (t.has_recall) {
        byAgent.set(t.agent_name, (byAgent.get(t.agent_name) || 0) + 1);
      }
    });
    return Array.from(byAgent.entries())
      .map(([name, count]) => ({ agent_name: name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [tickets]);

  // Category breakdown
  const categories = useMemo(() => {
    const byCategory = new Map<string, number>();
    tickets.forEach(t => {
      byCategory.set(t.category, (byCategory.get(t.category) || 0) + 1);
    });
    return Array.from(byCategory.entries())
      .map(([cat, count]) => ({ category: cat, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [tickets]);

  const maxCategoryCount = categories.length > 0 ? categories[0].count : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white">Weekly Report</h1>
        <p className="text-slate-400 text-sm mt-1">
          {weekPeriod ? `${weekPeriod} • Honduras Team` : 'Honduras Team'}
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading report...</div>
      ) : (
        <>
          {/* Row 1: KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Tickets" value={stats.totalTickets} icon="📊" color="#E91E8C" />
            <StatCard label="Team Avg Closure %" value={`${stats.avgClosure}%`} icon="✅" color="#10b981" />
            <StatCard label="Team Avg FRT" value={fmt(stats.avgFrt)} icon="⏱️" color="#14b8a6" />
            <StatCard label="Total Recalls" value={stats.recalls} icon="🔔" color={stats.recalls > 0 ? '#ef4444' : '#10b981'} />
          </div>

          {/* Row 2: Leaderboard + Health Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* LEFT: Agent Leaderboard (60%) */}
            <div className="lg:col-span-2 bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl overflow-hidden glow-panel">
              <div className="px-5 py-3 border-b border-[#7B2D8B]/20 bg-[#2D1B4E]/30">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Agent Leaderboard</h3>
              </div>

              {/* Mobile */}
              <div className="block lg:hidden divide-y divide-slate-700/30">
                {leaderboard.map((agent) => (
                  <Link
                    key={agent.agent_name}
                    href={`/all-chats?agent=${agent.agent_name}`}
                    className="px-4 py-3 hover:bg-[#2D1B4E]/15 transition-colors block"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-400">#{agent.rank}</span>
                      <span className="text-sm font-semibold text-white flex-1">{agent.agent_name}</span>
                      <span
                        className="text-xs px-2 py-0.5 rounded font-bold"
                        style={{ backgroundColor: getGradeColor(agent.grade) + '20', color: getGradeColor(agent.grade) }}
                      >
                        {agent.grade}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 grid grid-cols-3 gap-2">
                      <div>{agent.tickets} tickets</div>
                      <div>{agent.closure_pct.toFixed(1)}%</div>
                      <div>{fmt(agent.avg_frt_seconds)}</div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#2D1B4E]/30">
                    <tr>
                      {['Rank', 'Agent Name', 'Tickets', 'Closure %', 'Avg FRT', 'Grade'].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {leaderboard.map((agent) => {
                      const isTopThree = agent.rank <= 3;
                      const isBottomThree = agent.rank > leaderboard.length - 3 && leaderboard.length >= 3;
                      const borderColor = isTopThree
                        ? agent.rank === 1 ? '#FFD600' : agent.rank === 2 ? '#C0C0C0' : '#CD7F32'
                        : 'transparent';

                      return (
                        <tr
                          key={agent.agent_name}
                          className="hover:bg-[#2D1B4E]/20 transition-colors"
                          style={{
                            backgroundColor: isBottomThree ? 'rgba(239, 68, 68, 0.05)' : undefined,
                            borderLeftColor: borderColor,
                            borderLeftWidth: isTopThree ? 3 : 0,
                          }}
                        >
                          <td className="py-3 px-4 text-sm font-bold text-white">{agent.rank}</td>
                          <td className="py-3 px-4">
                            <Link
                              href={`/all-chats?agent=${agent.agent_name}`}
                              className="text-sm font-semibold text-white hover:text-[#E91E8C] transition-colors"
                            >
                              {agent.agent_name}
                            </Link>
                            <div className="text-xs text-slate-500">{agent.agent_alias}</div>
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-300">{agent.tickets}</td>
                          <td className="py-3 px-4 text-sm font-bold text-green-400">{agent.closure_pct.toFixed(1)}%</td>
                          <td className="py-3 px-4 text-sm text-slate-300">{fmt(agent.avg_frt_seconds)}</td>
                          <td className="py-3 px-4">
                            <span
                              className="text-xs px-2 py-1 rounded font-bold"
                              style={{
                                backgroundColor: getGradeColor(agent.grade) + '20',
                                color: getGradeColor(agent.grade),
                              }}
                            >
                              {agent.grade}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RIGHT: Team Health Summary (40%) */}
            <div className="space-y-4">
              {/* Grade Distribution */}
              <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4 glow-panel">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Grade Distribution</h4>
                {['A', 'B', 'C', 'D', 'F'].map(grade => {
                  const count = gradeDistribution[grade as keyof typeof gradeDistribution];
                  const pct = leaderboard.length > 0 ? (count / leaderboard.length) * 100 : 0;
                  return (
                    <div key={grade} className="mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-400">{grade}</span>
                        <span className="text-xs font-bold text-white">{count}</span>
                      </div>
                      <div className="w-full bg-slate-700/30 rounded h-1.5 overflow-hidden">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: getGradeColor(grade),
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Top Issues */}
              <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4 glow-panel">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Top Issues This Week</h4>
                {topIssues.length > 0 ? (
                  <div className="space-y-2">
                    {topIssues.map((issue, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-slate-300">{issue.agent_name}</span>
                        <span className="font-bold text-red-400">{issue.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">✅ No auto-fails this week</p>
                )}
              </div>

              {/* Recall Leaders */}
              <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4 glow-panel">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Recall Leaders</h4>
                {recallLeaders.length > 0 ? (
                  <div className="space-y-2">
                    {recallLeaders.map((leader, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-slate-300">{leader.agent_name}</span>
                        <span className="font-bold text-yellow-400">{leader.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">✅ No recalls this week</p>
                )}
              </div>
            </div>
          </div>

          {/* Row 3: Category Breakdown */}
          <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4 glow-panel">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Category Breakdown</h3>
            <div className="space-y-3">
              {categories.map((cat, i) => {
                const pct = (cat.count / maxCategoryCount) * 100;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-300">{cat.category}</span>
                      <span className="text-xs font-bold text-slate-400">{cat.count}</span>
                    </div>
                    <div className="w-full bg-slate-700/30 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: 'linear-gradient(90deg, #E91E8C 0%, #7B2D8B 100%)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
