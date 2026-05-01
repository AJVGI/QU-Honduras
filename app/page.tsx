'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Tooltip, ResponsiveContainer,
} from 'recharts';
// dataLoader removed — data now pulled live from Supabase + WellyTalk API
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

function StatCard({ label, value, sub, icon, color }: {
  label: string; value: string | number; sub?: string; icon: string; color?: string;
}) {
  return (
    <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-5">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</div>
          <div className="text-2xl font-black" style={color ? { color } : { color: '#fff' }}>{value}</div>
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
      // Map API field names to QAAgent interface
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

  // Initial fetch
  useEffect(() => {
    const load = async () => {
      await Promise.all([fetchLive(), fetchQAAgents()]);
      setLoading(false);
    };
    load();
  }, [fetchLive, fetchQAAgents]);

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
    return [...qaAgents].sort((a, b) => a.closure_rate - b.closure_rate).slice(0, 3);
  }, [qaAgents]);

  // Team KPIs
  const teamKpis = useMemo(() => {
    if (qaAgents.length === 0) return { avgFrt: 0, avgClosure: 0 };
    const avgFrt = qaAgents.reduce((sum, a) => sum + (a.frt || 0), 0) / qaAgents.length;
    const avgClosure = qaAgents.reduce((sum, a) => sum + a.closure_rate, 0) / qaAgents.length;
    return { avgFrt: Math.round(avgFrt), avgClosure: Math.round(avgClosure) };
  }, [qaAgents]);

  // Weekly trend data (mock for now)
  const weeklyTrend = [
    { week: 'Mon', avg: 72 },
    { week: 'Tue', avg: 74 },
    { week: 'Wed', avg: 75 },
    { week: 'Thu', avg: 76 },
    { week: 'Fri', avg: 78 },
  ];

  // Match live agent to QA agent
  const matchLiveToQA = (agentName: string) => {
    const norm = (s: string) => s.toLowerCase().trim();
    const n = norm(agentName);
    return qaAgents.find(a => norm(a.name) === n) ||
      qaAgents.find(a => norm(a.name).split(' ')[0] === n.split(' ')[0]);
  };

  const allLiveAgents = (liveData?.agents || [])
    .sort((a, b) => {
      // Sort: active first, then idle, then offline
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Honduras Agents — JackpotDaily QA
            <span className="ml-2 text-green-400">● LIVE</span>
          </p>
        </div>
        <div className="text-xs text-slate-500 text-right">
          Auto-refresh in <span className="text-slate-300 font-mono">{countdown}s</span>
        </div>
      </div>

      {/* Top Stats Row (4 tiles) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Now"
          value={liveData?.summary.activeAgents ?? 0}
          sub="handling chats"
          icon="🟢"
          color="#4ade80"
        />
        <StatCard
          label="Idle"
          value={liveData?.summary.idleAgents ?? 0}
          sub="last chat 15m–2h ago"
          icon="🟡"
          color="#fbbf24"
        />
        <StatCard
          label="This Week"
          value={qaAgents.length > 0 ? qaAgents.reduce((sum, a) => sum + a.tickets, 0).toLocaleString() : 'N/A'}
          sub="total tickets sampled"
          icon="💬"
        />
        <StatCard
          label="QA Agents"
          value={qaAgents.length}
          sub="with data this week"
          icon="📊"
        />
      </div>

      {/* Two-column layout: Live Status (60%) + QA Summary (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Live Agent Status Table (60% = 2 cols) */}
        <div className="lg:col-span-2">
          <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl overflow-hidden">
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
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Chats Today</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Open Now</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {allLiveAgents.map(agent => {
                    const qa = matchLiveToQA(agent.name);
                    return (
                      <tr key={agent.id} className="hover:bg-[#2D1B4E]/20 transition-colors">
                        <td className="py-3 px-4">
                          {qa ? (
                            <Link href={`/agent/${qa.id}`} className="text-sm font-semibold text-white hover:text-[#E91E8C]">
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

        {/* Right: QA Summary (40% = 1 col) */}
        <div className="space-y-4">
          {/* Team KPIs */}
          <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Team KPIs</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Avg FRT</span>
                <span className="text-sm font-bold text-white">{teamKpis.avgFrt}s</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Closure Rate</span>
                <span className="text-sm font-bold text-white">{teamKpis.avgClosure}%</span>
              </div>
            </div>
          </div>

          {/* Top 5 Agents */}
          <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Top Performers</h2>
            <div className="space-y-2">
              {topAgents.map((agent, i) => (
                <Link key={agent.id} href={`/agent/${agent.id}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-[#2D1B4E]/20 transition-colors group">
                  <span className="text-xs text-slate-400 group-hover:text-white">{i + 1}. {agent.name.split(' ')[0]}</span>
                  <div className="flex items-center gap-2">
                    <GradeBadge grade={agent.grade} />
                    <span className="text-xs font-bold text-white">{agent.closure_rate}%</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Bottom 3 Agents */}
          <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Needing Attention</h2>
            <div className="space-y-2">
              {bottomAgents.map((agent, i) => (
                <Link key={agent.id} href={`/agent/${agent.id}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-[#2D1B4E]/20 transition-colors group">
                  <span className="text-xs text-slate-400 group-hover:text-white">{i + 1}. {agent.name.split(' ')[0]}</span>
                  <div className="flex items-center gap-2">
                    <GradeBadge grade={agent.grade} />
                    <span className="text-xs font-bold text-red-400">{agent.closure_rate}%</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Link to Reports Hub */}
          <Link href="/reports/hub"
            className="block w-full py-2 px-3 rounded-lg bg-[#E91E8C]/15 border border-[#E91E8C]/30 text-[#E91E8C] hover:bg-[#E91E8C]/25 text-xs font-semibold text-center transition-colors">
            → View Full Reports
          </Link>
        </div>
      </div>

      {/* Weekly Trend Chart */}
      <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Weekly Score Trend</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={weeklyTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2D1B4E" />
            <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: '#1A1A2E', border: '1px solid #7B2D8B', borderRadius: '8px', color: '#e2e8f0' }} />
            <Line type="monotone" dataKey="avg" stroke="#E91E8C" strokeWidth={2} dot={{ fill: '#E91E8C', r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
