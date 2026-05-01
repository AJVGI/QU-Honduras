'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { GradeBadge } from '@/components/GradeBadge';
import { Grade } from '@/lib/types';

const REFRESH_INTERVAL = 30;

interface LiveAgentRow {
  id: string; name: string; status: 'active' | 'idle' | 'offline';
  statusLabel: string; chatsToday: number; openChats: number;
  lastSeenMs: number; lastSeenAgo: string;
}
interface LiveStatus {
  ok: boolean;
  agents: LiveAgentRow[];
  summary: { chatsToday: number; activeAgents: number; idleAgents: number; offlineAgents: number };
}
interface QAAgent {
  id: string; name: string; avg_score: number; grade: Grade;
  frt: number | null; closure_rate: number; tickets: number;
}
interface TicketAlert {
  id: string; auto_fail: boolean; has_recall: boolean;
  frt_seconds: number | null; is_closed: boolean; category: string;
}

/* ── Reusable stat card ─────────────────────────────── */
function StatCard({ label, value, sub, icon, accent, glow }: {
  label: string; value: string | number; sub?: string;
  icon: string; accent: string; glow?: string;
}) {
  return (
    <div className={`jd-card flex items-center gap-4 p-5 ${glow ?? ''}`}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
        style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wider mb-0.5"
          style={{ color: 'var(--text-muted)' }}>{label}</div>
        <div className="text-2xl font-black leading-none" style={{ color: accent }}>{value}</div>
        {sub && <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ── Section header ─────────────────────────────────── */
function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

/* ── Alert row ──────────────────────────────────────── */
function AlertRow({ icon, label, value, accent }: {
  icon: string; label: string; value: number; accent: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-lg"
      style={{ background: `${accent}0f`, border: `1px solid ${accent}22` }}>
      <span className="text-sm font-medium" style={{ color: `${accent}cc` }}>{icon} {label}</span>
      <span className="text-lg font-black" style={{ color: accent }}>{value}</span>
    </div>
  );
}

const STATUS_PILL: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  idle:   'bg-amber-500/15   text-amber-400   border-amber-500/25',
  offline:'bg-slate-500/15   text-slate-400   border-slate-500/25',
};

export default function DashboardPage() {
  const [liveData, setLiveData]   = useState<LiveStatus | null>(null);
  const [qaAgents, setQaAgents]   = useState<QAAgent[]>([]);
  const [tickets, setTickets]     = useState<TicketAlert[]>([]);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [loading, setLoading]     = useState(true);

  const fetchLive = useCallback(async () => {
    try {
      const r = await fetch('/api/live-status');
      const j: LiveStatus = await r.json();
      if (j.ok) setLiveData(j);
    } catch {}
  }, []);

  const fetchQAAgents = useCallback(async () => {
    try {
      const r = await fetch('/api/data/agents');
      const j = await r.json();
      const mapped: QAAgent[] = (j.agents || []).map((a: Record<string, unknown>) => {
        const cp = Number(a.closure_pct) || 0;
        const grade: Grade = cp >= 90 ? 'A' : cp >= 75 ? 'B' : cp >= 60 ? 'C' : cp >= 45 ? 'D' : 'F';
        return {
          id: String(a.id || a.agent_name || ''),
          name: String(a.agent_name || ''),
          avg_score: cp, grade, frt: a.avg_frt_seconds != null ? Number(a.avg_frt_seconds) : null,
          closure_rate: cp, tickets: Number(a.tickets) || 0,
        };
      });
      setQaAgents(mapped);
    } catch {}
  }, []);

  const fetchTickets = useCallback(async () => {
    try {
      const r = await fetch('/api/data/tickets?limit=2000');
      const j = await r.json();
      const mapped: TicketAlert[] = (j.tickets || []).map((t: Record<string, unknown>) => ({
        id: String(t.id || ''), auto_fail: Boolean(t.auto_fail), has_recall: Boolean(t.has_recall),
        frt_seconds: t.frt_seconds != null ? Number(t.frt_seconds) : null,
        is_closed: Boolean(t.is_closed), category: String(t.category || 'Other'),
      }));
      setTickets(mapped);
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([fetchLive(), fetchQAAgents(), fetchTickets()]).then(() => setLoading(false));
  }, [fetchLive, fetchQAAgents, fetchTickets]);

  useEffect(() => {
    const t = setInterval(fetchLive, REFRESH_INTERVAL * 1000);
    return () => clearInterval(t);
  }, [fetchLive]);

  useEffect(() => {
    const t = setInterval(() => setCountdown(c => c <= 1 ? REFRESH_INTERVAL : c - 1), 1000);
    return () => clearInterval(t);
  }, []);

  const topAgents = useMemo(() =>
    [...qaAgents].sort((a, b) => b.closure_rate - a.closure_rate).slice(0, 5), [qaAgents]);

  const bottomAgents = useMemo(() => {
    const order: Record<string, number> = { F:0, D:1, C:2, B:3, A:4 };
    const pool = qaAgents.filter(a => a.tickets >= 5);
    return [...pool].sort((a, b) => (order[a.grade]??4) - (order[b.grade]??4) || a.closure_rate - b.closure_rate).slice(0, 3);
  }, [qaAgents]);

  const teamKpis = useMemo(() => {
    if (!qaAgents.length) return { avgFrt: 0, avgClosure: 0 };
    return {
      avgFrt: Math.round(qaAgents.reduce((s, a) => s + (a.frt || 0), 0) / qaAgents.length),
      avgClosure: Math.round(qaAgents.reduce((s, a) => s + a.closure_rate, 0) / qaAgents.length),
    };
  }, [qaAgents]);

  const gradeDistribution = useMemo(() => {
    const d: Record<Grade, number> = { A:0, B:0, C:0, D:0, F:0, 'N/A':0 };
    qaAgents.forEach(a => { if (a.grade in d) d[a.grade]++; });
    return d;
  }, [qaAgents]);

  const alerts = useMemo(() => ({
    autoFails: tickets.filter(t => t.auto_fail).length,
    recalls:   tickets.filter(t => t.has_recall).length,
    slowFrt:   tickets.filter(t => (t.frt_seconds || 0) > 300).length,
    unresolved:tickets.filter(t => !t.is_closed).length,
  }), [tickets]);

  const categoryBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    tickets.forEach(t => counts.set(t.category, (counts.get(t.category) || 0) + 1));
    const total = tickets.length;
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count, pct: total > 0 ? Math.round(count / total * 100) : 0 }))
      .sort((a, b) => b.count - a.count).slice(0, 7);
  }, [tickets]);

  const trendData = useMemo(() =>
    qaAgents.length ? [{ day: 'Current', avg: Math.round(teamKpis.avgClosure) }] : [], [qaAgents, teamKpis]);

  const matchLiveToQA = (name: string) => {
    const n = name.toLowerCase().trim();
    return qaAgents.find(a => a.name.toLowerCase().trim() === n) ||
      qaAgents.find(a => a.name.toLowerCase().split(' ')[0] === n.split(' ')[0]);
  };

  const sortedAgents = [...(liveData?.agents || [])].sort((a, b) => {
    const o = { active:0, idle:1, offline:2 };
    return o[a.status] - o[b.status];
  });

  const GRADE_COLORS: Record<Grade, string> = {
    A:'#10b981', B:'#14b8a6', C:'#eab308', D:'#f97316', F:'#ef4444', 'N/A':'#64748b',
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-2 border-[#E91E8C] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm" style={{ color:'var(--text-muted)' }}>Loading dashboard…</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">

      {/* ── Page header ───────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color:'var(--text-primary)' }}>
            Dashboard
          </h1>
          <p className="text-sm mt-0.5" style={{ color:'var(--text-muted)' }}>
            Honduras Agents · JackpotDaily QA
            <span className="ml-2 text-emerald-400 glow-live">● LIVE</span>
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs" style={{ color:'var(--text-muted)' }}>
            Refresh in <span className="font-mono" style={{ color:'var(--text-secondary)' }}>{countdown}s</span>
          </div>
          <div className="text-xs mt-0.5" style={{ color:'var(--text-muted)' }}>
            {new Date().toLocaleString('en-US', { timeZone:'America/New_York', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })} ET
          </div>
        </div>
      </div>

      {/* ── KPI strip ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Now"  value={liveData?.summary.activeAgents ?? 0} sub="handling chats"    icon="🟢" accent="#00C882" glow="glow-active" />
        <StatCard label="Idle"        value={liveData?.summary.idleAgents   ?? 0} sub="15m–2h inactive"  icon="🟡" accent="#FFD600" glow="glow-idle"   />
        <StatCard label="This Week"   value={qaAgents.reduce((s,a)=>s+a.tickets,0).toLocaleString()}     sub="total tickets"   icon="💬" accent="#E91E8C" glow="glow-chats" />
        <StatCard label="QA Agents"   value={qaAgents.length}                     sub="with data this week" icon="📊" accent="#7B2D8B" glow="glow-qa"     />
      </div>

      {/* ── Three-column body ─────────────────────────── */}
      {/* Columns: 5 | 4 | 3  (ratio ~38% | 33% | 25%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* LEFT — Live Agent Status */}
        <div className="lg:col-span-5">
          <div className="jd-card glow-panel h-full">
            <SectionHeader title="Live Agent Status" sub="Real-time from WellyTalk · refreshes every 30s" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background:'var(--surface-3)' }}>
                    {['Agent','Status','Last Active','Chats','Open'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider"
                        style={{ color:'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedAgents.map((agent, idx) => {
                    const qa = matchLiveToQA(agent.name);
                    return (
                      <tr key={agent.id}
                        className="transition-colors"
                        style={{
                          borderTop: `1px solid var(--border-subtle)`,
                          background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-4)')}
                        onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)')}>
                        <td className="px-5 py-3 font-semibold" style={{ color:'var(--text-primary)' }}>
                          {qa
                            ? <Link href={`/all-chats?agent=${encodeURIComponent(qa.name)}`}
                                className="hover:text-[#E91E8C] transition-colors">{agent.name}</Link>
                            : agent.name}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${STATUS_PILL[agent.status]}`}>
                            {agent.statusLabel}
                          </span>
                        </td>
                        <td className="px-5 py-3" style={{ color:'var(--text-secondary)' }}>{agent.lastSeenAgo}</td>
                        <td className="px-5 py-3 font-bold" style={{ color:'var(--text-primary)' }}>{agent.chatsToday}</td>
                        <td className="px-5 py-3">
                          {agent.openChats > 0
                            ? <span className="font-bold text-emerald-400">{agent.openChats}</span>
                            : <span style={{ color:'var(--text-muted)' }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* MIDDLE — QA This Week */}
        <div className="lg:col-span-4 flex flex-col gap-4">

          {/* Team KPIs */}
          <div className="jd-card glow-panel">
            <SectionHeader title="Team KPIs" />
            <div className="p-5 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color:'var(--text-muted)' }}>Avg Closure</div>
                <div className="text-3xl font-black" style={{ color:'var(--text-primary)' }}>{teamKpis.avgClosure}<span className="text-lg">%</span></div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color:'var(--text-muted)' }}>Avg FRT</div>
                <div className="text-3xl font-black" style={{ color:'var(--text-secondary)' }}>{teamKpis.avgFrt}<span className="text-lg">s</span></div>
              </div>
            </div>

            {/* Grade pills */}
            <div className="px-5 pb-5">
              <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color:'var(--text-muted)' }}>Grade Distribution</div>
              <div className="flex gap-2 flex-wrap">
                {(Object.entries(gradeDistribution) as [Grade, number][])
                  .filter(([, v]) => v > 0)
                  .map(([grade, count]) => (
                    <div key={grade}
                      className="px-3 py-1 rounded-full text-xs font-bold border"
                      style={{
                        background: `${GRADE_COLORS[grade]}18`,
                        borderColor: `${GRADE_COLORS[grade]}35`,
                        color: GRADE_COLORS[grade],
                      }}>
                      {grade}: {count}
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Top Performers */}
          <div className="jd-card glow-panel">
            <SectionHeader title="Top Performers" />
            <div className="p-3 space-y-1">
              {topAgents.map((agent, i) => (
                <Link key={agent.id} href={`/all-chats?agent=${encodeURIComponent(agent.name)}`}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors"
                  style={{ borderRadius:'8px' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-3)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span className="text-sm" style={{ color:'var(--text-secondary)' }}>
                    <span className="font-bold mr-2" style={{ color:'var(--text-muted)' }}>#{i+1}</span>
                    {agent.name.split(' ')[0]}
                  </span>
                  <div className="flex items-center gap-2">
                    <GradeBadge grade={agent.grade} />
                    <span className="text-sm font-bold w-12 text-right" style={{ color:'var(--text-primary)' }}>{agent.closure_rate}%</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Needing Attention */}
          <div className="jd-card" style={{ borderColor:'rgba(239,68,68,0.25)', background:'rgba(239,68,68,0.04)' }}>
            <SectionHeader title="Needing Attention" />
            <div className="p-3 space-y-1">
              {bottomAgents.length === 0
                ? <p className="px-3 py-2 text-sm" style={{ color:'var(--text-muted)' }}>All agents performing well</p>
                : bottomAgents.map((agent, i) => (
                  <Link key={agent.id} href={`/all-chats?agent=${encodeURIComponent(agent.name)}`}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors"
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <span className="text-sm text-red-400">
                      <span className="font-bold mr-2 text-red-500">#{i+1}</span>
                      {agent.name.split(' ')[0]}
                    </span>
                    <div className="flex items-center gap-2">
                      <GradeBadge grade={agent.grade} />
                      <span className="text-sm font-bold w-12 text-right text-red-400">{agent.closure_rate}%</span>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        </div>

        {/* RIGHT — Alerts & Flags */}
        <div className="lg:col-span-3">
          <div className="jd-card glow-panel h-full">
            <SectionHeader title="Alerts & Flags" />
            <div className="p-4 space-y-3">
              <AlertRow icon="🚨" label="Auto-Fails"     value={alerts.autoFails}  accent="#ef4444" />
              <AlertRow icon="⚠️" label="Recalls"        value={alerts.recalls}    accent="#f97316" />
              <AlertRow icon="⏱️" label="Slow FRT (>5m)" value={alerts.slowFrt}    accent="#eab308" />
              <AlertRow icon="❓" label="Unresolved"     value={alerts.unresolved} accent="#60a5fa" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom row: Trend + Categories ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Trend chart (2/3) */}
        <div className="lg:col-span-2">
          <div className="jd-card glow-panel">
            <SectionHeader title="Team Performance Trend" sub="Closure Rate % · Current Week" />
            <div className="p-5">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trendData} margin={{ top:4, right:24, left:0, bottom:0 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#E91E8C" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#E91E8C" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="day" tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0,100]} tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background:'var(--surface-3)', border:'1px solid var(--border-mid)', borderRadius:'8px', color:'var(--text-primary)', fontSize:'12px' }} />
                  <ReferenceLine y={65} stroke="#7B2D8B" strokeDasharray="4 4"
                    label={{ value:'Target 65%', position:'right', fill:'var(--text-muted)', fontSize:10 }} />
                  <Area type="monotone" dataKey="avg" stroke="#E91E8C" strokeWidth={2}
                    fill="url(#areaGrad)" dot={{ fill:'#E91E8C', r:4, strokeWidth:0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Inquiry categories (1/3) */}
        <div className="lg:col-span-1">
          <div className="jd-card glow-panel h-full">
            <SectionHeader title="Inquiry Categories" />
            <div className="p-5 space-y-3">
              {categoryBreakdown.length === 0
                ? <p className="text-sm" style={{ color:'var(--text-muted)' }}>No ticket data</p>
                : categoryBreakdown.map((cat, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium" style={{ color:'var(--text-secondary)' }}>{cat.name}</span>
                      <span style={{ color:'var(--text-muted)' }}>{cat.count} · {cat.pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background:'var(--surface-4)' }}>
                      <div className="h-full rounded-full jd-gradient-bar" style={{ width:`${cat.pct}%` }} />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer CTA ────────────────────────────────── */}
      <div className="flex justify-center pb-2">
        <Link href="/reports/hub"
          className="px-6 py-2 rounded-lg text-sm font-semibold transition-all"
          style={{
            background:'rgba(233,30,140,0.10)',
            border:'1px solid rgba(233,30,140,0.28)',
            color:'#E91E8C',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(233,30,140,0.18)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(233,30,140,0.10)')}>
          View Full Reports →
        </Link>
      </div>

    </div>
  );
}
