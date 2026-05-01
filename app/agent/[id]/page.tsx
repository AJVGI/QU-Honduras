'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface AgentData {
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

interface TicketRow {
  id: string;
  welly_conversation_id: string;
  grade: string | null;
  score: number | null;
  auto_fail: boolean;
  has_recall: boolean;
  frt_seconds: number | null;
  is_closed: boolean;
  category: string;
  coaching_tip: string | null;
  created_at: string;
}

function gradeColor(g: string | null) {
  switch (g) {
    case 'A': return '#10b981';
    case 'B': return '#14b8a6';
    case 'C': return '#eab308';
    case 'D': return '#f97316';
    case 'F': return '#ef4444';
    default: return '#94a3b8';
  }
}

function closureGrade(pct: number): string {
  if (pct >= 90) return 'A';
  if (pct >= 75) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 45) return 'D';
  return 'F';
}

function fmt(seconds: number | null) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function generateRecommendations(
  agent: AgentData,
  tickets: TicketRow[],
  coachingTips: [string, number][]
): string[] {
  const recs: string[] = [];
  if (agent.closure_pct < 45) {
    recs.push('⚠️ URGENT: Closure rate critically low. Schedule 1-on-1 this week.');
  } else if (agent.closure_pct < 65) {
    recs.push('📋 Schedule coaching session focused on resolution techniques.');
  }
  if ((agent.avg_frt_seconds || 0) > 120) {
    recs.push('⏱️ Response time above 2 min average. Reinforce 30-second acknowledgment habit.');
  }
  const autoFails = tickets.filter(t => t.auto_fail).length;
  if (autoFails >= 3) {
    recs.push(`🚨 ${autoFails} auto-fails recorded. Review flagged chats before next shift.`);
  }
  if (coachingTips.length > 0 && coachingTips[0][1] >= 3) {
    recs.push(`🔄 Pattern: "${coachingTips[0][0]}" — address in next coaching session.`);
  }
  if (recs.length === 0) {
    recs.push('✅ Performance on track. Continue current approach.');
  }
  return recs;
}

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'chats' | 'coaching'>('overview');

  useEffect(() => {
    if (!id) return;
    const agentName = decodeURIComponent(id);

    async function load() {
      try {
        // Load agent stats
        const agentRes = await fetch('/api/data/agents');
        const agentData = await agentRes.json();
        const found = (agentData.agents || []).find(
          (a: AgentData) => a.agent_name === agentName || a.id === id
        );
        setAgent(found || null);

        // Load tickets for this agent
        const ticketRes = await fetch(`/api/data/tickets?agent=${encodeURIComponent(agentName)}&limit=500`);
        const ticketData = await ticketRes.json();
        setTickets(ticketData.tickets || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const autoFails = useMemo(() => tickets.filter(t => t.auto_fail), [tickets]);
  const gradedTickets = useMemo(() => tickets.filter(t => t.grade), [tickets]);
  const gradeDistribution = useMemo(() => {
    const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    gradedTickets.forEach(t => { if (t.grade && t.grade in dist) dist[t.grade]++; });
    return dist;
  }, [gradedTickets]);

  const coachingTips = useMemo(() => {
    const tips = tickets.map(t => t.coaching_tip).filter(Boolean) as string[];
    const counts = new Map<string, number>();
    tips.forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [tickets]);

  const categoryBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    tickets.forEach(t => counts.set(t.category, (counts.get(t.category) || 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [tickets]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 flex-col gap-3">
        <div className="text-2xl animate-pulse">⏳</div>
        <div className="text-slate-400 text-sm">Loading agent data...</div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-64 flex-col gap-3">
        <div className="text-4xl">🔍</div>
        <div className="text-slate-400">Agent not found.</div>
        <Link href="/" className="text-[#E91E8C] hover:text-pink-300 text-sm">← Back to Dashboard</Link>
      </div>
    );
  }

  const grade = closureGrade(agent.closure_pct);
  const initials = agent.agent_name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase();

  return (
    <div className="space-y-6 max-w-5xl">
      <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
        ← Dashboard
      </Link>

      {/* Agent Header */}
      <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-6 glow-panel">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7B2D8B] to-[#E91E8C] flex items-center justify-center text-white font-black text-xl flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-2xl font-black text-white">{agent.agent_name}</h1>
              <span className="text-sm font-mono text-slate-400">{agent.agent_alias}</span>
              <span className="px-2 py-0.5 rounded text-sm font-black" style={{ color: gradeColor(grade), background: `${gradeColor(grade)}22`, border: `1px solid ${gradeColor(grade)}44` }}>
                {grade}
              </span>
            </div>
            <p className="text-slate-400 text-sm">JackpotDaily · Honduras Support · Week of {agent.week_start}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[
              { label: 'Closure', value: `${agent.closure_pct.toFixed(0)}%`, color: gradeColor(grade) },
              { label: 'Tickets', value: agent.tickets, color: undefined },
              { label: 'Avg FRT', value: fmt(agent.avg_frt_seconds), color: undefined },
              { label: 'Auto-Fails', value: autoFails.length, color: autoFails.length > 0 ? '#ef4444' : '#22c55e' },
            ].map(stat => (
              <div key={stat.label}>
                <div className="text-xl font-black" style={{ color: stat.color || '#fff' }}>{stat.value}</div>
                <div className="text-xs text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#2D1B4E]/30 p-1 rounded-xl border border-[#7B2D8B]/20">
        {(['overview', 'chats', 'coaching'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              tab === t ? 'bg-[#1A1A2E] text-white shadow' : 'text-slate-400 hover:text-white'
            }`}>
            {t === 'overview' ? '📊 Overview' : t === 'chats' ? `💬 Chats (${tickets.length})` : '🎓 Coaching'}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Grade Distribution */}
          <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-5 glow-panel">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Grade Distribution ({gradedTickets.length} graded)</h3>
            <div className="space-y-3">
              {Object.entries(gradeDistribution).map(([g, count]) => {
                const pct = gradedTickets.length > 0 ? Math.round(count / gradedTickets.length * 100) : 0;
                return (
                  <div key={g}>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: gradeColor(g) }}>Grade {g}</span>
                      <span className="text-slate-400">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: gradeColor(g) }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-5 glow-panel">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Top Inquiry Categories</h3>
            {categoryBreakdown.length > 0 ? (
              <div className="space-y-3">
                {categoryBreakdown.map(([cat, count]) => {
                  const pct = tickets.length > 0 ? Math.round(count / tickets.length * 100) : 0;
                  return (
                    <div key={cat}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">{cat || 'Uncategorized'}</span>
                        <span className="text-slate-400">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#E91E8C] to-[#7B2D8B]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-slate-500 text-sm">No category data.</p>}
          </div>

          {/* Auto-Fail Log */}
          <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-5 glow-panel lg:col-span-2">
            <h3 className="text-sm font-semibold text-red-400 mb-4">🚨 Auto-Fail Log ({autoFails.length})</h3>
            {autoFails.length > 0 ? (
              <div className="space-y-2">
                {autoFails.slice(0, 8).map(t => (
                  <div key={t.id} className="flex items-center justify-between bg-red-900/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <div>
                      <span className="text-xs text-slate-400">{new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      <span className="ml-3 text-xs text-slate-300">Cat: {t.category || '—'}</span>
                    </div>
                    <Link href={`/chat/${t.welly_conversation_id}`} className="text-xs text-[#E91E8C] hover:underline">
                      View →
                    </Link>
                  </div>
                ))}
              </div>
            ) : <p className="text-slate-500 text-sm">✅ No auto-fails recorded.</p>}
          </div>
        </div>
      )}

      {/* CHATS */}
      {tab === 'chats' && (
        <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl overflow-hidden">
          {tickets.length === 0 ? (
            <div className="text-center py-12 text-slate-400">No tickets found for this agent.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#2D1B4E]/30">
                  <tr>
                    {['Date', 'Category', 'Grade', 'FRT', 'Flags', ''].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {tickets.slice(0, 100).map(t => (
                    <tr key={t.id} className="hover:bg-[#2D1B4E]/15 transition-colors">
                      <td className="py-3 px-4 text-xs text-slate-400">
                        {new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-300">{t.category || '—'}</td>
                      <td className="py-3 px-4">
                        {t.grade ? (
                          <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ color: gradeColor(t.grade), background: `${gradeColor(t.grade)}22` }}>
                            {t.grade}
                          </span>
                        ) : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400">{fmt(t.frt_seconds)}</td>
                      <td className="py-3 px-4 text-xs">
                        {t.auto_fail && <span className="text-red-400 mr-1">🚨</span>}
                        {t.has_recall && <span className="text-orange-400">↩️</span>}
                      </td>
                      <td className="py-3 px-4">
                        {t.welly_conversation_id && (
                          <Link href={`/chat/${t.welly_conversation_id}`} className="text-[#E91E8C] hover:underline text-xs">
                            View →
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* COACHING */}
      {tab === 'coaching' && (() => {
        const recalledTickets = tickets.filter(t => t.has_recall);
        const reviewQueueItems = [
          ...tickets.filter(t => t.auto_fail),
          ...tickets.filter(t => t.has_recall && !t.auto_fail),
        ];
        const recommendations = generateRecommendations(agent, tickets, coachingTips);

        return (
          <div className="space-y-6">
            {/* Section 1: Agent Scorecard */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Closure Rate Card */}
              <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4 text-center">
                <div className="text-2xl font-black" style={{ color: gradeColor(grade) }}>
                  {agent.closure_pct.toFixed(0)}%
                </div>
                <div className="text-xs text-slate-400 mt-1">Closure Rate</div>
                <div className="text-xs mt-2" style={{ color: agent.closure_pct >= 65 ? '#10b981' : '#ef4444' }}>
                  {agent.closure_pct >= 65 ? '✓ Above target' : '↓ Below 65% target'}
                </div>
              </div>

              {/* FRT Card */}
              <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4 text-center">
                <div className="text-2xl font-black text-white">{fmt(agent.avg_frt_seconds)}</div>
                <div className="text-xs text-slate-400 mt-1">Avg FRT</div>
                <div className="text-xs mt-2" style={{ color: (agent.avg_frt_seconds || 0) <= 60 ? '#10b981' : '#ef4444' }}>
                  {(agent.avg_frt_seconds || 0) <= 60 ? '✓ Under 60s' : '↑ Above 60s'}
                </div>
              </div>

              {/* Grade Card */}
              <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4 text-center">
                <div className="text-2xl font-black" style={{ color: gradeColor(grade) }}>{grade}</div>
                <div className="text-xs text-slate-400 mt-1">Overall Grade</div>
                <div className="text-xs mt-2 text-slate-400">{gradedTickets.length} graded</div>
              </div>

              {/* Recalls Card */}
              <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4 text-center">
                <div className="text-2xl font-black" style={{ color: recalledTickets.length > 0 ? '#f97316' : '#10b981' }}>
                  {recalledTickets.length}
                </div>
                <div className="text-xs text-slate-400 mt-1">Recalls</div>
                <div className="text-xs mt-2" style={{ color: recalledTickets.length === 0 ? '#10b981' : '#f97316' }}>
                  {recalledTickets.length === 0 ? '✓ None' : `↩️ Needs review`}
                </div>
              </div>
            </div>

            {/* Section 2: Recurring Issues */}
            {coachingTips.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-4">🎯 Recurring Issues & Patterns</h3>
                <div className="space-y-3">
                  {coachingTips.map(([tip, count], i) => {
                    const issuePct = Math.round(
                      (count / Math.max(gradedTickets.length, 1)) * 100
                    );
                    return (
                      <div
                        key={i}
                        className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-bold">
                              {count}x flagged
                            </span>
                            <span className="text-xs text-slate-400">
                              {count >= 5
                                ? '🚨 Critical pattern'
                                : count >= 3
                                  ? '⚠️ Recurring issue'
                                  : '📝 Observed'}
                            </span>
                          </div>
                          <span className="text-xs text-slate-600">
                            Priority:{' '}
                            {count >= 5 ? 'HIGH' : count >= 3 ? 'MEDIUM' : 'LOW'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-200 font-medium">{tip}</p>
                        <div className="mt-2 text-xs text-slate-500">
                          Appears in {count} of {gradedTickets.length} graded chats ({issuePct}%)
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 3: Grade Distribution Trend */}
            {gradedTickets.length >= 5 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-3">
                  📊 Grade Distribution ({gradedTickets.length} tickets)
                </h3>
                <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4 overflow-x-auto">
                  <div className="h-8 rounded-lg overflow-hidden flex bg-slate-900/50 min-w-max">
                    {Object.entries(gradeDistribution).map(([g, count]) => {
                      if (count === 0) return null;
                      const pct = (count / gradedTickets.length) * 100;
                      return (
                        <div
                          key={g}
                          style={{
                            width: `${pct}%`,
                            background: gradeColor(g),
                          }}
                          title={`Grade ${g}: ${count} tickets`}
                          className="flex items-center justify-center text-xs font-bold text-white transition-all hover:opacity-80"
                        >
                          {count > 1 ? g : ''}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 text-xs text-slate-400 text-center">
                    {Object.entries(gradeDistribution)
                      .filter(([_, count]) => count > 0)
                      .map(([g, count]) => `${g}: ${count}`)
                      .join(' • ')}
                  </div>
                </div>
              </div>
            )}

            {/* Section 4: Tickets Needing Supervisor Review */}
            {reviewQueueItems.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-red-400 mb-3">
                  🔍 Review Queue ({reviewQueueItems.length})
                </h3>
                <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#2D1B4E]/30 border-b border-slate-700/30">
                        <tr>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400 uppercase">
                            Date
                          </th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400 uppercase">
                            Category
                          </th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400 uppercase">
                            Reason
                          </th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400 uppercase">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/20">
                        {reviewQueueItems.slice(0, 10).map(t => (
                          <tr key={t.id} className="hover:bg-[#2D1B4E]/15 transition-colors">
                            <td className="py-2 px-3 text-xs text-slate-400">
                              {new Date(t.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </td>
                            <td className="py-2 px-3 text-xs text-slate-300">{t.category || '—'}</td>
                            <td className="py-2 px-3 text-xs">
                              {t.auto_fail ? (
                                <span className="text-red-400 font-semibold">🚨 Auto-Fail</span>
                              ) : t.has_recall ? (
                                <span className="text-orange-400 font-semibold">↩️ Recall</span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              {t.welly_conversation_id && (
                                <Link
                                  href={`/chat/${t.welly_conversation_id}`}
                                  className="text-[#E91E8C] hover:underline text-xs"
                                >
                                  View →
                                </Link>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {reviewQueueItems.length > 10 && (
                  <p className="text-xs text-slate-500 text-right mt-2">
                    Showing 10 of {reviewQueueItems.length} items
                  </p>
                )}
              </div>
            )}

            {/* Section 5: Coaching Recommendations */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">💬 Recommendations</h3>
              <div className="space-y-2">
                {recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4 text-sm text-slate-200"
                  >
                    {rec}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
      
    </div>
  );
}
