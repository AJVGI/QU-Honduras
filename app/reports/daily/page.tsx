'use client';
import { useMemo, useEffect, useState } from 'react';

interface Ticket {
  id: string;
  agent_name: string;
  subject: string;
  category: string;
  frt_seconds: number | null;
  is_closed: boolean;
  has_recall: boolean;
  created_at: string;
  week_start: string;
}

export default function DailyReport() {
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch tickets
  useEffect(() => {
    const fetchTickets = async () => {
      try {
        setLoading(true);
        // Get the most recent week's data
        const weeksRes = await fetch('/api/data/weeks');
        const weeksData = await weeksRes.json();
        const weeks = weeksData.weeks || [];

        if (weeks.length > 0) {
          const weekStart = weeks[0].week_start;
          const ticketsRes = await fetch(`/api/data/tickets?week_start=${weekStart}&limit=500&offset=0`);
          const ticketsData = await ticketsRes.json();
          setAllTickets(ticketsData.tickets || []);
        }
      } catch (err) {
        console.error('Error fetching tickets:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTickets();
  }, []);

  // Filter for today (ET timezone)
  const todayTickets = useMemo(() => {
    const now = new Date();
    const etNow = new Date(now.getTime() - 4 * 60 * 60 * 1000); // ET timezone
    const todayStr = etNow.toISOString().split('T')[0];

    return allTickets
      .filter(t => t.created_at.startsWith(todayStr))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [allTickets]);

  // Agent performance for today
  const agentPerf = useMemo(() => {
    const byAgent = new Map<string, { tickets: number; closed: number; recalls: number; avgFRT: number | null }>();

    todayTickets.forEach(t => {
      const current = byAgent.get(t.agent_name) || { tickets: 0, closed: 0, recalls: 0, avgFRT: null };
      current.tickets++;
      if (t.is_closed) current.closed++;
      if (t.has_recall) current.recalls++;
      byAgent.set(t.agent_name, current);
    });

    return Array.from(byAgent.entries()).map(([name, stats]) => {
      const frts = todayTickets
        .filter(t => t.agent_name === name && t.frt_seconds !== null && t.is_closed)
        .map(t => t.frt_seconds as number);
      const avgFRT = frts.length > 0 ? frts.reduce((a, b) => a + b, 0) / frts.length : null;
      
      return {
        agent_name: name,
        ...stats,
        closure_pct: stats.tickets > 0 ? (stats.closed / stats.tickets) * 100 : 0,
        avgFRT,
      };
    }).sort((a, b) => b.closure_pct - a.closure_pct);
  }, [todayTickets]);

  const stats = useMemo(() => ({
    total: todayTickets.length,
    closed: todayTickets.filter(t => t.is_closed).length,
    recalls: todayTickets.filter(t => t.has_recall).length,
    avgClosure: todayTickets.length > 0
      ? ((todayTickets.filter(t => t.is_closed).length / todayTickets.length) * 100).toFixed(1)
      : '0',
  }), [todayTickets]);

  const formatFRT = (seconds: number | null) => {
    if (seconds === null) return 'N/A';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    return `${(seconds / 60).toFixed(1)}m`;
  };

  const formatDateTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const today = new Date();
  const etToday = new Date(today.getTime() - 4 * 60 * 60 * 1000);
  const dayStr = etToday.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">📅 Daily Report</h1>
        <p className="text-slate-400 text-sm mt-1">{dayStr} (ET)</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading tickets...</div>
      ) : todayTickets.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📭</div>
          <div className="text-white font-semibold">No tickets scored today yet</div>
          <div className="text-slate-400 text-sm mt-2">Pipeline runs every 6-12 hours.</div>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4 text-center">
              <div className="text-2xl font-black text-white">{stats.total}</div>
              <div className="text-xs text-slate-400 mt-1">Total Tickets</div>
            </div>
            <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4 text-center">
              <div className="text-2xl font-black text-green-400">{stats.avgClosure}%</div>
              <div className="text-xs text-slate-400 mt-1">Closure Rate</div>
            </div>
            <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4 text-center">
              <div className={`text-2xl font-black ${stats.recalls > 0 ? 'text-red-400' : 'text-green-400'}`}>{stats.recalls}</div>
              <div className="text-xs text-slate-400 mt-1">Recalls</div>
            </div>
          </div>

          {/* Agent Performance */}
          <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[#7B2D8B]/20 bg-[#2D1B4E]/30">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Agent Performance Today</h3>
            </div>

            {/* Mobile */}
            <div className="block md:hidden divide-y divide-slate-700/30">
              {agentPerf.map((perf, i) => (
                <div key={i} className="px-4 py-3 space-y-2">
                  <div className="font-semibold text-white">{perf.agent_name}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-slate-400">
                      Closure: <span className="text-green-400 font-bold">{perf.closure_pct.toFixed(0)}%</span>
                    </div>
                    <div className="text-slate-400">
                      FRT: <span className="text-slate-300 font-bold">{formatFRT(perf.avgFRT)}</span>
                    </div>
                    <div className="text-slate-400">
                      Tickets: <span className="text-slate-300 font-bold">{perf.tickets}</span>
                    </div>
                    <div className="text-slate-400">
                      Recalls: <span className={perf.recalls > 0 ? 'text-red-400 font-bold' : 'text-slate-500'}>{perf.recalls}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#1A1A2E]">
                  <tr>
                    {['Agent', 'Tickets', 'Closed', 'Closure %', 'Avg FRT', 'Recalls'].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {agentPerf.map((perf, i) => (
                    <tr key={i} className="hover:bg-[#2D1B4E]/15 transition-colors">
                      <td className="py-3 px-4 text-sm font-semibold text-white">{perf.agent_name}</td>
                      <td className="py-3 px-4 text-sm text-slate-300">{perf.tickets}</td>
                      <td className="py-3 px-4 text-sm text-slate-300">{perf.closed}</td>
                      <td className="py-3 px-4 text-sm text-green-400 font-bold">{perf.closure_pct.toFixed(1)}%</td>
                      <td className="py-3 px-4 text-sm text-slate-300">{formatFRT(perf.avgFRT)}</td>
                      <td className="py-3 px-4 text-sm">
                        {perf.recalls > 0 ? <span className="text-red-400">🔔 {perf.recalls}</span> : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Tickets */}
          <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[#7B2D8B]/20 bg-[#2D1B4E]/30">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Recent Tickets</h3>
            </div>

            <div className="divide-y divide-slate-700/30">
              {todayTickets.slice(0, 20).map((ticket, i) => (
                <div key={i} className="px-4 py-3 hover:bg-[#2D1B4E]/15 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-slate-400">{formatDateTime(ticket.created_at)}</span>
                        <span className="text-sm text-[#E91E8C]">{ticket.agent_name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${ticket.is_closed ? 'bg-green-400/20 text-green-400' : 'bg-yellow-400/20 text-yellow-400'}`}>
                          {ticket.is_closed ? 'Closed' : 'Open'}
                        </span>
                        {ticket.has_recall && <span className="text-xs text-red-400">🔔 Recall</span>}
                      </div>
                      <div className="text-sm text-slate-300 truncate">{ticket.subject || '—'}</div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                        <span>{ticket.category}</span>
                        <span>FRT: {formatFRT(ticket.frt_seconds)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
