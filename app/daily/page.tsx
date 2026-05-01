'use client';
import Link from 'next/link';
import { useMemo, useEffect, useState, useCallback } from 'react';

interface LiveAgent {
  id: string;
  name: string;
  chatUserId: string;
  chatsToday: number;
  openChats: number;
  lastSeenMs: number;
  lastSeenAgo: string;
  status: 'active' | 'idle' | 'offline';
  statusLabel: string;
}

interface LiveStatus {
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
  agents: LiveAgent[];
}

interface Ticket {
  id: string;
  agent_name: string;
  category: string;
  auto_fail: boolean;
  has_recall: boolean;
  is_closed: boolean;
  created_at: string;
  welly_conversation_id?: string;
}

function fmt(s: number | null): string {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function StatCard({ label, value, icon, color }: {
  label: string; value: string | number; icon: string; color?: string;
}) {
  return (
    <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4 glow-panel">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</div>
          <div className="text-2xl font-black" style={color ? { color } : {}}>{value}</div>
        </div>
      </div>
    </div>
  );
}

const REFRESH_INTERVAL = 30; // seconds

export default function DailyPage() {
  const [liveData, setLiveData] = useState<LiveStatus | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // Fetch live status
      const liveRes = await fetch('/api/live-status');
      const liveJson = await liveRes.json();
      if (!liveJson.ok) throw new Error(liveJson.error || 'Live status error');
      setLiveData(liveJson);

      // Fetch tickets (today only, limited to 500)
      const ticketsRes = await fetch('/api/data/tickets?limit=500');
      const ticketsJson = await ticketsRes.ok ? await ticketsRes.json() : { tickets: [] };
      setTickets(ticketsJson.tickets || []);

      setCountdown(REFRESH_INTERVAL);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
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
    return () => {
      clearInterval(refreshTimer);
      clearInterval(countTimer);
    };
  }, [fetchData]);

  // Filter tickets for today (ET timezone)
  const todayTickets = useMemo(() => {
    if (!liveData) return [];
    const todayStr = liveData.todayStr;
    return tickets.filter(t => t.created_at.startsWith(todayStr));
  }, [tickets, liveData]);

  // Stats
  const stats = useMemo(() => {
    const total = todayTickets.length;
    const resolved = todayTickets.filter(t => t.is_closed).length;
    const open = total - resolved;

    return {
      activeAgents: liveData?.summary.activeAgents || 0,
      ticketsToday: total,
      openUnresolved: open,
    };
  }, [todayTickets, liveData]);

  // Today's flags
  const todayFlags = useMemo(() => {
    const recalls = todayTickets.filter(t => t.has_recall);
    const autoFails = todayTickets.filter(t => t.auto_fail);
    return {
      recalls: recalls.map(t => ({
        agent_name: t.agent_name,
        category: t.category,
        conversationId: t.welly_conversation_id || t.id,
      })),
      autoFails: autoFails.map(t => ({
        agent_name: t.agent_name,
        category: t.category,
        conversationId: t.welly_conversation_id || t.id,
      })),
    };
  }, [todayTickets]);

  // Hourly activity
  const hourlyActivity = useMemo(() => {
    if (todayTickets.length === 0) return [];

    const byHour = new Map<number, number>();
    todayTickets.forEach(t => {
      const date = new Date(t.created_at);
      const hour = date.getHours();
      byHour.set(hour, (byHour.get(hour) || 0) + 1);
    });

    // Fill in all hours (0-23)
    const result: Array<{ hour: number; label: string; count: number }> = [];
    for (let h = 0; h < 24; h++) {
      const count = byHour.get(h) || 0;
      const label = h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`;
      result.push({ hour: h, label, count });
    }
    return result;
  }, [todayTickets]);

  const maxHourlyCount = hourlyActivity.length > 0 ? Math.max(...hourlyActivity.map(h => h.count), 1) : 1;

  // Get today's date in ET
  const getETDate = () => {
    const now = new Date();
    const etNow = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    return etNow.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-black text-white">Daily View</h1>
            <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              LIVE
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            {getETDate()} (ET) · Live ops view
          </p>
        </div>
        <div className="text-xs text-slate-500">
          Auto-refresh in <span className="text-slate-300 font-mono font-bold">{countdown}s</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          ⚠️ Error: {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading live data...</div>
      ) : (
        <>
          {/* Row 1: KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard label="Active Agents" value={stats.activeAgents} icon="🟢" color="#4ade80" />
            <StatCard label="Tickets Today" value={stats.ticketsToday} icon="💬" color="#E91E8C" />
            <StatCard label="Open/Unresolved" value={stats.openUnresolved} icon="📋" color="#fbbf24" />
          </div>

          {/* Row 2: Live Agent Status + Today's Flags */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* LEFT: Live Agent Status (55%) */}
            <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl overflow-hidden glow-panel">
              <div className="px-5 py-3 border-b border-[#7B2D8B]/20 bg-[#2D1B4E]/30">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Live Agent Status</h3>
              </div>

              {liveData?.agents && liveData.agents.length > 0 ? (
                <div className="divide-y divide-slate-700/30 max-h-96 overflow-y-auto">
                  {liveData.agents.map(agent => {
                    const statusColor =
                      agent.status === 'active'
                        ? 'bg-green-500/15 text-green-400'
                        : agent.status === 'idle'
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-red-500/15 text-red-400';

                    return (
                      <div key={agent.id} className="px-4 py-3 hover:bg-[#2D1B4E]/15 transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-white text-sm truncate">{agent.name}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{agent.lastSeenAgo}</div>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap border ${statusColor}`}>
                            {agent.statusLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <span>Chats: <span className="text-white font-bold">{agent.chatsToday}</span></span>
                          {agent.openChats > 0 && (
                            <span className="text-green-400">Open: <span className="font-bold">{agent.openChats}</span></span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-slate-500 text-sm">
                  No live data — agents may be offline
                </div>
              )}
            </div>

            {/* RIGHT: Today's Flags (45%) */}
            <div className="space-y-4">
              {/* Recalls */}
              <div className="bg-[#1A1A2E] border border-red-500/20 rounded-xl overflow-hidden glow-panel">
                <div className="px-4 py-3 border-b border-red-500/20 bg-red-500/5">
                  <h4 className="text-sm font-semibold text-red-400">🔔 Recall Alerts</h4>
                </div>
                {todayFlags.recalls.length > 0 ? (
                  <div className="divide-y divide-slate-700/30 max-h-40 overflow-y-auto">
                    {todayFlags.recalls.map((flag, i) => (
                      <div key={i} className="px-4 py-2 hover:bg-red-500/5 transition-colors flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-white">{flag.agent_name}</div>
                          <div className="text-xs text-slate-500">{flag.category}</div>
                        </div>
                        <Link
                          href={`/chat/${flag.conversationId}`}
                          className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors whitespace-nowrap"
                        >
                          View →
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-4 text-center text-slate-500 text-xs">✅ No recalls today</div>
                )}
              </div>

              {/* Auto-fails */}
              <div className="bg-[#1A1A2E] border border-yellow-500/20 rounded-xl overflow-hidden glow-panel">
                <div className="px-4 py-3 border-b border-yellow-500/20 bg-yellow-500/5">
                  <h4 className="text-sm font-semibold text-yellow-400">⚠️ Auto-fail Alerts</h4>
                </div>
                {todayFlags.autoFails.length > 0 ? (
                  <div className="divide-y divide-slate-700/30 max-h-40 overflow-y-auto">
                    {todayFlags.autoFails.map((flag, i) => (
                      <div key={i} className="px-4 py-2 hover:bg-yellow-500/5 transition-colors flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-white">{flag.agent_name}</div>
                          <div className="text-xs text-slate-500">{flag.category}</div>
                        </div>
                        <Link
                          href={`/chat/${flag.conversationId}`}
                          className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors whitespace-nowrap"
                        >
                          View →
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-4 text-center text-slate-500 text-xs">✅ No auto-fails today</div>
                )}
              </div>
            </div>
          </div>

          {/* Row 3: Hourly Activity */}
          <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4 glow-panel">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Hourly Activity (Today)</h3>

            {todayTickets.length > 0 ? (
              <div className="grid grid-cols-12 gap-1">
                {hourlyActivity.map((h, i) => {
                  const pct = h.count > 0 ? (h.count / maxHourlyCount) * 100 : 0;
                  return (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className="w-full bg-slate-700/30 rounded relative group">
                        <div
                          className="w-full rounded transition-all"
                          style={{
                            height: `${Math.max(pct, 5)}px`,
                            background: pct > 0 ? 'linear-gradient(180deg, #E91E8C 0%, #7B2D8B 100%)' : 'transparent',
                          }}
                        />
                        {h.count > 0 && (
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {h.count}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 text-center">{h.label}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 text-sm">No activity today yet</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
