'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { getAgent } from '@/lib/dataLoader';
import { gradeColor, gradeBg, formatDate, formatShortDate } from '@/lib/utils';
import { CATEGORY_LABELS, CATEGORY_MAX } from '@/lib/types';
import { GradeBadge } from '@/components/GradeBadge';

type Tab = 'overview' | 'chats' | 'byday' | 'training';

const GRADES = ['A', 'B', 'C', 'D', 'F'];
const PER_PAGE = 20;

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const agent = getAgent(id);
  const [tab, setTab] = useState<Tab>('overview');
  const [chatPage, setChatPage] = useState(0);
  const [gradeFilter, setGradeFilter] = useState('all');
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-64 flex-col gap-3">
        <div className="text-4xl">🔍</div>
        <div className="text-slate-400">Agent not found.</div>
        <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm">← Back to Team Overview</Link>
      </div>
    );
  }

  const autoFails = agent.chats.filter(c => c.auto_fail.triggered);
  const sortedChats = useMemo(() =>
    [...agent.chats].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
  [agent.chats]);

  // Radar data
  const radarData = Object.keys(CATEGORY_LABELS).map(k => {
    const avg = agent.chats.reduce((s, c) => s + c.categories[k as keyof typeof c.categories].score, 0) / agent.chats.length;
    return { category: CATEGORY_LABELS[k].replace(' & ', '\n& '), score: Math.round((avg / CATEGORY_MAX[k]) * 100) };
  });

  // Score timeline
  const timeline = [...agent.chats]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-30).map(c => ({ date: formatShortDate(c.timestamp), score: c.total_score }));

  // Coaching tips (unique)
  const tips = [...new Set(sortedChats.map(c => c.coaching_tip).filter(Boolean))].slice(0, 5);

  // All Chats tab — filtered + paginated
  const filteredChats = useMemo(() => {
    let list = sortedChats;
    if (gradeFilter !== 'all') list = list.filter(c => c.grade === gradeFilter);
    return list;
  }, [sortedChats, gradeFilter]);

  const pageChats = filteredChats.slice(chatPage * PER_PAGE, (chatPage + 1) * PER_PAGE);
  const totalPages = Math.ceil(filteredChats.length / PER_PAGE);

  // By Day tab
  const byDay = useMemo(() => {
    const map: Record<string, typeof agent.chats> = {};
    for (const c of sortedChats) {
      const day = c.timestamp.substring(0, 10);
      if (!map[day]) map[day] = [];
      map[day].push(c);
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [sortedChats]);

  const toggleDay = (day: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day); else next.add(day);
      return next;
    });
  };

  // Training tab — aggregate weaknesses / issues
  const trainingInsights = useMemo(() => {
    const issueMap: Record<string, number> = {};
    const tipMap: Record<string, number> = {};
    for (const chat of agent.chats) {
      if (chat.coaching_tip) tipMap[chat.coaching_tip] = (tipMap[chat.coaching_tip] || 0) + 1;
      if (chat.message_analysis) {
        for (const msg of chat.message_analysis) {
          for (const issue of msg.issues || []) {
            issueMap[issue] = (issueMap[issue] || 0) + 1;
          }
        }
      }
    }
    const topIssues = Object.entries(issueMap).sort(([,a],[,b]) => b-a).slice(0, 10);
    const topTips = Object.entries(tipMap).sort(([,a],[,b]) => b-a).slice(0, 5);

    // Category weakness — which category is lowest %
    const catScores = Object.keys(CATEGORY_LABELS).map(k => {
      const avg = agent.chats.reduce((s, c) => s + c.categories[k as keyof typeof c.categories].score, 0) / agent.chats.length;
      return { key: k, label: CATEGORY_LABELS[k], pct: Math.round((avg / CATEGORY_MAX[k]) * 100) };
    }).sort((a, b) => a.pct - b.pct);

    return { topIssues, topTips, catScores };
  }, [agent.chats]);

  const initials = agent.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'chats', label: `All Chats (${agent.chats.length})`, icon: '💬' },
    { key: 'byday', label: 'By Day', icon: '📅' },
    { key: 'training', label: 'Training', icon: '🎓' },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">← Team Overview</Link>

      {/* Agent Header */}
      <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-2xl font-black text-white">{agent.name}</h1>
              <GradeBadge grade={agent.grade} size="lg" />
            </div>
            <p className="text-slate-400 text-sm">JackpotDaily · Honduras Support Team</p>
          </div>
          <div className="grid grid-cols-4 gap-4 text-center">
            {[
              { label: 'Avg Score', value: agent.avg_score, color: gradeColor(agent.grade) },
              { label: 'Total Chats', value: agent.chats.length, color: undefined },
              { label: 'Trend', value: `${agent.trend >= 0 ? '↑' : '↓'}${Math.abs(agent.trend)}`, color: agent.trend >= 0 ? '#22c55e' : '#ef4444' },
              { label: 'Auto-Fails', value: autoFails.length, color: autoFails.length > 0 ? '#ef4444' : '#22c55e' },
            ].map(stat => (
              <div key={stat.label}>
                <div className="text-2xl font-black" style={{ color: stat.color || '#fff' }}>{stat.value}</div>
                <div className="text-xs text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 min-w-max flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-[#1e293b] text-white shadow' : 'text-slate-400 hover:text-white'
            }`}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Radar */}
            <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">Category Performance</h3>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Radar dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            {/* Timeline */}
            <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">Score Timeline (Last 30)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} />
                  <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Coaching Tips */}
            <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-blue-400 mb-4">💡 Top Coaching Tips</h3>
              {tips.length > 0 ? (
                <div className="space-y-3">
                  {tips.map((tip, i) => (
                    <div key={i} className="flex gap-3 text-sm text-slate-300 bg-blue-900/10 border border-blue-500/20 rounded-lg px-3 py-2">
                      <span className="text-blue-500 font-bold flex-shrink-0">{i+1}.</span>{tip}
                    </div>
                  ))}
                </div>
              ) : <p className="text-slate-500 text-sm">No coaching tips yet.</p>}
            </div>
            {/* Auto-Fail Log */}
            <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-red-400 mb-4">🚨 Auto-Fail Log ({autoFails.length})</h3>
              {autoFails.length > 0 ? (
                <div className="space-y-2">
                  {autoFails.slice(0, 5).map((chat, i) => (
                    <div key={i} className="bg-red-900/10 border border-red-500/20 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-400">{formatDate(chat.timestamp)}</span>
                        <Link href={`/chat/${chat.chat_id}`} className="text-xs text-blue-400 hover:text-blue-300">View →</Link>
                      </div>
                      <p className="text-xs text-red-300">{chat.auto_fail.reason || 'Auto-fail triggered'}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-slate-500 text-sm">✅ No auto-fails recorded.</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── ALL CHATS TAB ── */}
      {tab === 'chats' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {['all', ...GRADES].map(g => (
              <button key={g} onClick={() => { setGradeFilter(g); setChatPage(0); }}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  gradeFilter === g ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}>
                {g === 'all' ? 'All Grades' : `Grade ${g}`}
              </button>
            ))}
          </div>

          <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    {['Date', 'Chat ID', 'Score', 'Grade', 'Website', 'Auto-Fail', ''].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {pageChats.map((chat, i) => (
                    <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-sm text-slate-400">{formatDate(chat.timestamp)}</td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-400">{chat.chat_id.substring(0, 16)}…</td>
                      <td className="py-3 px-4 font-mono font-bold text-sm" style={{ color: gradeColor(chat.grade) }}>{chat.total_score}</td>
                      <td className="py-3 px-4"><GradeBadge grade={chat.grade} /></td>
                      <td className="py-3 px-4 text-xs text-slate-400">{chat.website || '—'}</td>
                      <td className="py-3 px-4">{chat.auto_fail.triggered ? <span className="text-xs text-red-400">🚨 Yes</span> : <span className="text-xs text-slate-500">—</span>}</td>
                      <td className="py-3 px-4"><Link href={`/chat/${chat.chat_id}`} className="text-xs text-blue-400 hover:text-blue-300 font-medium">View →</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredChats.length === 0 && (
              <div className="text-center py-12 text-slate-400">😔 No chats found for this filter.</div>
            )}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-700/50">
                <span className="text-xs text-slate-400">Page {chatPage+1} of {totalPages} · {filteredChats.length} chats</span>
                <div className="flex gap-2">
                  <button disabled={chatPage === 0} onClick={() => setChatPage(p => p-1)}
                    className="px-3 py-1 rounded bg-slate-700 text-slate-300 text-sm disabled:opacity-40 hover:bg-slate-600">‹ Prev</button>
                  <button disabled={chatPage >= totalPages-1} onClick={() => setChatPage(p => p+1)}
                    className="px-3 py-1 rounded bg-slate-700 text-slate-300 text-sm disabled:opacity-40 hover:bg-slate-600">Next ›</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── BY DAY TAB ── */}
      {tab === 'byday' && (
        <div className="space-y-3">
          {byDay.length === 0 && <div className="text-center py-12 text-slate-400">📭 No chats yet.</div>}
          {byDay.map(([day, chats]) => {
            const dayAvg = Math.round(chats.reduce((s, c) => s + c.total_score, 0) / chats.length);
            const expanded = expandedDays.has(day);
            return (
              <div key={day} className="bg-[#1e293b] border border-slate-700/50 rounded-xl overflow-hidden">
                <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/30 transition-colors"
                  onClick={() => toggleDay(day)}>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-white">{new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                    <span className="text-xs text-slate-400">{chats.length} chat{chats.length !== 1 ? 's' : ''}</span>
                    <span className="text-sm font-mono font-bold" style={{ color: gradeColor(dayAvg >= 90 ? 'A' : dayAvg >= 80 ? 'B' : dayAvg >= 70 ? 'C' : dayAvg >= 60 ? 'D' : 'F') }}>
                      Avg: {dayAvg}
                    </span>
                  </div>
                  <span className="text-slate-400">{expanded ? '▲' : '▼'}</span>
                </button>
                {expanded && (
                  <div className="border-t border-slate-700/30 divide-y divide-slate-700/20">
                    {chats.map((chat, i) => (
                      <div key={i} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-800/20">
                        <span className="text-xs text-slate-500 font-mono">{new Date(chat.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                        <GradeBadge grade={chat.grade} />
                        <span className="font-mono font-bold text-sm" style={{ color: gradeColor(chat.grade) }}>{chat.total_score}</span>
                        {chat.auto_fail.triggered && <span className="text-xs text-red-400">🚨</span>}
                        <span className="flex-1 text-xs text-slate-500 truncate">{chat.summary?.substring(0, 80) || '—'}</span>
                        <Link href={`/chat/${chat.chat_id}`} className="text-xs text-blue-400 hover:text-blue-300 flex-shrink-0">View →</Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── TRAINING TAB ── */}
      {tab === 'training' && (
        <div className="space-y-6">
          {/* Category Weakness Ranking */}
          <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">📉 Category Performance Ranking (weakest first)</h3>
            <div className="space-y-3">
              {trainingInsights.catScores.map(cat => (
                <div key={cat.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-300">{cat.label}</span>
                    <span className="text-sm font-mono font-bold" style={{ color: cat.pct < 60 ? '#ef4444' : cat.pct < 80 ? '#f59e0b' : '#22c55e' }}>{cat.pct}%</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${cat.pct}%`, background: cat.pct < 60 ? '#ef4444' : cat.pct < 80 ? '#f59e0b' : '#22c55e' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Issues */}
            <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-red-400 mb-4">🔴 Most Common Issues</h3>
              {trainingInsights.topIssues.length > 0 ? (
                <div className="space-y-2">
                  {trainingInsights.topIssues.map(([issue, count], i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <span className="text-slate-500 flex-shrink-0 font-mono text-xs mt-0.5">×{count}</span>
                      <span className="text-slate-300">{issue}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-slate-500 text-sm">Run Opus scorer to unlock per-message analysis.</p>}
            </div>

            {/* Coaching Focus */}
            <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-blue-400 mb-4">💡 Recurring Coaching Needs</h3>
              {trainingInsights.topTips.length > 0 ? (
                <div className="space-y-3">
                  {trainingInsights.topTips.map(([tip, count], i) => (
                    <div key={i} className="bg-blue-900/10 border border-blue-500/20 rounded-lg px-3 py-2">
                      <div className="text-xs text-blue-400 mb-1">×{count} occurrences</div>
                      <p className="text-xs text-slate-300">{tip}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-slate-500 text-sm">No coaching patterns yet.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
