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
  was_transferred: boolean;
  created_at: string;
  week_start: string;
}

export default function AutoFailsReport() {
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

  // Filter for flagged tickets
  const flaggedTickets = useMemo(() => {
    return allTickets
      .filter(t => t.has_recall || (t.frt_seconds && t.frt_seconds > 300) || !t.is_closed)
      .map(t => ({
        ...t,
        issueType: t.has_recall ? 'Recall' : (t.frt_seconds && t.frt_seconds > 300) ? 'Slow FRT' : 'Not Closed',
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [allTickets]);

  // Group by agent
  const grouped = useMemo(() => {
    const byAgent = new Map<string, typeof flaggedTickets>();
    flaggedTickets.forEach(t => {
      const current = byAgent.get(t.agent_name) || [];
      current.push(t);
      byAgent.set(t.agent_name, current);
    });

    return Array.from(byAgent.entries())
      .map(([agentName, tickets]) => ({
        agent_name: agentName,
        count: tickets.length,
        tickets,
      }))
      .sort((a, b) => b.count - a.count);
  }, [flaggedTickets]);

  const formatDateTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatFRT = (seconds: number | null) => {
    if (seconds === null) return 'N/A';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    return `${(seconds / 60).toFixed(1)}m`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">🚨 Flag Report</h1>
        <p className="text-slate-400 text-sm mt-1">Flagged tickets · Recalls, slow FRT (&gt;300s), or not closed</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading tickets...</div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">✅</div>
          <div className="text-white font-semibold text-lg">No Flagged Tickets!</div>
          <div className="text-slate-400 text-sm mt-2">Great job team — no auto-fail conditions triggered.</div>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ agent_name, count, tickets }) => (
            <div key={agent_name} className="bg-[#1A1A2E] border border-red-500/30 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between gap-2 flex-wrap px-5 py-4 bg-red-900/10 border-b border-red-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 font-black text-sm">
                    {count}
                  </div>
                  <span className="font-semibold text-white">{agent_name}</span>
                </div>
                <span className="text-xs text-red-400 font-semibold">{count} flagged ticket{count !== 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-slate-700/30">
                {tickets.map((ticket, i) => (
                  <div key={i} className="px-4 py-3 hover:bg-[#2D1B4E]/15 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs text-slate-400 font-mono">{formatDateTime(ticket.created_at)}</span>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                            ticket.issueType === 'Recall' ? 'bg-red-500/20 text-red-400' :
                            ticket.issueType === 'Slow FRT' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-orange-500/20 text-orange-400'
                          }`}>
                            {ticket.issueType}
                          </span>
                        </div>
                        <div className="text-sm text-slate-300 truncate">{ticket.subject || '—'}</div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                          <span>{ticket.category}</span>
                          <span>FRT: {formatFRT(ticket.frt_seconds)}</span>
                          <span>{ticket.is_closed ? '✅ Closed' : '⏳ Open'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
