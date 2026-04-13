'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import {
  AGENTS, ALL_CHATS, getTeamStats, getAgentsByDateRange, filterChatsByDate,
  getAvailableDays, IS_REAL_DATA, DATA_TIMESTAMP,
} from '@/lib/dataLoader';
import { gradeColor, gradeBg, formatShortDate } from '@/lib/utils';
import { Grade } from '@/lib/types';
import { StatCard } from '@/components/StatCard';
import { GradeBadge } from '@/components/GradeBadge';

const CATEGORY_LABELS: Record<string, string> = {
  greeting: 'Greeting', issue_discovery: 'Issue Discovery', resolution: 'Resolution',
  communication: 'Communication', compliance: 'Compliance', closing: 'Closing',
};

type SortKey = 'avg_score' | 'grade' | 'chats' | 'trend';
type DateMode = 'all' | 'day' | 'range';

export default function TeamOverview() {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('avg_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Date filter state
  const [dateMode, setDateMode] = useState<DateMode>('all');
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [rangeFrom, setRangeFrom] = useState<string>('');
  const [rangeTo, setRangeTo] = useState<string>('');

  const availableDays = useMemo(() => getAvailableDays(), []);

  // Compute filtered data based on current date selection
  const { filteredAgents: dateFilteredAgents, filteredChats } = useMemo(() => {
    if (dateMode === 'all') {
      return { filteredAgents: AGENTS, filteredChats: ALL_CHATS };
    }
    const range = dateMode === 'day'
      ? { day: selectedDay }
      : { from: rangeFrom ? new Date(rangeFrom) : undefined, to: rangeTo ? new Date(rangeTo + 'T23:59:59') : undefined };
    const agents = getAgentsByDateRange(range);
    const chats = filterChatsByDate(ALL_CHATS, range);
    return { filteredAgents: agents, filteredChats: chats };
  }, [dateMode, selectedDay, rangeFrom, rangeTo]);

  const stats = useMemo(
    () => getTeamStats(filteredChats, dateFilteredAgents),
    [filteredChats, dateFilteredAgents]
  );

  const gradeDonut = stats ? Object.entries(stats.gradeCounts).map(([grade, count]) => ({
    name: `Grade ${grade}`, value: count, color: gradeColor(grade as Grade),
  })) : [];

  const catBar = stats ? stats.catAvgPct.map(c => ({
    name: CATEGORY_LABELS[c.category] || c.category, score: c.avg,
  })) : [];

  const agentTable = useMemo(() => {
    let list = dateFilteredAgents.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));
    list = [...list].sort((a, b) => {
      let av: number, bv: number;
      if (sortKey === 'avg_score') { av = a.avg_score; bv = b.avg_score; }
      else if (sortKey === 'grade') { const o = ['A', 'B', 'C', 'D', 'F']; av = o.indexOf(a.grade); bv = o.indexOf(b.grade); }
      else if (sortKey === 'chats') { av = a.chats.length; bv = b.chats.length; }
      else { av = a.trend; bv = b.trend; }
      return sortDir === 'desc' ? bv - av : av - bv;
    });
    return list;
  }, [dateFilteredAgents, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  // Recent activity — last 10 scored chats in current filter
  const recentActivity = useMemo(() => {
    return [...filteredChats]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)
      .map(c => ({ ...c, agent: dateFilteredAgents.find(a => a.id === c.agent_id) }));
  }, [filteredChats, dateFilteredAgents]);

  const SortTh = ({ k, label }: { k: SortKey; label: string }) => (
    <th
      className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white select-none"
      onClick={() => toggleSort(k)}
    >
      {label} {sortKey === k ? (sortDir === 'desc' ? '↓' : '↑') : ''}
    </th>
  );

  const isFiltered = dateMode !== 'all';
  const filterLabel = dateMode === 'day' && selectedDay
    ? selectedDay
    : dateMode === 'range' && (rangeFrom || rangeTo)
    ? `${rangeFrom || '...'} → ${rangeTo || '...'}`
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-black text-white">Team Overview</h1>
            {IS_REAL_DATA && (
              <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 font-semibold">
                ● LIVE DATA
              </span>
            )}
            {isFiltered && filterLabel && (
              <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-semibold">
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
        <div className="flex flex-col gap-2 min-w-0 sm:min-w-[280px]">
          <div className="flex gap-2">
            {(['all', 'day', 'range'] as DateMode[]).map(m => (
              <button
                key={m}
                onClick={() => setDateMode(m)}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors ${
                  dateMode === m
                    ? 'bg-blue-600 text-white'
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
              className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">— Select a day —</option>
              {availableDays.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}

          {dateMode === 'range' && (
            <div className="flex gap-2">
              <input
                type="date"
                value={rangeFrom}
                onChange={e => setRangeFrom(e.target.value)}
                className="flex-1 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 text-xs focus:outline-none focus:border-blue-500"
              />
              <span className="text-slate-500 self-center">→</span>
              <input
                type="date"
                value={rangeTo}
                onChange={e => setRangeTo(e.target.value)}
                className="flex-1 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* No data for filter */}
      {!stats && (
        <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-10 text-center text-slate-400">
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
            <StatCard
              label="Top Performer"
              value={stats.topPerformer.name.split(' ')[0]}
              sub={`Avg ${stats.topPerformer.avg_score}/100`}
              color={gradeColor('A')}
              icon="🏆"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Grade Donut */}
            <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 mb-4">Grade Distribution</h2>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={gradeDonut} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                    {gradeDonut.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} />
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

            {/* Category Averages */}
            <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 mb-4">Category Averages (%)</h2>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={catBar} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={90} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} />
                  <Bar dataKey="score" fill="#3b82f6" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Weekly Trend */}
            <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 mb-4">Weekly Score Trend</h2>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={stats.weeklyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} />
                  <Line type="monotone" dataKey="avg" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Agent Leaderboard */}
          <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-slate-700/50 flex flex-col sm:flex-row sm:items-center gap-3">
              <h2 className="text-sm font-semibold text-slate-300 flex-1">
                Agent Leaderboard
                {isFiltered && <span className="ml-2 text-xs text-blue-400 font-normal">({filterLabel})</span>}
              </h2>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search agent..."
                className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 w-full sm:w-48"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">#</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Agent</th>
                    <SortTh k="avg_score" label="Avg Score" />
                    <SortTh k="grade" label="Grade" />
                    <SortTh k="chats" label="Chats" />
                    <SortTh k="trend" label="WoW Trend" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {agentTable.map((agent, i) => (
                    <tr key={agent.id} className="hover:bg-slate-800/40 transition-colors cursor-pointer group">
                      <td className="py-3 px-4 text-slate-500 text-sm">{i + 1}</td>
                      <td className="py-3 px-4">
                        <Link href={`/agent/${agent.id}`} className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                          {agent.name}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-slate-700 rounded-full">
                            <div className="h-1.5 rounded-full" style={{ width: `${agent.avg_score}%`, background: gradeColor(agent.grade) }} />
                          </div>
                          <span className="font-mono font-bold text-sm" style={{ color: gradeColor(agent.grade) }}>
                            {agent.avg_score}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4"><GradeBadge grade={agent.grade} /></td>
                      <td className="py-3 px-4 text-slate-300 text-sm">{agent.chats.length}</td>
                      <td className="py-3 px-4">
                        <span className={`text-sm font-semibold ${agent.trend > 0 ? 'text-green-400' : agent.trend < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                          {agent.trend > 0 ? '↑' : agent.trend < 0 ? '↓' : '→'} {Math.abs(agent.trend)}
                        </span>
                      </td>
                    </tr>
                  ))}
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
          <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-slate-700/50">
              <h2 className="text-sm font-semibold text-slate-300">Recent Activity</h2>
              <p className="text-xs text-slate-500 mt-1">
                Last 10 scored chats{filterLabel ? ` — ${filterLabel}` : ' across all time'}
              </p>
            </div>
            <div className="divide-y divide-slate-700/30">
              {recentActivity.map((chat, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-800/30 transition-colors">
                  <GradeBadge grade={chat.grade} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {chat.agent ? (
                        <Link href={`/agent/${chat.agent.id}`} className="text-sm font-semibold text-white hover:text-blue-400 transition-colors">
                          {chat.agent_name}
                        </Link>
                      ) : (
                        <span className="text-sm font-semibold text-white">{chat.agent_name}</span>
                      )}
                      {chat.auto_fail.triggered && <span className="text-xs text-red-400">🚨 Auto-fail</span>}
                      {chat.website && <span className="text-xs text-slate-500">{chat.website}</span>}
                    </div>
                    <div className="text-xs text-slate-500">{new Date(chat.timestamp).toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-sm" style={{ color: gradeColor(chat.grade) }}>{chat.total_score}</div>
                    <Link href={`/chat/${chat.chat_id}`} className="text-xs text-blue-400 hover:text-blue-300">View →</Link>
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
