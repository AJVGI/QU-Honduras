'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Legend,
} from 'recharts';
import { AGENTS, getTeamStats, IS_REAL_DATA, DATA_TIMESTAMP } from '@/lib/dataLoader';
import { gradeColor, gradeBg, formatShortDate } from '@/lib/utils';
import { Grade } from '@/lib/types';
import { StatCard } from '@/components/StatCard';
import { GradeBadge } from '@/components/GradeBadge';

const CATEGORY_LABELS: Record<string, string> = {
  greeting: 'Greeting',
  issue_discovery: 'Issue Discovery',
  resolution: 'Resolution',
  communication: 'Communication',
  compliance: 'Compliance',
  closing: 'Closing',
};

type SortKey = 'avg_score' | 'grade' | 'chats' | 'trend';

export default function TeamOverview() {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('avg_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const stats = useMemo(() => getTeamStats(), []);

  const gradeOrder: Record<Grade, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 };

  const filtered = useMemo(() => {
    let list = AGENTS.filter(a =>
      a.name.toLowerCase().includes(search.toLowerCase())
    );
    list = [...list].sort((a, b) => {
      let av: number, bv: number;
      if (sortKey === 'avg_score') { av = a.avg_score; bv = b.avg_score; }
      else if (sortKey === 'grade') { av = gradeOrder[a.grade]; bv = gradeOrder[b.grade]; }
      else if (sortKey === 'chats') { av = a.chats.length; bv = b.chats.length; }
      else { av = a.trend; bv = b.trend; }
      return sortDir === 'desc' ? bv - av : av - bv;
    });
    return list;
  }, [search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  const gradeDonut = Object.entries(stats.gradeCounts).map(([grade, count]) => ({
    name: `Grade ${grade}`, value: count, color: gradeColor(grade as Grade),
  }));

  const catBar = stats.catAvgPct.map(c => ({
    name: CATEGORY_LABELS[c.category] || c.category,
    score: c.avg,
  }));

  const trendLine = stats.weeklyTrend.map(w => ({
    week: w.week,
    avg: w.avg,
  }));

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black text-white">Team Overview</h1>
          {IS_REAL_DATA && (
            <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 font-semibold">● LIVE DATA</span>
          )}
        </div>
        <p className="text-slate-400 text-sm mt-1">
          Honduras Agents — JackpotDaily Casino QA
          {DATA_TIMESTAMP && <span className="ml-2">· Scored {new Date(DATA_TIMESTAMP).toLocaleDateString()}</span>}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Team Avg Score" value={stats.avgScore} sub="out of 100" color={gradeColor('B')} icon="📈" />
        <StatCard label="Chats Scored" value={stats.totalChats.toLocaleString()} sub="last 30 days" icon="💬" />
        <StatCard label="Auto-Fail Rate" value={`${stats.autoFailRate}%`} sub="of all chats" color={stats.autoFailRate > 5 ? '#ef4444' : '#22c55e'} icon="⚠️" />
        <StatCard label="Top Performer" value={stats.topPerformer.name.split(' ')[0]} sub={`Avg ${stats.topPerformer.avg_score}/100`} color="#22c55e" icon="🏆" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Grade Distribution */}
        <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Grade Distribution</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={gradeDonut} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                {gradeDonut.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#f8fafc' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            {gradeDonut.map(g => (
              <div key={g.name} className="flex items-center gap-1 text-xs text-slate-400">
                <div className="w-2 h-2 rounded-full" style={{ background: g.color }} />
                {g.name}: {g.value}
              </div>
            ))}
          </div>
        </div>

        {/* Weakest Category */}
        <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Category Averages (%)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={catBar} layout="vertical" margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={90} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v: number) => [`${v}%`, 'Avg Score']}
              />
              <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                {catBar.map((entry, i) => (
                  <Cell key={i} fill={entry.score >= 80 ? '#22c55e' : entry.score >= 70 ? '#f59e0b' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Week over Week */}
        <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Weekly Score Trend</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendLine}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis domain={[60, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v: number) => [v, 'Avg Score']}
              />
              <Line type="monotone" dataKey="avg" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-700/50 flex flex-col sm:flex-row sm:items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-300 flex-1">Agent Leaderboard</h2>
          <input
            type="text"
            placeholder="Search agent..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-full sm:w-48"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                {[
                  { key: null, label: '#' },
                  { key: null, label: 'Agent' },
                  { key: 'avg_score', label: 'Avg Score' },
                  { key: 'grade', label: 'Grade' },
                  { key: 'chats', label: 'Chats' },
                  { key: 'trend', label: 'WoW Trend' },
                ].map(({ key, label }) => (
                  <th
                    key={label}
                    className={`text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider ${key ? 'cursor-pointer hover:text-white' : ''}`}
                    onClick={() => key && toggleSort(key as SortKey)}
                  >
                    {label} {key && sortKey === key ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((agent, i) => (
                <tr
                  key={agent.id}
                  className="border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors"
                >
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{i + 1}</td>
                  <td className="px-4 py-3">
                    <Link href={`/agent/${agent.id}`} className="text-white font-medium hover:text-blue-400 transition-colors">
                      {agent.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-700 rounded-full max-w-[80px]">
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${agent.avg_score}%`, background: gradeColor(agent.grade) }}
                        />
                      </div>
                      <span className="font-mono font-bold text-white">{agent.avg_score}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><GradeBadge grade={agent.grade} /></td>
                  <td className="px-4 py-3 text-slate-300">{agent.chats.length}</td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-sm font-semibold ${agent.trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {agent.trend >= 0 ? '↑' : '↓'} {Math.abs(agent.trend)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
