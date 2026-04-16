'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AGENTS } from '@/lib/dataLoader';
import { gradeColor } from '@/lib/utils';
import { GradeBadge } from '@/components/GradeBadge';

const REFRESH_INTERVAL = 30; // seconds

interface LiveAgentStatus {
  id: string;
  name: string;
  chatUserId: string;
  chatsToday: number;
  openChats: number;
  closedChats: number;
  lastSeenMs: number;
  lastSeenAgo: string;
  status: 'active' | 'idle' | 'offline';
  statusLabel: string;
  firstChatToday: number;
}

interface OpenChatDetail {
  conversationId: string;
  agentName: string;
  agentId: string;
  customerName: string;
  websiteName: string;
  updatedAgo: string;
  updatedMs: number;
}

interface LiveData {
  ok: boolean;
  pulledAt: string;
  todayStr: string;
  summary: {
    activeAgents: number;
    idleAgents: number;
    offlineAgents: number;
    totalAgents: number;
    chatsToday: number;
    openChatsNow: number;
  };
  agents: LiveAgentStatus[];
  openChats: OpenChatDetail[];
  error?: string;
}

const STATUS_STYLES = {
  active: 'bg-green-500/15 text-green-400 border border-green-500/30',
  idle: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  offline: 'bg-red-500/15 text-red-400 border border-red-500/30',
};

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

export default function SupervisorPage() {
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [showOffline, setShowOffline] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/live-status');
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'API error');
      setData(json);
      setLastRefresh(new Date());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setCountdown(REFRESH_INTERVAL);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh + countdown
  useEffect(() => {
    const refreshTimer = setInterval(fetchData, REFRESH_INTERVAL * 1000);
    const countTimer = setInterval(() => {
      setCountdown(c => (c <= 1 ? REFRESH_INTERVAL : c - 1));
    }, 1000);
    return () => { clearInterval(refreshTimer); clearInterval(countTimer); };
  }, [fetchData]);

  // Match live agents to QA scored agents for grade info
  const getAgentGrade = (liveAgent: LiveAgentStatus) => {
    // Try to match by name (normalized)
    const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
    const qa = AGENTS.find(a => norm(a.name) === norm(liveAgent.name));
    return qa ? { grade: qa.grade, avg_score: qa.avg_score, agentId: qa.id } : null;
  };

  const activeAgents = data?.agents.filter(a => a.status === 'active') || [];
  const idleAgents = data?.agents.filter(a => a.status === 'idle') || [];
  const offlineAgents = data?.agents.filter(a => a.status === 'offline') || [];

  const visibleAgents = showOffline
    ? data?.agents || []
    : [...activeAgents, ...idleAgents];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-black text-white">Operations Dashboard</h1>
            <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              LIVE
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Real-time agent status · WellyTalk API · 
            {lastRefresh && <span className="ml-1">Updated {lastRefresh.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowOffline(s => !s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              showOffline
                ? 'bg-slate-800 border-slate-600 text-slate-400 hover:text-white'
                : 'bg-[#E91E8C]/15 border-[#E91E8C]/30 text-[#E91E8C]'
            }`}
          >
            {showOffline ? '👁 Hide Offline' : '👁 Show All'}
          </button>
          <button
            onClick={fetchData}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#E91E8C]/15 border border-[#E91E8C]/30 text-[#E91E8C] hover:bg-[#E91E8C]/25 transition-colors"
          >
            🔄 Refresh Now
          </button>
          <div className="text-xs text-slate-500">
            Auto-refresh in <span className="text-slate-300 font-mono">{countdown}s</span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          ⚠️ Failed to fetch live data: {error}
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-10 text-center">
          <div className="text-slate-400 text-sm">Connecting to WellyTalk API...</div>
        </div>
      )}

      {data && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Active Now"
              value={data.summary.activeAgents}
              sub="handling chats (<15m)"
              icon="🟢"
              color="#4ade80"
            />
            <StatCard
              label="Idle"
              value={data.summary.idleAgents}
              sub="last chat 15m–2h ago"
              icon="🟡"
              color="#fbbf24"
            />
            <StatCard
              label="Chats Today"
              value={data.summary.chatsToday.toLocaleString()}
              sub={`${data.todayStr} (ET)`}
              icon="💬"
            />
            <StatCard
              label="Open Now"
              value={data.summary.openChatsNow}
              sub="active conversations"
              icon="📨"
              color="#E91E8C"
            />
          </div>

          {/* Status breakdown bar */}
          <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4">
            <div className="flex items-center gap-4 flex-wrap text-sm">
              <span className="text-slate-400 text-xs uppercase tracking-wider">Team Status:</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-green-400 font-bold">{activeAgents.length}</span>
                <span className="text-slate-500">active</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-amber-400 font-bold">{idleAgents.length}</span>
                <span className="text-slate-500">idle</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-red-400 font-bold">{offlineAgents.length}</span>
                <span className="text-slate-500">offline</span>
              </span>
              <span className="text-slate-600 ml-2">|</span>
              <span className="text-slate-400 text-xs">
                Total with activity today: <span className="text-white font-semibold">{data.summary.totalAgents}</span>
              </span>
            </div>
          </div>

          {/* Open Chats Right Now */}
          {data.openChats.length > 0 && (
            <div className="bg-[#1A1A2E] border border-[#E91E8C]/30 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-[#E91E8C]/20 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E91E8C] animate-pulse" />
                <h2 className="text-sm font-semibold text-white">Live Open Chats ({data.openChats.length})</h2>
                <span className="text-xs text-slate-500">— currently active conversations</span>
              </div>
              <div className="divide-y divide-slate-700/30">
                {data.openChats.map((chat) => {
                  const qa = AGENTS.find(a => a.name.toLowerCase().includes(chat.agentName.toLowerCase().split(' ')[0]));
                  return (
                    <div key={chat.conversationId} className="flex items-center gap-4 px-4 py-3">
                      <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-white">
                          {qa ? (
                            <Link href={`/agent/${qa.id}`} className="hover:text-[#E91E8C] transition-colors">
                              {chat.agentName}
                            </Link>
                          ) : chat.agentName}
                        </span>
                        <span className="text-slate-500 text-xs ml-2">↔ {chat.customerName}</span>
                      </div>
                      <span className="text-xs text-slate-500">{chat.websiteName}</span>
                      <span className="text-xs text-green-400">{chat.updatedAgo}</span>
                      <Link
                        href={`/chat/${chat.conversationId}`}
                        className="text-xs px-2 py-1 rounded bg-[#7B2D8B]/20 text-[#E91E8C] hover:bg-[#E91E8C]/20 transition-colors"
                      >
                        View
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Agent Status Table */}
          <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#7B2D8B]/20 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-300">
                Agent Status
                {!showOffline && <span className="ml-2 text-xs text-slate-500">(offline hidden)</span>}
              </h2>
              <span className="text-xs text-slate-500">Sorted by last activity</span>
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#2D1B4E]/30">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Agent</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Last Active</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Chats Today</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Open Now</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">QA Grade</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">QA Score</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">First Chat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {visibleAgents.map((agent) => {
                    const qa = getAgentGrade(agent);
                    const firstTime = agent.firstChatToday
                      ? new Date(agent.firstChatToday).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                      : '—';
                    return (
                      <tr key={agent.id} className="hover:bg-[#2D1B4E]/20 transition-colors">
                        <td className="py-3 px-4">
                          {qa ? (
                            <Link href={`/agent/${qa.agentId}`} className="text-sm font-semibold text-white hover:text-[#E91E8C] transition-colors">
                              {agent.name}
                            </Link>
                          ) : (
                            <span className="text-sm font-semibold text-white">{agent.name}</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${STATUS_STYLES[agent.status]}`}>
                            {agent.statusLabel}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-300">{agent.lastSeenAgo}</td>
                        <td className="py-3 px-4">
                          <span className="text-sm font-bold text-white">{agent.chatsToday}</span>
                          <span className="text-xs text-slate-500 ml-1">({agent.closedChats} closed)</span>
                        </td>
                        <td className="py-3 px-4">
                          {agent.openChats > 0 ? (
                            <span className="text-sm font-bold text-green-400">{agent.openChats}</span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {qa ? <GradeBadge grade={qa.grade} /> : <span className="text-xs text-slate-600">no data</span>}
                        </td>
                        <td className="py-3 px-4">
                          {qa ? (
                            <span className="font-mono text-sm font-bold" style={{ color: gradeColor(qa.grade) }}>
                              {qa.avg_score}
                            </span>
                          ) : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-400">{firstTime}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {visibleAgents.length === 0 && (
                <div className="text-center py-10 text-slate-400 text-sm">No agent activity found for today.</div>
              )}
            </div>

            {/* Mobile cards */}
            <div className="block md:hidden divide-y divide-slate-700/30">
              {visibleAgents.map((agent) => {
                const qa = getAgentGrade(agent);
                return (
                  <div key={agent.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {qa ? (
                          <Link href={`/agent/${qa.agentId}`} className="font-semibold text-white text-sm hover:text-[#E91E8C]">
                            {agent.name}
                          </Link>
                        ) : <span className="font-semibold text-white text-sm">{agent.name}</span>}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLES[agent.status]}`}>
                        {agent.statusLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span>Last: {agent.lastSeenAgo}</span>
                      <span>Chats: {agent.chatsToday}</span>
                      {agent.openChats > 0 && <span className="text-green-400">Open: {agent.openChats}</span>}
                      {qa && <GradeBadge grade={qa.grade} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Agents with NO activity today (from QA data but not in live) */}
          {(() => {
            const liveNames = new Set(data.agents.map(a => a.name.toLowerCase().trim()));
            const missingAgents = AGENTS.filter(qa => {
              const n = qa.name.toLowerCase().trim();
              return !liveNames.has(n) && !Array.from(liveNames).some(ln => ln.includes(n.split(' ')[0]) || n.includes(ln.split(' ')[0]));
            });
            if (missingAgents.length === 0) return null;
            return (
              <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-[#7B2D8B]/20">
                  <h2 className="text-sm font-semibold text-slate-400">⚠️ Agents with No Activity Today ({missingAgents.length})</h2>
                  <p className="text-xs text-slate-600 mt-1">These agents have QA history but no chats today</p>
                </div>
                <div className="flex flex-wrap gap-2 p-4">
                  {missingAgents.map(a => (
                    <Link key={a.id} href={`/agent/${a.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2D1B4E]/30 border border-[#7B2D8B]/20 text-slate-400 hover:text-white text-xs transition-colors">
                      <GradeBadge grade={a.grade} />
                      <span>{a.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Footer */}
          <div className="text-xs text-slate-600 text-center">
            Data from WellyTalk API · Polling every {REFRESH_INTERVAL}s · Last pull: {data.pulledAt ? new Date(data.pulledAt).toLocaleTimeString() : '—'}
          </div>
        </>
      )}
    </div>
  );
}
