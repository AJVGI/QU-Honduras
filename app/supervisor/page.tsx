'use client';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { ALL_CHATS, AGENTS, getChatResponseMetrics } from '@/lib/dataLoader';
import { GradeBadge } from '@/components/GradeBadge';
import { gradeColor } from '@/lib/utils';

export default function SupervisorPage() {
  const [countdown, setCountdown] = useState(60);

  // Today in UTC-4 (Eastern)
  const etNow = new Date(Date.now() - 4 * 3600000);
  const todayStr = etNow.toISOString().slice(0, 10);

  // Auto-refresh
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          window.location.reload();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Today's chats
  const todayChats = useMemo(() => {
    return ALL_CHATS.filter(c => c.timestamp.startsWith(todayStr));
  }, [todayStr]);

  // Top stats
  const stats = useMemo(() => {
    const activeToday = new Set(todayChats.map(c => c.agent_id)).size;
    const chatsToday = todayChats.length;
    const autoFailsToday = todayChats.filter(c => c.auto_fail.triggered).length;
    const avgScoreToday = chatsToday > 0
      ? todayChats.reduce((s, c) => s + c.total_score, 0) / chatsToday
      : 0;
    return { activeToday, chatsToday, autoFailsToday, avgScoreToday };
  }, [todayChats]);

  // Agent status
  const agentStatus = useMemo(() => {
    return AGENTS.map(agent => {
      const chatsToday = agent.chats.filter(c => c.timestamp.startsWith(todayStr));
      const todayMetrics = chatsToday.map(c => getChatResponseMetrics(c));
      const avgResponseRate = todayMetrics.length > 0
        ? todayMetrics.reduce((s, m) => s + m.responseRate, 0) / todayMetrics.length
        : 0;
      const autoFailsToday = chatsToday.filter(c => c.auto_fail.triggered).length;

      // Relative time from lastActive
      let relativeTime = '—';
      let status: 'active' | 'idle' | 'offline' = 'offline';
      if (agent.lastActive) {
        const lastActiveTime = new Date(agent.lastActive).getTime();
        const nowTime = Date.now();
        const diffMinutes = (nowTime - lastActiveTime) / (1000 * 60);
        
        if (diffMinutes < 5) {
          relativeTime = 'just now';
          status = 'active';
        } else if (diffMinutes < 60) {
          relativeTime = `${Math.floor(diffMinutes)}m ago`;
          status = diffMinutes < 120 ? 'active' : 'idle';
        } else if (diffMinutes < 60 * 24) {
          relativeTime = `${Math.floor(diffMinutes / 60)}h ago`;
          status = diffMinutes < 120 ? 'active' : diffMinutes < 480 ? 'idle' : 'offline';
        } else {
          relativeTime = `${Math.floor(diffMinutes / (60 * 24))} days ago`;
          status = 'offline';
        }
      }

      return {
        agent,
        chatsToday: chatsToday.length,
        avgResponseRate,
        autoFailsToday,
        relativeTime,
        status,
        lastActiveTime: agent.lastActive ? new Date(agent.lastActive).getTime() : 0,
      };
    }).sort((a, b) => b.lastActiveTime - a.lastActiveTime);
  }, [todayStr]);

  // Recent auto-fails today
  const recentAutoFails = useMemo(() => {
    return todayChats
      .filter(c => c.auto_fail.triggered)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
  }, [todayChats]);

  // Silent chat alerts
  const silentAlerts = useMemo(() => {
    return todayChats
      .map(c => ({ chat: c, metrics: getChatResponseMetrics(c) }))
      .filter(({ metrics }) => metrics.customerUnresponded >= 2)
      .sort((a, b) => new Date(b.chat.timestamp).getTime() - new Date(a.chat.timestamp).getTime());
  }, [todayChats]);

  const StatusPill = ({ status }: { status: 'active' | 'idle' | 'offline' }) => {
    const config = {
      active: { icon: '🟢', bg: 'bg-green-500/20', text: 'text-green-400', label: 'Active' },
      idle: { icon: '🟡', bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Idle' },
      offline: { icon: '🔴', bg: 'bg-red-500/20', text: 'text-red-400', label: 'Offline' },
    }[status];
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.text}`}>
        {config.icon} {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">🖥️ Operations Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Live agent monitoring · Eastern Time</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">🔄 Auto-refresh in {countdown}s</span>
          <Link href="/" className="text-slate-400 hover:text-white text-sm">← Back</Link>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Today', value: stats.activeToday, color: '#00C882' },
          { label: 'Chats Today', value: stats.chatsToday, color: '#E91E8C' },
          { label: 'Auto-Fails', value: stats.autoFailsToday, color: '#FF4444' },
          { label: 'Avg Score', value: stats.avgScoreToday.toFixed(0), color: '#FFD600' },
        ].map(stat => (
          <div key={stat.label} className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4">
            <div className="text-3xl font-black" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-xs text-slate-400 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Agent Status Table */}
      <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#7B2D8B]/20">
          <h2 className="text-lg font-bold text-white">👥 Agent Status</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#2D1B4E]/30">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Agent</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Grade</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Last Active</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Chats Today</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Response Rate</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Auto-Fails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {agentStatus.map(({ agent, chatsToday, avgResponseRate, autoFailsToday, relativeTime, status }) => (
                <tr key={agent.id} className="hover:bg-[#2D1B4E]/15 transition-colors">
                  <td className="py-3 px-4">
                    <Link href={`/agent/${agent.id}`} className="text-[#E91E8C] hover:text-blue-300 font-medium">
                      {agent.name}
                    </Link>
                  </td>
                  <td className="py-3 px-4">
                    <GradeBadge grade={agent.grade} />
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-400">{relativeTime}</td>
                  <td className="py-3 px-4">
                    <StatusPill status={status} />
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-300">{chatsToday}</td>
                  <td className="py-3 px-4 text-sm text-slate-300">
                    {chatsToday > 0 ? `${avgResponseRate.toFixed(0)}%` : '—'}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {autoFailsToday > 0 ? (
                      <span className="text-red-400 font-medium">🚨 {autoFailsToday}</span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Auto-Fails */}
        <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#7B2D8B]/20">
            <h2 className="text-lg font-bold text-white">🚨 Recent Auto-Fails Today</h2>
          </div>
          <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
            {recentAutoFails.length > 0 ? (
              recentAutoFails.map((chat, i) => (
                <div key={i} className="bg-red-900/10 border border-red-500/20 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">
                      {new Date(chat.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                    <Link
                      href={`/chat/${chat.chat_id}`}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      View →
                    </Link>
                  </div>
                  <Link href={`/agent/${chat.agent_id}`} className="text-sm text-[#E91E8C] hover:text-blue-300 font-medium">
                    {chat.agent_name}
                  </Link>
                  <div className="text-xs text-slate-400 mt-1">
                    Reason: {chat.auto_fail.reason || 'Auto-fail triggered'}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Score: <span style={{ color: gradeColor(chat.grade) }}>{chat.total_score}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-sm text-center py-8">✅ No auto-fails today</p>
            )}
          </div>
        </div>

        {/* Silent Chat Alerts */}
        <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#7B2D8B]/20">
            <h2 className="text-lg font-bold text-white">🔴 Silent Chat Alerts</h2>
            <p className="text-xs text-slate-400 mt-1">Chats with 2+ unresponded customer messages</p>
          </div>
          <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
            {silentAlerts.length > 0 ? (
              silentAlerts.map(({ chat, metrics }, i) => (
                <div key={i} className="bg-orange-900/10 border border-orange-500/20 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">
                      {new Date(chat.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                    <Link
                      href={`/chat/${chat.chat_id}`}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      View →
                    </Link>
                  </div>
                  <Link href={`/agent/${chat.agent_id}`} className="text-sm text-[#E91E8C] hover:text-blue-300 font-medium">
                    {chat.agent_name}
                  </Link>
                  <div className="text-xs text-slate-400 mt-1">
                    Unresponded: {metrics.customerUnresponded} customer message(s)
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Response Rate: <span className="text-orange-400">{metrics.responseRate.toFixed(0)}%</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-sm text-center py-8">✅ No silent chats today</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
