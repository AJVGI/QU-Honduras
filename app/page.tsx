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
  ok: boolean; agents: LiveAgentRow[];
  summary: { chatsToday: number; activeAgents: number; idleAgents: number; offlineAgents: number };
}
interface QAAgent {
  id: string; name: string; avg_score: number; grade: Grade;
  frt: number | null; closure_rate: number; tickets: number;
}
interface TicketAlert {
  id: string; auto_fail: boolean; has_recall: boolean;
  frt_seconds: number | null; is_closed: boolean; category: string;
  grade?: string | null; agent_name?: string;
}

const GRADE_COLOR: Record<Grade, string> = {
  A: '#00C882', B: '#E91E8C', C: '#FFD600', D: '#f97316', F: '#FF4444', 'N/A': '#64748b',
};

const STATUS_PILL: Record<string, { bg: string; color: string; border: string }> = {
  active:  { bg: 'rgba(0,200,130,0.12)',  color: '#00C882', border: 'rgba(0,200,130,0.30)' },
  idle:    { bg: 'rgba(255,214,0,0.12)',  color: '#e6c200', border: 'rgba(255,214,0,0.30)' },
  offline: { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8', border: 'rgba(100,116,139,0.22)' },
};

/* ─── Small reusable pieces ──────────────────────────────────────── */

function KpiCard({ label, value, sub, icon, accent, glow }: {
  label: string; value: string | number; sub?: string;
  icon: string; accent: string; glow: string;
}) {
  return (
    <div className={`jd-card ${glow}`} style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${accent}18`, border: `1px solid ${accent}28`,
      }}>{icon}</div>
      <div>
        <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{label}</div>
        <div style={{ color: accent, fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  );
}

function CardHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border-default)' }}>
      <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>{title}</div>
      {sub && <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function AlertRow({ icon, label, value, accent }: { icon: string; label: string; value: number; accent: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '11px 14px', borderRadius: 8,
      background: `${accent}0e`, border: `1px solid ${accent}22`,
    }}>
      <span style={{ color: `${accent}bb`, fontSize: 12, fontWeight: 500 }}>{icon} {label}</span>
      <span style={{ color: accent, fontSize: 20, fontWeight: 900 }}>{value}</span>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const [liveData,     setLiveData]    = useState<LiveStatus | null>(null);
  const [qaAgents,     setQaAgents]    = useState<QAAgent[]>([]);
  const [tickets,      setTickets]     = useState<TicketAlert[]>([]);
  const [totalTickets, setTotalTickets]= useState<number>(0);
  const [countdown,    setCountdown]   = useState(REFRESH_INTERVAL);
  const [loading,      setLoading]     = useState(true);

  const fetchLive = useCallback(async () => {
    try { const r = await fetch('/api/live-status'); const j = await r.json(); if (j.ok) setLiveData(j); } catch {}
  }, []);

  const fetchQA = useCallback(async () => {
    try {
      const r = await fetch('/api/data/agents'); const j = await r.json();
      setQaAgents((j.agents || []).map((a: Record<string, unknown>) => {
        // Use closure_pct only as a fallback — grade comes from ticket scores
        const cp = Number(a.closure_pct) || 0;
        return {
          id: String(a.id || a.agent_name || ''), name: String(a.agent_name || ''),
          avg_score: cp, grade: 'N/A' as Grade,
          frt: a.avg_frt_seconds != null ? Number(a.avg_frt_seconds) : null,
          closure_rate: cp, tickets: Number(a.tickets) || 0,
        };
      }));
    } catch {}
  }, []);

  const fetchTickets = useCallback(async () => {
    try {
      const r = await fetch('/api/data/tickets?limit=2000'); const j = await r.json();
      setTotalTickets(j.total || 0);
      setTickets((j.tickets || []).map((t: Record<string, unknown>) => ({
        id: String(t.id || ''), auto_fail: Boolean(t.auto_fail), has_recall: Boolean(t.has_recall),
        frt_seconds: t.frt_seconds != null ? Number(t.frt_seconds) : null,
        is_closed: Boolean(t.is_closed), category: String(t.category || 'Other'),
        grade: t.grade ? String(t.grade) : null,
        agent_name: t.agent_name ? String(t.agent_name) : undefined,
      })));
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([fetchLive(), fetchQA(), fetchTickets()]).then(() => setLoading(false));
  }, [fetchLive, fetchQA, fetchTickets]);

  useEffect(() => { const t = setInterval(fetchLive, REFRESH_INTERVAL * 1000); return () => clearInterval(t); }, [fetchLive]);
  useEffect(() => { const t = setInterval(() => setCountdown(c => c <= 1 ? REFRESH_INTERVAL : c - 1), 1000); return () => clearInterval(t); }, []);

  // Enrich qaAgents with real scores from graded tickets
  const enrichedAgents = useMemo(() => {
    const gradeVal: Record<string, number> = { A: 95, B: 82, C: 67, D: 52, F: 25 };
    const gradeOrd: Record<string, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };
    // Build per-agent grade map from tickets
    const agentGrades = new Map<string, string[]>();
    tickets.forEach((t: any) => {
      if (!t.grade || !t.agent_name) return;
      const key = String(t.agent_name);
      if (!agentGrades.has(key)) agentGrades.set(key, []);
      agentGrades.get(key)!.push(t.grade);
    });
    return qaAgents.map(a => {
      const grades = agentGrades.get(a.name) || [];
      if (grades.length === 0) return { ...a, grade: 'N/A' as Grade, avg_score: 0 };
      const avgScore = Math.round(grades.reduce((s, g) => s + (gradeVal[g] ?? 50), 0) / grades.length);
      const dominantGrade = grades.sort((x, y) => (gradeOrd[y] ?? 0) - (gradeOrd[x] ?? 0))
        .reduce((acc, g) => {
          // most frequent grade
          const counts = grades.reduce((c, v) => { c[v] = (c[v] || 0) + 1; return c; }, {} as Record<string,number>);
          return Object.entries(counts).sort((a,b) => b[1]-a[1])[0]?.[0] ?? 'N/A';
        }, 'N/A');
      return { ...a, grade: dominantGrade as Grade, avg_score: avgScore };
    });
  }, [qaAgents, tickets]);

  const topAgents = useMemo(() =>
    [...enrichedAgents]
      .filter(a => a.avg_score > 0)
      .sort((a, b) => b.avg_score - a.avg_score)
      .slice(0, 5)
  , [enrichedAgents]);

  // Only flag agents with grades C/D/F as needing attention
  const bottomAgents = useMemo(() => {
    const bad = enrichedAgents.filter(a => a.tickets >= 3 && ['C', 'D', 'F'].includes(a.grade));
    if (bad.length > 0) {
      const ord: Record<string, number> = { F: 0, D: 1, C: 2 };
      return [...bad].sort((a, b) => (ord[a.grade] ?? 3) - (ord[b.grade] ?? 3)).slice(0, 4);
    }
    return [];
  }, [enrichedAgents]);

  const teamKpis = useMemo(() => {
    if (!qaAgents.length) return { avgFrtDisplay: 'N/A', avgScore: 0, gradedCount: 0 };
    // FRT: skip nulls
    const frtAgents = qaAgents.filter(a => a.frt !== null && a.frt > 0);
    const avgFrtSec = frtAgents.length
      ? Math.round(frtAgents.reduce((s, a) => s + (a.frt ?? 0), 0) / frtAgents.length)
      : 0;
    const frtMin = Math.floor(avgFrtSec / 60);
    const frtSec = avgFrtSec % 60;
    const avgFrtDisplay = frtAgents.length
      ? frtMin > 0 ? `${frtMin}m ${frtSec}s` : `${frtSec}s`
      : 'N/A';
    // Score: from graded tickets only
    const graded = tickets.filter(t => t.grade);
    const gradeVal: Record<string, number> = { A: 95, B: 82, C: 67, D: 52, F: 25 };
    const avgScore = graded.length
      ? Math.round(graded.reduce((s, t) => s + (gradeVal[t.grade!] ?? 50), 0) / graded.length)
      : 0;
    return { avgFrtDisplay, avgScore, gradedCount: graded.length };
  }, [qaAgents, tickets]);

  // Grade distribution from actual graded tickets (not derived from closure %)
  const gradeDist = useMemo(() => {
    const d: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    tickets.forEach(t => { if (t.grade && t.grade in d) d[t.grade]++; });
    return d;
  }, [tickets]);

  const alerts = useMemo(() => ({
    autoFails:  tickets.filter(t => t.auto_fail).length,
    recalls:    tickets.filter(t => t.has_recall).length,
    slowFrt:    tickets.filter(t => (t.frt_seconds || 0) > 300).length,
    unresolved: tickets.filter(t => !t.is_closed).length,
  }), [tickets]);

  const categories = useMemo(() => {
    const m = new Map<string, number>();
    tickets.forEach(t => m.set(t.category, (m.get(t.category) || 0) + 1));
    const total = tickets.length;
    return Array.from(m.entries())
      .map(([name, count]) => ({ name, count, pct: total > 0 ? Math.round(count / total * 100) : 0 }))
      .sort((a, b) => b.count - a.count).slice(0, 7);
  }, [tickets]);

  const trendData = useMemo(() =>
    teamKpis.avgScore > 0 ? [{ day: 'Current', avg: teamKpis.avgScore }] : []
  , [teamKpis]);

  const matchQA = (name: string) => {
    const n = name.toLowerCase().trim();
    return qaAgents.find(a => a.name.toLowerCase().trim() === n) ||
           qaAgents.find(a => a.name.toLowerCase().split(' ')[0] === n.split(' ')[0]);
  };

  const sortedAgents = [...(liveData?.agents || [])].sort((a, b) => {
    const o: Record<string, number> = { active: 0, idle: 1, offline: 2 };
    return o[a.status] - o[b.status];
  });

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '2px solid #E91E8C', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px' }} className="animate-spin" />
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading dashboard…</p>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1560, margin: '0 auto', padding: '24px 24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap" style={{ gap: 12 }}>
        <div>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1, margin: 0 }}>Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Honduras Agents · JackpotDaily QA
            <span className="glow-live" style={{ marginLeft: 8, color: '#00C882' }}>● LIVE</span>
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            Refresh in <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{countdown}s</span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
            {new Date().toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} ET
          </div>
        </div>
      </div>

      {/* ── KPI strip — 4 equal columns, wraps on small screens ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }} className="kpi-grid">
        <KpiCard label="Active Now"  value={liveData?.summary.activeAgents ?? 0} sub="handling chats"      icon="🟢" accent="#00C882" glow="glow-green" />
        <KpiCard label="Idle"        value={liveData?.summary.idleAgents   ?? 0} sub="15 – 120 min"        icon="🟡" accent="#e6c200" glow="glow-gold"  />
        <KpiCard label="This Week"   value={(totalTickets || qaAgents.reduce((s, a) => s + a.tickets, 0)).toLocaleString()} sub="total tickets" icon="💬" accent="#E91E8C" glow="glow-pink" />
        <KpiCard label="QA Agents"   value={qaAgents.length}                     sub="with data this week" icon="📊" accent="#7B2D8B" glow="glow-promo" />
      </div>

      {/* ── Main body: fixed 3-column grid ───────────────────────── */}
      {/* Left 48% | Middle 30% | Right 22% */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }} className="body-grid">

        {/* LEFT — Live Agent Status */}
        <div className="jd-card glow-panel body-left">
          <CardHead title="Live Agent Status" sub="Real-time from WellyTalk · refreshes every 30s" />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(45,27,78,0.40)' }}>
                  {['Agent', 'Status', 'Last Active', 'Chats', 'Open'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedAgents.map((agent, i) => {
                  const qa = matchQA(agent.name);
                  const pill = STATUS_PILL[agent.status];
                  return (
                    <tr key={agent.id}
                      style={{ borderTop: '1px solid var(--border-default)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)', transition: 'background 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)')}>
                      <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {qa
                          ? <Link href={`/all-chats?agent=${encodeURIComponent(qa.name)}`}
                              style={{ color: 'var(--text-primary)', textDecoration: 'none', transition: 'color 0.12s' }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#E91E8C')}
                              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}>{agent.name}</Link>
                          : agent.name}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ background: pill.bg, color: pill.color, border: `1px solid ${pill.border}`, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {agent.statusLabel}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{agent.lastSeenAgo}</td>
                      <td style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>{agent.chatsToday}</td>
                      <td style={{ padding: '10px 16px' }}>
                        {agent.openChats > 0
                          ? <span style={{ fontWeight: 700, color: '#00C882' }}>{agent.openChats}</span>
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* MIDDLE — KPIs + Performers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} className="body-mid">

          {/* Team KPIs */}
          <div className="jd-card glow-panel">
            <CardHead title="Team KPIs" />
            <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Avg QA Score</div>
                <div style={{ color: '#fff', fontSize: 28, fontWeight: 900, lineHeight: 1 }}>
                  {teamKpis.avgScore}<span style={{ fontSize: 14 }}>/100</span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 2 }}>{teamKpis.gradedCount} tickets graded</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Avg FRT</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 28, fontWeight: 900, lineHeight: 1 }}>{teamKpis.avgFrtDisplay}</div>
              </div>
            </div>
            <div style={{ padding: '0 18px 14px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>Grade Distribution</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {(Object.entries(gradeDist) as [Grade, number][]).filter(([, v]) => v > 0).map(([g, c]) => (
                  <div key={g} style={{ background: `${GRADE_COLOR[g]}18`, border: `1px solid ${GRADE_COLOR[g]}32`, color: GRADE_COLOR[g], padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                    {g}: {c}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Performers */}
          <div className="jd-card glow-panel" style={{ flex: 1 }}>
            <CardHead title="Top Performers" />
            <div style={{ padding: '6px 8px' }}>
              {topAgents.map((a, i) => (
                <Link key={a.id} href={`/all-chats?agent=${encodeURIComponent(a.name)}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 7, textDecoration: 'none', transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-raised)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 700, marginRight: 6, fontSize: 11 }}>#{i + 1}</span>
                    {a.name.split(' ')[0]}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <GradeBadge grade={a.grade} />
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 13, minWidth: 40, textAlign: 'right' }}>{a.avg_score}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Needing Attention — only shows when there are C/D/F grade agents */}
          {bottomAgents.length > 0 && (
            <div className="jd-card" style={{ borderColor: 'rgba(255,68,68,0.22)', background: 'rgba(255,68,68,0.04)' }}>
              <CardHead title="⚠️ Needing Attention" />
              <div style={{ padding: '6px 8px' }}>
                {bottomAgents.map((a, i) => (
                  <Link key={a.id} href={`/all-chats?agent=${encodeURIComponent(a.name)}`}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 7, textDecoration: 'none', transition: 'background 0.12s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,68,68,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <span style={{ color: '#f87171', fontSize: 13 }}>
                      <span style={{ color: '#FF4444', fontWeight: 700, marginRight: 6, fontSize: 11 }}>#{i + 1}</span>
                      {a.name.split(' ')[0]}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <GradeBadge grade={a.grade} />
                      <span style={{ color: '#FF4444', fontWeight: 700, fontSize: 13, minWidth: 40, textAlign: 'right' }}>{a.avg_score}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Alerts */}
        <div className="jd-card glow-panel body-right">
          <CardHead title="Alerts & Flags" />
          <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <AlertRow icon="🚨" label="Auto-Fails"     value={alerts.autoFails}  accent="#FF4444" />
            <AlertRow icon="⚠️" label="Recalls"        value={alerts.recalls}    accent="#f97316" />
            <AlertRow icon="⏱️" label="Slow FRT (>5m)" value={alerts.slowFrt}    accent="#FFD600" />
            <AlertRow icon="❓" label="Unresolved"     value={alerts.unresolved} accent="#60a5fa" />
          </div>
        </div>
      </div>

      {/* ── Bottom row ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }} className="bottom-grid">

        {/* Trend chart */}
        <div className="jd-card glow-panel bottom-left">
          <CardHead title="Team Performance Trend" sub="Closure Rate % · Current Week" />
          <div style={{ padding: '12px 16px 16px' }}>
            <ResponsiveContainer width="100%" height={170}>
              <AreaChart data={trendData} margin={{ top: 4, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#E91E8C" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#E91E8C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,27,78,0.55)" />
                <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--surface-raised)', border: '1px solid var(--border-mid)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
                <ReferenceLine y={65} stroke="#7B2D8B" strokeDasharray="4 4" label={{ value: 'Target 65%', position: 'right', fill: 'var(--text-muted)', fontSize: 10 }} />
                <Area type="monotone" dataKey="avg" stroke="#E91E8C" strokeWidth={2} fill="url(#areaGrad)" dot={{ fill: '#E91E8C', r: 4, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Inquiry Categories */}
        <div className="jd-card glow-panel bottom-right">
          <CardHead title="Inquiry Categories" />
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {categories.length === 0
              ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No ticket data</p>
              : categories.map((cat, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }}>{cat.name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{cat.count} · {cat.pct}%</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'var(--surface-raised)', overflow: 'hidden' }}>
                    <div style={{ width: `${cat.pct}%`, height: '100%', borderRadius: 2, background: 'linear-gradient(90deg,#E91E8C,#7B2D8B)', transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Link href="/reports/hub"
          style={{ padding: '9px 28px', borderRadius: 9, fontSize: 13, fontWeight: 600, background: 'rgba(233,30,140,0.10)', border: '1px solid rgba(233,30,140,0.28)', color: '#E91E8C', textDecoration: 'none', transition: 'background 0.18s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(233,30,140,0.20)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(233,30,140,0.10)')}>
          View Full Reports →
        </Link>
      </div>
    </div>
  );
}
