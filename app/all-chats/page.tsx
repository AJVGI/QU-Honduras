'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const PER_PAGE = 50;

interface Ticket {
  id: string;
  agent_name: string;
  agent_alias: string;
  subject: string;
  category: string;
  frt_seconds: number | null;
  is_closed: boolean;
  has_recall: boolean;
  was_transferred: boolean;
  created_at: string;
  week_start: string;
}

interface Week {
  week_start: string;
  week_end: string;
  completed_at: string;
}

function SortIcon({ field, sortField, sortOrder }: { field: string; sortField: string; sortOrder: 'asc' | 'desc' }) {
  if (sortField !== field) return <span className="text-slate-600">↕</span>;
  return <span className="text-[#E91E8C]">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
}

export default function AllChatsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState<'date' | 'frt' | 'closed'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const router = useRouter();

  // Fetch weeks on mount
  useEffect(() => {
    const fetchWeeks = async () => {
      try {
        const res = await fetch('/api/data/weeks');
        const data = await res.json();
        setWeeks(data.weeks || []);
        if (data.weeks && data.weeks.length > 0) {
          setSelectedWeek(data.weeks[0].week_start);
        }
      } catch (err) {
        console.error('Error fetching weeks:', err);
      }
    };
    fetchWeeks();
  }, []);

  // Fetch tickets when week changes
  useEffect(() => {
    const fetchTickets = async () => {
      if (!selectedWeek) return;
      setLoading(true);
      try {
        const params = new URLSearchParams({
          week_start: selectedWeek,
          limit: '2000',
          offset: '0',
        });
        const res = await fetch(`/api/data/tickets?${params}`);
        const data = await res.json();
        setTickets(data.tickets || []);
        setPage(0);
      } catch (err) {
        console.error('Error fetching tickets:', err);
        setTickets([]);
      } finally {
        setLoading(false);
      }
    };
    fetchTickets();
  }, [selectedWeek]);

  // Filter and sort tickets
  const filteredTickets = useMemo(() => {
    let result = tickets;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(t =>
        t.agent_name.toLowerCase().includes(term) ||
        t.subject.toLowerCase().includes(term)
      );
    }

    if (selectedAgent !== 'all') {
      result = result.filter(t => t.agent_name === selectedAgent);
    }

    if (selectedCategory !== 'all') {
      result = result.filter(t => t.category === selectedCategory);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      if (sortField === 'date') {
        aVal = new Date(a.created_at).getTime();
        bVal = new Date(b.created_at).getTime();
      } else if (sortField === 'frt') {
        aVal = a.frt_seconds ?? Infinity;
        bVal = b.frt_seconds ?? Infinity;
      } else if (sortField === 'closed') {
        aVal = a.is_closed ? 1 : 0;
        bVal = b.is_closed ? 1 : 0;
      }

      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    return result;
  }, [tickets, searchTerm, selectedAgent, selectedCategory, sortField, sortOrder]);

  // Get unique agents and categories from current tickets
  const agents = useMemo(
    () => Array.from(new Set(tickets.map(t => t.agent_name))).sort(),
    [tickets]
  );
  const categories = useMemo(
    () => Array.from(new Set(tickets.map(t => t.category))).sort(),
    [tickets]
  );

  // Pagination
  const totalPages = Math.ceil(filteredTickets.length / PER_PAGE);
  const pageTickets = filteredTickets.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setPage(0);
  };

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

  const stats = useMemo(() => ({
    total: filteredTickets.length,
    closed: filteredTickets.filter(t => t.is_closed).length,
    recalls: filteredTickets.filter(t => t.has_recall).length,
  }), [filteredTickets]);

  return (
    <div className="space-y-6 max-w-[1600px]">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-white">💬 All Chats</h1>
        <Link href="/" className="text-slate-400 hover:text-white text-sm">← Back</Link>
      </div>

      {/* Controls */}
      <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Week selector */}
          <select
            value={selectedWeek || ''}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="px-3 py-2 bg-[#0D0D1A] border border-[#7B2D8B]/30 rounded-lg text-white text-sm focus:outline-none focus:border-[#E91E8C]"
            disabled={loading}
          >
            {weeks.map(w => (
              <option key={w.week_start} value={w.week_start}>
                Week of {new Date(w.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </option>
            ))}
          </select>

          {/* Search */}
          <input
            type="text"
            placeholder="Search agent or subject..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
            className="px-3 py-2 bg-[#0D0D1A] border border-[#7B2D8B]/30 rounded-lg text-white text-sm focus:outline-none focus:border-[#E91E8C]"
          />

          {/* Agent filter */}
          <select
            value={selectedAgent}
            onChange={e => { setSelectedAgent(e.target.value); setPage(0); }}
            className="px-3 py-2 bg-[#0D0D1A] border border-[#7B2D8B]/30 rounded-lg text-white text-sm focus:outline-none focus:border-[#E91E8C]"
          >
            <option value="all">All Agents</option>
            {agents.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          {/* Category filter */}
          <select
            value={selectedCategory}
            onChange={e => { setSelectedCategory(e.target.value); setPage(0); }}
            className="px-3 py-2 bg-[#0D0D1A] border border-[#7B2D8B]/30 rounded-lg text-white text-sm focus:outline-none focus:border-[#E91E8C]"
          >
            <option value="all">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Tickets', value: stats.total, color: '#fff' },
          { label: 'Closed', value: stats.closed, color: '#00C882' },
          { label: 'Has Recall', value: stats.recalls, color: '#FF6B6B' },
        ].map(stat => (
          <div key={stat.label} className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4">
            <div className="text-2xl font-black" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-xs text-slate-400 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading tickets...</div>
        ) : filteredTickets.length === 0 ? (
          <div className="text-center py-12 text-slate-400">😔 No tickets found.</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#2D1B4E]/30">
                  <tr>
                    <th
                      className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-[#E91E8C]"
                      onClick={() => handleSort('date')}
                    >
                      Created At <SortIcon field="date" sortField={sortField} sortOrder={sortOrder} />
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Agent</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Subject</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Category</th>
                    <th
                      className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-[#E91E8C]"
                      onClick={() => handleSort('frt')}
                    >
                      FRT <SortIcon field="frt" sortField={sortField} sortOrder={sortOrder} />
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Closed</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Recall</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {pageTickets.map((ticket, i) => (
                    <tr
                      key={i}
                      className="hover:bg-[#2D1B4E]/15 transition-colors cursor-pointer"
                      onClick={() => router.push(`/chat/${ticket.id}`)}
                    >
                      <td className="py-3 px-4 text-sm text-slate-300">{formatDateTime(ticket.created_at)}</td>
                      <td className="py-3 px-4 text-sm text-[#E91E8C]">{ticket.agent_name}</td>
                      <td className="py-3 px-4 text-sm text-slate-300 truncate max-w-xs">{ticket.subject || '—'}</td>
                      <td className="py-3 px-4 text-sm text-slate-400">{ticket.category}</td>
                      <td className="py-3 px-4 text-sm text-slate-300">{formatFRT(ticket.frt_seconds)}</td>
                      <td className="py-3 px-4 text-sm">{ticket.is_closed ? '✅' : '⏳'}</td>
                      <td className="py-3 px-4 text-sm">{ticket.has_recall ? '🔔' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile view */}
            <div className="block md:hidden divide-y divide-slate-700/30">
              {pageTickets.map((ticket, i) => (
                <div
                  key={i}
                  className="p-4 space-y-2 cursor-pointer hover:bg-[#2D1B4E]/15 transition-colors"
                  onClick={() => router.push(`/chat/${ticket.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-[#E91E8C]">{ticket.agent_name}</span>
                    <span className="text-sm">{ticket.is_closed ? '✅' : '⏳'} {ticket.has_recall ? '🔔' : ''}</span>
                  </div>
                  <div className="text-xs text-slate-400">{formatDateTime(ticket.created_at)}</div>
                  <div className="text-sm text-slate-300">{ticket.subject || '—'}</div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>{ticket.category}</span>
                    <span>FRT: {formatFRT(ticket.frt_seconds)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-[#7B2D8B]/20">
                <span className="text-xs text-slate-400">
                  Page {page + 1} of {totalPages} · {filteredTickets.length} tickets
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage(p => p - 1)}
                    className="px-3 py-1 rounded bg-slate-700 text-slate-300 text-sm disabled:opacity-40 hover:bg-slate-600"
                  >
                    ‹ Prev
                  </button>
                  <button
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1 rounded bg-slate-700 text-slate-300 text-sm disabled:opacity-40 hover:bg-slate-600"
                  >
                    Next ›
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
