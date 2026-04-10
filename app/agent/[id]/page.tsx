'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { getAgent } from '@/lib/mockData';
import { gradeColor, gradeBg, formatDate, formatShortDate } from '@/lib/utils';
import { CATEGORY_LABELS, CATEGORY_MAX } from '@/lib/types';
import { GradeBadge } from '@/components/GradeBadge';

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const agent = getAgent(id);
  const [expandedChat, setExpandedChat] = useState<string | null>(null);

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Agent not found.</div>
      </div>
    );
  }

  const autoFails = agent.chats.filter(c => c.auto_fail.triggered);
  const recentChats = [...agent.chats].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Radar data
  const radarData = Object.keys(CATEGORY_LABELS).map(k => {
    const avg = agent.chats.reduce((s, c) =>
      s + c.categories[k as keyof typeof c.categories].score, 0) / agent.chats.length;
    const pct = Math.round((avg / CATEGORY_MAX[k]) * 100);
    return { category: CATEGORY_LABELS[k], score: pct };
  });

  // Score timeline (last 30 chats chronologically)
  const timeline = [...agent.chats]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-30)
    .map(c => ({ date: formatShortDate(c.timestamp), score: c.total_score }));

  // Last 5 coaching tips (unique)
  const tips = [...new Set(recentChats.map(c => c.coaching_tip))].slice(0, 5);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Back */}
      <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
        ← Back to Team Overview
      </Link>

      {/* Agent Header */}
      <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-black text-white">{agent.name}</h1>
              <GradeBadge grade={agent.grade} size="lg" />
            </div>
            <p className="text-slate-400 text-sm">JackpotDaily Casino · Honduras Support Team</p>
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <div className="text-3xl font-black" style={{ color: gradeColor(agent.grade) }}>
                {agent.avg_score}
              </div>
              <div className="text-xs text-slate-400">Avg Score</div>
            </div>
            <div>
              <div className="text-3xl font-black text-white">{agent.chats.length}</div>
              <div className="text-xs text-slate-400">Total Chats</div>
            </div>
            <div>
              <div className={`text-3xl font-black ${agent.trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {agent.trend >= 0 ? '↑' : '↓'}{Math.abs(agent.trend)}
              </div>
              <div className="text-xs text-slate-400">WoW Trend</div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Radar */}
        <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Category Performance</h2>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 9 }} />
              <Radar dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v: number) => [`${v}%`, 'Score']}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Score Timeline */}
        <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Score Timeline (last 30 chats)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              />
              <Line type="monotone" dataKey="score" stroke={gradeColor(agent.grade)} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Coaching Tips + Auto-Fail Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#1e293b] border border-slate-700/50 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">💡 Coaching Tips</h2>
          <ul className="space-y-2">
            {tips.map((tip, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-300">
                <span className="text-blue-400 font-bold shrink-0">{i + 1}.</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>

        {autoFails.length > 0 ? (
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-red-400 mb-3">⚠️ Auto-Fail Log ({autoFails.length})</h2>
            <ul className="space-y-3">
              {autoFails.map(c => (
                <li key={c.chat_id} className="text-xs">
                  <div className="text-red-300 font-mono">{c.chat_id}</div>
                  <div className="text-red-400/80 mt-0.5">{c.auto_fail.reason}</div>
                  <div className="text-slate-500 mt-0.5">{formatDate(c.timestamp)}</div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-green-400 mb-2">✅ Auto-Fail Log</h2>
            <p className="text-green-400/70 text-sm">No auto-fail conditions triggered.</p>
          </div>
        )}
      </div>

      {/* Recent Chats Table */}
      <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-700/50">
          <h2 className="text-sm font-semibold text-slate-300">Recent Chats</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Chat ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Score</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Grade</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Summary</th>
              </tr>
            </thead>
            <tbody>
              {recentChats.map(chat => (
                <>
                  <tr
                    key={chat.chat_id}
                    className="border-b border-slate-700/30 hover:bg-slate-700/20 cursor-pointer transition-colors"
                    onClick={() => setExpandedChat(expandedChat === chat.chat_id ? null : chat.chat_id)}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/chat/${encodeURIComponent(chat.chat_id)}`}
                        onClick={e => e.stopPropagation()}
                        className="text-blue-400 hover:text-blue-300 font-mono text-xs"
                      >
                        {chat.chat_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(chat.timestamp)}</td>
                    <td className="px-4 py-3 font-mono font-bold" style={{ color: gradeColor(chat.grade) }}>
                      {chat.auto_fail.triggered ? '0 ⚠️' : chat.total_score}
                    </td>
                    <td className="px-4 py-3"><GradeBadge grade={chat.grade} /></td>
                    <td className="px-4 py-3 text-slate-400 text-xs max-w-xs truncate">{chat.summary}</td>
                  </tr>
                  {expandedChat === chat.chat_id && (
                    <tr key={`${chat.chat_id}-expanded`} className="bg-slate-800/50 border-b border-slate-700/30">
                      <td colSpan={5} className="px-4 py-4">
                        <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-3 text-sm text-slate-300">
                          <span className="text-blue-400 font-semibold">💡 Coaching Tip: </span>
                          {chat.coaching_tip}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
