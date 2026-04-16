'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import {
  AGENTS, ALL_CHATS, getTeamStats, getAgentsByDateRange, filterChatsByDate,
  getAvailableDays, IS_REAL_DATA, DATA_TIMESTAMP, getChatResponseMetrics,
} from '@/lib/dataLoader';
import { gradeColor, formatShortDate } from '@/lib/utils';
import { Grade } from '@/lib/types';
import { StatCard } from '@/components/StatCard';
import { GradeBadge } from '@/components/GradeBadge';
import { AgentLink } from '@/components/AgentLink';
import { FlagLink, ChatJumpLink } from '@/components/FlagLink';
import { NotificationBell } from '@/components/NotificationBell';

const CATEGORY_LABELS: Record<string, string> = {
  greeting: 'Greeting', issue_discovery: 'Issue Discovery', resolution: 'Resolution',
  communication: 'Communication', compliance: 'Compliance', closing: 'Closing',
};

// ─── Live Status Types ────────────────────────────────────────────────────────
interface LiveAgentRow {
  id: string; name: string; status: 'active' | 'idle' | 'offline'; statusLabel: string;
  chatsToday: number; openChats: number; lastSeenMs: number; lastSeenAgo: string;
  chatsInWindow: number;
}
interface LiveStatus {
  ok: boolean;
  agents: LiveAgentRow[];
  summary: { chatsToday: number; openChatsNow: number; activeAgents: number; idleAgents: number; offlineAgents: number };
}

function matchLive(agentName: string, liveAgents: LiveAgentRow[]): LiveAgentRow | undefined {
  const norm = (s: string) => s.toLowerCase().trim();
  const n = norm(agentName);
  return liveAgents.find(a => norm(a.name) === n)
    || liveAgents.find(a => norm(a.name).split(' ')[0] === n.split(' ')[0]);
}

function getTzAbbr(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(new Date());
    return parts.find(p => p.type === 'timeZoneName')?.value || tz;
  } catch {
    return tz;
  }
}

type SortKey = 'avg_score' | 'grade' | 'chats' | 'trend' | 'chats_today' | 'resp_rate' | 'auto_fails' | 'last_active';
type DateMode = 'today' | 'all' | 'day' | 'range';

export default function TeamOverview() {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('avg_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [dateMode, setDateMode] = useState<DateMode>('all');
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [rangeFrom, setRangeFrom] = useState<string>('');
  const [rangeTo, setRangeTo] = useState<string>('');
  const [liveData, setLiveData] = useState<LiveStatus | null>(null);
  const [liveUpdatedAt, setLiveUpdatedAt] = useState<number>(0);

  // Timezone detection
  const [userTz] = useState<string>(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'America/New_York'; }
  });
  const tzAbbr = useMemo(() => getTzAbbr(userTz), [userTz]);
  const todayInTz = useMemo(() => {
    try { return new Date().toLocaleDateString('en-CA', { timeZone: userTz }); } catch { return new Date().toISOString().slice(0, 10); }
  }, [userTz]);

  // Set today on mount
  useEffect(() => {
    setSelectedDay(todayInTz);
  }, [todayInTz]);

  // Live status polling every 30s
  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch('/api/live-status');
      const json: LiveStatus = await res.json();
      if (json.ok) { setLiveData(json); setLiveUpdatedAt(Date.now()); }
    } catch { /* best-effort */ }
  }, []);

  useEffect(() => {
    fetchLive();
    const t = setInterval(fetchLive, 30000);
    return () => clearInterval(t);
  }, [fetchLive]);

  const [liveAgo, setLiveAgo] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setLiveAgo(liveUpdatedAt ? Math.round((Date.now() - liveUpdatedAt) / 1000) : 0);
    }, 1000);
    return () => clearInterval(t);
  }, [liveUpdatedAt]);

  const availableDays = useMemo(() => getAvailableDays(), []);

  // Effective day for 'today' mode
  const effectiveDay = dateMode === 'today' ? todayInTz : selectedDay;

  const { filteredAgents: dateFilteredAgents, filteredChats } = useMemo(() => {
    if (dateMode === 'all') return { filteredAgents: AGENTS, filteredChats: ALL_CHATS };
    if (dateMode === 'today' || dateMode === 'day') {
      const day = dateMode === 'today' ? todayInTz : selectedDay;
      if (!day) return { filteredAgents: AGENTS, filteredChats: ALL_CHATS };
      const agents = getAgentsByDateRange({ day });
      const chats = filterChatsByDate(ALL_CHATS, { day });
      return { filteredAgents: agents, filteredChats: chats };
    }
    const range = { from: rangeFrom ? new Date(rangeFrom) : undefined, to: rangeTo ? new Date(rangeTo + 'T23:59:59') : undefined };
    return { filteredAgents: getAgentsByDateRange(range), filteredChats: filterChatsByDate(ALL_CHATS, range) };
  }, [dateMode, selectedDay, rangeFrom, rangeTo, todayInTz]);

  const stats = useMemo(() => getTeamStats(filteredChats, dateFilteredAgents), [filteredChats, dateFilteredAgents]);

  // Per-agent response metrics (memoized)
  const agentMetrics = useMemo(() => {
    const map: Record<string, { avgRespRate: number; silentChats: number; autoFails: number; lastChatMs: number }> = {};
    for (const agent of dateFilteredAgents) {
      let totalRr = 0; let silent = 0; let fails = 0; let lastMs = 0;
      for (const chat of agent.chats) {
        const m = getChatResponseMetrics(chat);
        totalRr += m.responseRate;
        if (m.customerUnresponded > 0) silent++;
        if (chat.auto_fail.triggered) fails++;
        const ts = new Date(chat.timestamp).getTime();
        if (ts > lastMs) lastMs = ts;
      }
      map[agent.id] = {
        avgRespRate: agent.chats.length ? Math.round(totalRr / agent.chats.length) : 0,
        silentChats: silent,
        autoFails: fails,
        lastChatMs: lastMs,
      };
    }
    return map;
  }, [dateFilteredAgents]);

  const agentTable = useMemo(() => {
    const liveAgents = liveData?.agents || [];
    let list = dateFilteredAgents
      .filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
      .map(a => {
        const live = matchLive(a.name, liveAgents);
        const m = agentMetrics[a.id] || { avgRespRate: 0, silentChats: 0, autoFails: 0, lastChatMs: 0 };
        return { ...a, live, metrics: m };
      });

    list = [...list].sort((a, b) => {
      let av = 0, bv = 0;
      switch (sortKey) {
        case 'avg_score': av = a.avg_score; bv = b.avg_score; break;
        case 'grade': { const o = ['A','B','C','D','F']; av = o.indexOf(a.grade); bv = o.indexOf(b.grade); break; }
        case 'chats': av = a.chats.length; bv = b.chats.length; break;
        case 'trend': av = a.trend; bv = b.trend; break;
        case 'chats_today': av = a.live?.chatsToday || 0; bv = b.live?.chatsToday || 0; break;
        case 'resp_rate': av = a.metrics.avgRespRate; bv = b.metrics.avgRespRate; break;
        case 'auto_fails': av = a.metrics.autoFails; bv = b.metrics.autoFails; break;
        case 'last_active': av = a.live?.lastSeenMs || a.metrics.lastChatMs; bv = b.live?.lastSeenMs || b.metrics.lastChatMs; break;
      }
      return sortDir === 'desc' ? bv - av : av - bv;
    });
    return list;
  }, [dateFilteredAgents, search, sortKey, sortDir, liveData, agentMetrics]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const recentActivity = useMemo(() => {
    return [...filteredChats]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)
      .map(c => ({ ...c, agent: dateFilteredAgents.find(a => a.id === c.agent_id) }));
  }, [filteredChats, dateFilteredAgents]);

  const SortTh = ({ k, label }: { k: SortKey; label: string }) => (
    <th
      className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white select-none whitespace-nowrap"
      onClick={() => toggleSort(k)}
    >
      {label}{sortKey === k ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
    </th>
  );

  const gradeDonut = stats ? Object.entries(stats.gradeCounts).map(([grade, count]) => ({
    name: `Grade ${grade}`, value: count, color: gradeColor(grade as Grade),
  })) : [];
  const catBar = stats ? stats.catAvgPct.map(c => ({ name: CATEGORY_LABELS[c.category] || c.category, score: c.avg })) : [];

  const isFiltered = dateMode !== 'all';
  const filterLabel = dateMode === 'today'
    ? `Today (${tzAbbr})`
    : dateMode === 'day' && selectedDay
    ? selectedDay
    : dateMode === 'range' && (rangeFrom || rangeTo)
    ? `${rangeFrom || '...'} → ${rangeTo || '...'}`
    : null;

  const STATUS_PILL: Record<string, string> = {
    active: 'bg-green-500/15 text-green-400 border border-green-500/30',
    idle: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    offline: 'bg-red-500/15 text-red-400 border border-red-500/30',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-black text-white">Team Overview</h1>
            <NotificationBell />
            {IS_REAL_DATA && (
              <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 font-semibold">
                ● LIVE DATA
              </span>
            )}
            {isFiltered && filterLabel && (
              <span className="text-xs px-2 py-1 rounded-full bg-[#E91E8C]/15 text-[#E91E8C] border border-[#E91E8C]/30 font-semibold">
                📅 {filterLabel}
              </span>
            )}
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Honduras Agents — JackpotDaily Casino QA
            {DATA_TIMESTAMP && <span className="ml-2">· Scored {new Date(DATA_TIMESTAMP).toLocaleDateString()}</span>}
          </p>
        </div>

        {/* Date Filter Controls */}
        <div className="flex flex-col gap-2 min-w-0 sm:min-w-[320px]">
          <div className="flex gap-1.5 flex-wrap">
            {/* Today button */}
            <button
              onClick={() => setDateMode('today')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                dateMode === 'today'
                  ? 'bg-[#E91E8C] text-white shadow-lg'
                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
              }`}
            >
              ⚡ Today <span className="opacity-70">({tzAbbr})</span>
            </button>
            {(['all', 'day', 'range'] as const).map(m => (
              <button
                key={m}
                onClick={() => setDateMode(m)}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors ${
                  dateMode === m
                    ? 'bg-[#E91E8C] text-white shadow-lg'
                    : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                }`}
              >
                {m === 'all' ? 'All Time' : m === 'day' ? 'By Day' : 'Range'}
              </button>
            ))}
          </div>

          {dateMode === 'day' && (
            <select
              value={selectedDay}
              onChange={e => setSelectedDay(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[#1A1A2E] border border-[#7B2D8B]/30 text-slate-300 text-sm focus:outline-none focus:border-[#E91E8C]"
            >
              <option value="">— Select a day —</option>
              {availableDays.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          {dateMode === 'range' && (
            <div className="flex gap-2">
              <input type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)}
                className="flex-1 px-2 py-1.5 rounded-lg bg-[#1A1A2E] border border-[#7B2D8B]/30 text-slate-300 text-xs focus:outline-none focus:border-[#E91E8C]" />
              <span className="text-slate-500 self-center">→</span>
              <input type="date" value={rangeTo} onChange={e => setRangeTo(e.target.value)}
                className="flex-1 px-2 py-1.5 rounded-lg bg-[#1A1A2E] border border-[#7B2D8B]/30 text-slate-300 text-xs focus:outline-none focus:border-[#E91E8C]" />
            </div>
          )}
        </div>
      </div>

      {!stats && (
        <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-10 text-center text-slate-400">
          No chats found for the selected date range.
        </div>
      )}

      {stats && (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Team Avg Score" value={stats.avgScore} sub="out of 100" color={gradeColor('B')} icon="📈" />
            <StatCard label="Chats Scored" value={stats.totalChats.toLocaleString()} sub={filterLabel || 'all time'} icon="💬" />
            <StatCard label="Auto-Fail Rate" value={`${stats.autoFailRate}%`} sub="of filtered chats" color="#ef4444" icon="⚠️" />
            <StatCard label="Top Performer" value={stats.topPerformer.name.split(' ')[0]}
              sub={`Avg ${stats.topPerformer.avg_score}/100`} color={gradeColor('A')} icon="🏆" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 mb-4">Grade Distribution</h2>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={gradeDonut} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                    {gradeDonut.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1A1A2E', border: '1px solid #7B2D8B', borderRadius: '8px', color: '#e2e8f0' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {gradeDonut.filter(g => g.value > 0).map(g => (
                  <div key={g.name} className="flex items-center gap-1 text-xs text-slate-400">
                    <span className="w-2 h-2 rounded-full" style={{ background: g.color }} />
                    {g.name}: {g.value}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 mb-4">Category Averages (%)</h2>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={catBar} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D1B4E" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={90} />
                  <Tooltip contentStyle={{ background: '#1A1A2E', border: '1px solid #7B2D8B', borderRadius: '8px', color: '#e2e8f0' }} />
                  <Bar dataKey="score" fill="#E91E8C" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 mb-4">Weekly Score Trend</h2>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={stats.weeklyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D1B4E" />
                  <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#1A1A2E', border: '1px solid #7B2D8B', borderRadius: '8px', color: '#e2e8f0' }} />
                  <Line type="monotone" dataKey="avg" stroke="#E91E8C" strokeWidth={2} dot={{ fill: '#E91E8C', r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Agent Leaderboard */}
          <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl overflow-hidden">
            {/* Leaderboard header */}
            <div className="p-5 border-b border-[#7B2D8B]/20 flex flex-col sm:flex-row sm:items-center gap-3">
              <h2 className="text-sm font-semibold text-slate-300 flex-1">
                Agent Leaderboard
                {isFiltered && <span className="ml-2 text-xs text-[#E91E8C] font-normal">({filterLabel})</span>}
              </h2>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search agent..."
                className="px-3 py-1.5 rounded-lg bg-[#1A1A2E] border border-[#7B2D8B]/30 text-slate-300 text-sm placeholder-slate-500 focus:outline-none focus:border-[#E91E8C] w-full sm:w-48" />
            </div>

            {/* Live status bar */}
            {liveData && (
              <div className="px-5 py-2.5 border-b border-[#7B2D8B]/10 flex flex-wrap items-center gap-3 text-xs bg-[#0D0D1A]/50">
                <span className="flex items-center gap-1 text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />{liveData.summary.activeAgents} Active</span>
                <span className="flex items-center gap-1 text-amber-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{liveData.summary.idleAgents} Idle</span>
                <span className="flex items-center gap-1 text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />{liveData.summary.offlineAgents} Offline</span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400">Chats Today: <span className="text-white font-semibold">{liveData.summary.chatsToday?.toLocaleString()}</span></span>
                <span className="text-slate-400">Open Now: <span className="text-[#E91E8C] font-semibold">{liveData.summary.openChatsNow}</span></span>
                <span className="text-slate-600 ml-auto">🔄 {liveAgo}s ago</span>
              </div>
            )}

            {/* Mobile cards */}
            <div className="block md:hidden divide-y divide-slate-700/30">
              {agentTable.map((agent, i) => {
                const live = agent.live;
                return (
                  <div key={agent.id} className="px-4 py-3 flex items-center gap-3 hover:bg-[#2D1B4E]/20">
                    <span className="text-slate-500 text-sm w-6 flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <AgentLink agentId={agent.id} agentName={agent.name} />
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <div className="w-16 h-1.5 bg-slate-700 rounded-full">
                          <div className="h-1.5 rounded-full" style={{ width: `${agent.avg_score}%`, background: gradeColor(agent.grade) }} />
                        </div>
                        <span className="font-mono text-xs font-bold" style={{ color: gradeColor(agent.grade) }}>{agent.avg_score}</span>
                        {live && <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${STATUS_PILL[live.status]}`}>{live.statusLabel}</span>}
                        {live?.chatsToday != null && <span className="text-xs text-slate-500">{live.chatsToday} today</span>}
                      </div>
                    </div>
                    <GradeBadge grade={agent.grade} />
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#2D1B4E]/30">
                  <tr>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-8">#</th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Agent</th>
                    {liveData && <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>}
                    <SortTh k="avg_score" label="QA Score" />
                    <SortTh k="grade" label="Grade" />
                    <SortTh k="chats" label={`Chats${filterLabel ? ` (${filterLabel})` : ''}`} />
                    {liveData && <SortTh k="chats_today" label="Today" />}
                    {liveData && <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Open</th>}
                    <SortTh k="resp_rate" label="Resp Rate" />
                    <SortTh k="auto_fails" label="Fails" />
                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Silent</th>
                    <SortTh k="last_active" label="Last Active" />
                    <SortTh k="trend" label="Trend" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {agentTable.map((agent, i) => {
                    const live = agent.live;
                    const m = agent.metrics;
                    const lastActive = live?.lastSeenAgo
                      || (m.lastChatMs ? (Date.now() - m.lastChatMs < 86400000
                        ? `${Math.round((Date.now() - m.lastChatMs) / 60000)}m ago`
                        : new Date(m.lastChatMs).toLocaleDateString()) : '—');
                    return (
                      <tr key={agent.id} className="hover:bg-[#2D1B4E]/20 transition-colors group">
                        <td className="py-3 px-3 text-slate-500 text-sm">{i + 1}</td>
                        <td className="py-3 px-3">
                          <AgentLink agentId={agent.id} agentName={agent.name} className="group-hover:text-[#E91E8C]" />
                        </td>
                        {liveData && (
                          <td className="py-3 px-3">
                            {live ? (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_PILL[live.status]}`}>
                                {live.statusLabel}
                              </span>
                            ) : <span className="text-slate-600 text-xs">—</span>}
                          </td>
                        )}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-700 rounded-full flex-shrink-0">
                              <div className="h-1.5 rounded-full" style={{ width: `${agent.avg_score}%`, background: gradeColor(agent.grade) }} />
                            </div>
                            <span className="font-mono font-bold text-sm" style={{ color: gradeColor(agent.grade) }}>{agent.avg_score}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3"><GradeBadge grade={agent.grade} /></td>
                        <td className="py-3 px-3 text-slate-300 text-sm font-semibold">{agent.chats.length}</td>
                        {liveData && (
                          <td className="py-3 px-3">
                            <span className={`text-sm font-bold ${live?.chatsToday ? 'text-white' : 'text-slate-600'}`}>
                              {live?.chatsToday ?? '—'}
                            </span>
                          </td>
                        )}
                        {liveData && (
                          <td className="py-3 px-3">
                            {live?.openChats ? (
                              <span className="text-sm font-bold text-green-400">{live.openChats}</span>
                            ) : <span className="text-slate-600">—</span>}
                          </td>
                        )}
                        <td className="py-3 px-3">
                          <span className={`text-sm font-bold ${m.avgRespRate >= 80 ? 'text-green-400' : m.avgRespRate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                            {m.avgRespRate}%
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`text-sm font-bold ${m.autoFails > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                            {m.autoFails > 0 ? `🚨 ${m.autoFails}` : '0'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`text-sm font-bold ${m.silentChats > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                            {m.silentChats > 0 ? `⚠️ ${m.silentChats}` : '0'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-sm text-slate-400">{lastActive}</td>
                        <td className="py-3 px-3">
                          <span className={`text-sm font-semibold ${agent.trend > 0 ? 'text-green-400' : agent.trend < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                            {agent.trend > 0 ? '↑' : agent.trend < 0 ? '↓' : '→'} {Math.abs(agent.trend)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {agentTable.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  {search ? `No agents matching "${search}"` : 'No agents with data for this period.'}
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-[#7B2D8B]/20">
              <h2 className="text-sm font-semibold text-slate-300">Recent Activity</h2>
              <p className="text-xs text-slate-500 mt-1">Last 10 scored chats{filterLabel ? ` — ${filterLabel}` : ' across all time'}</p>
            </div>
            <div className="divide-y divide-slate-700/30">
              {recentActivity.map((chat, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3 hover:bg-[#2D1B4E]/15 transition-colors">
                  <GradeBadge grade={chat.grade} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {chat.agent
                        ? <AgentLink agentId={chat.agent.id} agentName={chat.agent_name} />
                        : <span className="text-sm font-semibold text-white">{chat.agent_name}</span>}
                      {chat.auto_fail.triggered && <FlagLink chatId={chat.chat_id} type="auto_fail" reason={chat.auto_fail.reason || 'Auto-fail'} showLabel />}
                      {!chat.auto_fail.triggered && chat.grade === 'F' && <FlagLink chatId={chat.chat_id} type="poor" reason="Low score" />}
                    </div>
                    <div className="text-xs text-slate-500">{new Date(chat.timestamp).toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-sm" style={{ color: gradeColor(chat.grade) }}>{chat.total_score}</div>
                    <ChatJumpLink chatId={chat.chat_id} />
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">No recent chats for this period.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
