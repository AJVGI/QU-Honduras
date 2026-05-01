'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { gradeColor } from '@/lib/utils';
import { Grade } from '@/lib/types';
import { GradeBadge } from '@/components/GradeBadge';
import { AgentLink } from '@/components/AgentLink';

const REFRESH_INTERVAL = 30; // seconds

// Live Agent Status types
interface LiveAgentRow {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'offline';
  statusLabel: string;
  chatsToday: number;
  openChats: number;
  lastSeenMs: number;
  lastSeenAgo: string;
}

interface LiveStatus {
  ok: boolean;
  agents: LiveAgentRow[];
  summary: { chatsToday: number; activeAgents: number; idleAgents: number; offlineAgents: number };
}

// QA Agent Summary
interface QAAgent {
  id: string;
  name: string;
  avg_score: number;
  grade: Grade;
  frt: number | null;
  closure_rate: number;
  tickets: number;
}

// Ticket Alert for alerts and category breakdown
interface TicketAlert {
  id: string;
  auto_fail: boolean;
  has_recall: boolean;
  frt_seconds: number | null;
  is_closed: boolean;
  category: string;
}

function StatCard({ label, value, sub, icon, color, glow, trend }: {
  label: string; value: string | number; sub?: string; icon: string; color?: string; glow?: string; trend?: string;
}) {
  return (
    <div className={`bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-5 ${glow || ''}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</div>
          <div className="flex items-end gap-2">
            <div className="text-2xl font-black" style={color ? { color } : { color: '#fff' }}>{value}</div>
            {trend && <span className="text-xs text-slate-400 mb-0.5">{trend}</span>}
          </div>
          {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-500/15 text-green-400 border border-green-500/30',
  idle: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  offline: 'bg-red-500/15 text-red-400 border border-red-500/30',
};

export default function DashboardPage() {
  const [liveData, setLiveData] = useState<LiveStatus | null>(null);
  const [qaAgents, setQaAgents] = useState<QAAgent[]>([]);
  const [tickets, setTickets] = useState<TicketAlert[]>([]);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [loading, setLoading] = useState(true);

  // Fetch live status
  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch('/api/live-status');
      const json: LiveStatus = await res.json();
      if (json.ok) setLiveData(json);
    } catch (e) {
      console.error('Failed to fetch live status:', e);
    }
  }, []);

  // Fetch QA agents for this week
  const fetchQAAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/data/agents');
      const json = await res.json();
      const raw = json.agents || [];
      const mapped: QAAgent[] = raw.map((a: Record<string, unknown>) => {
        const closurePct = Number(a.closure_pct) || 0;
        const grade: Grade = closurePct >= 90 ? 'A' : closurePct >= 75 ? 'B' : closurePct >= 60 ? 'C' : closurePct >= 45 ? 'D' : 'F';
        return {
          id: String(a.id || a.agent_name || ''),
          name: String(a.agent_name || ''),
          avg_score: closurePct,
          grade,
          frt: a.avg_frt_seconds != null ? Number(a.avg_frt_seconds) : null,
          closure_rate: closurePct,
          tickets: Number(a.tickets) || 0,
        };
      });
      setQaAgents(mapped);
    } catch (e) {
      console.error('Failed to fetch QA agents:', e);
    }
  }, []);

  // Fetch tickets for alerts and category breakdown
  const fetchTickets = useCallback(async () => {
    try {
      const res = await fetch('/api/data/tickets?limit=2000');
      const json = await res.json();
      const raw = json.tickets || [];
      const mapped: TicketAlert[] = raw.map((t: Record<string, unknown>) => ({
        id: String(t.id || ''),
        auto_fail: Boolean(t.auto_fail),
        has_recall: Boolean(t.has_recall),
        frt_seconds: t.frt_seconds != null ? Number(t.frt_seconds) : null,
        is_closed: Boolean(t.is_closed),
        category: String(t.category || 'Other'),
      }));
      setTickets(mapped);
    } catch (e) {
      console.error('Failed to fetch tickets:', e);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    const load = async () => {
      await Promise.all([fetchLive(), fetchQAAgents(), fetchTickets()]);
      setLoading(false);
    };
    load();
  }, [fetchLive, fetchQAAgents, fetchTickets]);

  // Auto-refresh live data every 30s
  useEffect(() => {
    const t = setInterval(fetchLive, REFRESH_INTERVAL * 1000);
    return () => clearInterval(t);
  }, [fetchLive]);

  // Countdown timer
  useEffect(() => {
    const t = setInterval(() => {
      setCountdown(c => (c <= 1 ? REFRESH_INTERVAL : c - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Compute top/bottom agents by closure rate
  const topAgents = useMemo(() => {
    return [...qaAgents].sort((a, b) => b.closure_rate - a.closure_rate).slice(0, 5);
  }, [qaAgents]);

  const bottomAgents = useMemo(() => {
    // Show agents with most tickets but lowest grades, or lowest closure if no grades
    const gradeOrder: Record<string, number> = { F: 0, D: 1, C: 2, B: 3, A: 4 };
    const withGrade = qaAgents.filter(a => a.grade && a.tickets >= 5);
    if (withGrade.length >= 3) {
      return [...withGrade].sort((a, b) => {
        const ga = gradeOrder[a.grade || 'A'] ?? 4;
        const gb = gradeOrder[b.grade || 'A'] ?? 4;
        if (ga !== gb) return ga - gb;
        return a.closure_rate - b.closure_rate;
      }).slice(0, 3);
    }
    // Fallback: lowest closure among agents with 5+ tickets
    return [...qaAgents]
      .filter(a => a.tickets >= 5)
      .sort((a, b) => a.closure_rate - b.closure_rate)
      .slice(0, 3);
  }, [qaAgents]);

  // Team KPIs
  const teamKpis = useMemo(() => {
    if (qaAgents.length === 0) return { avgFrt: 0, avgClosure: 0 };
    const avgFrt = qaAgents.reduce((sum, a) => sum + (a.frt || 0), 0) / qaAgents.length;
    const avgClosure = qaAgents.reduce((sum, a) => sum + a.closure_rate, 0) / qaAgents.length;
    return { avgFrt: Math.round(avgFrt), avgClosure: Math.round(avgClosure) };
  }, [qaAgents]);

  // Grade distribution
  const gradeDistribution = useMemo(() => {
    const dist: Record<Grade, number> = { A: 0, B: 0, C: 0, D: 0, F: 0, 'N/A': 0 };
    qaAgents.forEach(a => {
      if (a.grade in dist) dist[a.grade]++;
    });
    return dist;
  }, [qaAgents]);

  // Alerts computed from tickets
  const alerts = useMemo(() => ({
    autoFails: tickets.filter(t => t.auto_fail).length,
    recalls: tickets.filter(t => t.has_recall).length,
    slowFrt: tickets.filter(t => (t.frt_seconds || 0) > 300).length,
    unresolved: tickets.filter(t => !t.is_closed).length,
  }), [tickets]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    tickets.forEach(t => counts.set(t.category, (counts.get(t.category) || 0) + 1));
    const total = tickets.length;
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count, pct: total > 0 ? Math.round(count / total * 100) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
  }, [tickets]);

  // Team performance trend (real data from QA agents)
  const teamTrendData = useMemo(() => {
    if (qaAgents.length === 0) return [];
    const avgClosure = Math.round(teamKpis.avgClosure);
    return [{ day: 'Current', avg: avgClosure }];
  }, [qaAgents, teamKpis]);

  // Match live agent to QA agent
  const matchLiveToQA = (agentName: string) => {
    const norm = (s: string) => s.toLowerCase().trim();
    const n = norm(agentName);
    return qaAgents.find(a => norm(a.name) === n) ||
      qaAgents.find(a => norm(a.name).split(' ')[0] === n.split(' ')[0]);
  };

  const allLiveAgents = (liveData?.agents || [])
    .sort((a, b) => {
      const statusOrder = { active: 0, idle: 1, offline: 2 };
      return statusOrder[a.status] - statusOrder[b.status];
    });

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-black text-white">Dashboard</h1>
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section 1: Header Bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Honduras Agents — JackpotDaily QA
            <span className="ml-2 text-green-400 glow-live">● LIVE</span>
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Auto-refresh in <span className="text-slate-300 font-mono">{countdown}s</span></div>
          <div className="text-xs text-slate-600 mt-1">{new Date().toLocaleString('en-US', {timeZone:'America/New_York', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})} ET</div>
        </div>
      </div>

      {/* Section 2: 4 KPI Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Now" value={liveData?.summary.activeAgents ?? 0} sub="handling chats" icon="🟢" color="#4ade80" glow="glow-active" />
        <StatCard label="Idle" value={liveData?.summary.idleAgents ?? 0} sub="15m–2h inactive" icon="🟡" color="#fbbf24" glow="glow-idle" />
        <StatCard label="This Week" value={qaAgents.length > 0 ? qaAgents.reduce((sum, a) => sum + a.tickets, 0).toLocaleString() : 'N/A'} sub="total tickets" icon="💬" color="#E91E8C" glow="glow-chats" />
        <StatCard label="QA Agents" value={qaAgents.length} sub="with data this week" icon="📊" glow="glow-qa" />
      </div>

      {/* Section 3: Three-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT (45%): Live Agent Status */}
        <div className="lg:col-span-5">
          <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl overflow-hidden glow-panel">
            <div className="p-4 border-b border-[#7B2D8B]/20">
              <h2 className="text-sm font-semibold text-slate-300">Live Agent Status</h2>
              <p className="text-xs text-slate-500 mt-1">Real-time from WellyTalk · Refreshes every 30 seconds</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#2D1B4E]/30">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Agent</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Last Active</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Chats</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {allLiveAgents.map(agent => {
                    const qa = matchLiveToQA(agent.name);
                    return (
                      <tr key={agent.id} className="hover:bg-[#2D1B4E]/20 transition-colors">
                        <td className="py-3 px-4">
                          {qa ? (
                            <Link href={`/all-chats?agent=${encodeURIComponent(qa.name)}`} className="text-sm font-semibold text-white hover:text-[#E91E8C]">
                              {agent.name}
                            </Link>
                          ) : (
                            <span className="text-sm font-semibold text-white">{agent.name}</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLES[agent.status]}`}>
                            {agent.statusLabel}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-300">{agent.lastSeenAgo}</td>
                        <td className="py-3 px-4">
                          <span className="text-sm font-bold text-white">{agent.chatsToday}</span>
                        </td>
                        <td className="py-3 px-4">
                          {agent.openChats > 0 ? (
                            <span className="text-sm font-bold text-green-400">{agent.openChats}</span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* MIDDLE (30%): QA This Week */}
        <div className="lg:col-span-3 space-y-4">
          {/* Team KPIs */}
          <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4 glow-panel">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Team KPIs</h2>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-slate-500 mb-1">Avg Closure %</div>
                <div className="text-2xl font-black text-white">{teamKpis.avgClosure}%</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Avg FRT</div>
                <div className="text-2xl font-black text-slate-300">{teamKpis.avgFrt}s</div>
              </div>
            </div>
          </div>

          {/* Grade Distribution */}
          <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4 glow-panel">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Grade Distribution</h2>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(gradeDistribution).map(([grade, count]) => (
                <div key={grade} className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  grade === 'A' ? 'bg-green-500/20 border-green-500/30 text-green-400' :
                  grade === 'B' ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' :
                  grade === 'C' ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' :
                  grade === 'D' ? 'bg-orange-500/20 border-orange-500/30 text-orange-400' :
                  'bg-red-500/20 border-red-500/30 text-red-400'
                }`}>
                  {grade}: {count}
                </div>
              ))}
            </div>
          </div>

          {/* Top 5 Performers */}
          <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4 glow-panel">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Top Performers</h2>
            <div className="space-y-2">
              {topAgents.map((agent, i) => (
                <Link key={agent.id} href={`/all-chats?agent=${encodeURIComponent(agent.name)}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-[#2D1B4E]/20 transition-colors group">
                  <span className="text-xs font-bold text-slate-400 group-hover:text-white">#{i + 1} {agent.name.split(' ')[0]}</span>
                  <div className="flex items-center gap-2">
                    <GradeBadge grade={agent.grade} />
                    <span className="text-xs font-bold text-white">{agent.closure_rate}%</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Bottom 3 - Needing Attention */}
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <h2 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3">Needing Attention</h2>
            <div className="space-y-2">
              {bottomAgents.map((agent, i) => (
                <Link key={agent.id} href={`/all-chats?agent=${encodeURIComponent(agent.name)}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-red-500/20 transition-colors group">
                  <span className="text-xs font-bold text-red-300 group-hover:text-red-100">#{i + 1} {agent.name.split(' ')[0]}</span>
                  <div className="flex items-center gap-2">
                    <GradeBadge grade={agent.grade} />
                    <span className="text-xs font-bold text-red-400">{agent.closure_rate}%</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT (25%): Alerts & Flags */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4 glow-panel">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Alerts & Flags</h2>
            
            {/* Auto-Fails */}
            <div className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-2">
              <span className="text-xs text-red-300 font-semibold">🚨 Auto-Fails</span>
              <span className="text-lg font-black text-red-400">{alerts.autoFails}</span>
            </div>

            {/* Recalls */}
            <div className="flex items-center justify-between p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg mb-2">
              <span className="text-xs text-orange-300 font-semibold">⚠️ Recalls</span>
              <span className="text-lg font-black text-orange-400">{alerts.recalls}</span>
            </div>

            {/* Slow FRT */}
            <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-2">
              <span className="text-xs text-amber-300 font-semibold">⏱️ Slow FRT ({'>'} 5m)</span>
              <span className="text-lg font-black text-amber-400">{alerts.slowFrt}</span>
            </div>

            {/* Unresolved */}
            <div className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <span className="text-xs text-blue-300 font-semibold">❓ Unresolved</span>
              <span className="text-lg font-black text-blue-400">{alerts.unresolved}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Bottom two-panel row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT (60%): Team Performance Trend Chart */}
        <div className="lg:col-span-2">
          <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-5 glow-panel">
            <h2 className="text-sm font-semibold text-slate-300">Team Performance Trend</h2>
            <p className="text-xs text-slate-500 mt-1">Closure Rate % · Current Week</p>
            
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={teamTrendData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E91E8C" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#E91E8C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D1B4E" />
                <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#1A1A2E', border: '1px solid #7B2D8B', borderRadius: '8px', color: '#e2e8f0' }} />
                <ReferenceLine y={65} stroke="#7B2D8B" strokeDasharray="5 5" label={{ value: 'Target: 65%', position: 'right', fill: '#94a3b8', fontSize: 10 }} />
                <Area type="monotone" dataKey="avg" stroke="#E91E8C" strokeWidth={2} fill="url(#scoreGradient)" dot={{ fill: '#E91E8C', r: 5, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* RIGHT (40%): Inquiry Category Breakdown */}
        <div className="lg:col-span-1">
          <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-5 glow-panel">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">Inquiry Categories</h2>
            
            <div className="space-y-3">
              {categoryBreakdown.length === 0 ? (
                <p className="text-xs text-slate-500">No ticket data available</p>
              ) : (
                categoryBreakdown.map((cat, idx) => (
                  <div key={idx} className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300 font-medium">{cat.name}</span>
                      <span className="text-slate-400">{cat.count} ({cat.pct}%)</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-gradient-to-r from-[#E91E8C] to-[#7B2D8B]" 
                        style={{width: `${cat.pct}%`}} 
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Link to Reports Hub */}
      <div className="flex justify-center">
        <Link href="/reports/hub"
          className="px-6 py-2 rounded-lg bg-[#E91E8C]/15 border border-[#E91E8C]/30 text-[#E91E8C] hover:bg-[#E91E8C]/25 text-sm font-semibold transition-colors">
          → View Full Reports
        </Link>
      </div>
    </div>
  );
}
