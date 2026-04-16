'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ALL_CHATS, AGENTS, getChatResponseMetrics } from '@/lib/dataLoader';
import { GradeBadge } from '@/components/GradeBadge';
import { gradeColor } from '@/lib/utils';
import { Grade } from '@/lib/types';

const GRADES: Grade[] = ['A', 'B', 'C', 'D', 'F'];
const PER_PAGE = 50;

export default function AllChatsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [gradeFilter, setGradeFilter] = useState<'all' | Grade>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [silentOnly, setSilentOnly] = useState(false);
  const [sortField, setSortField] = useState<'date' | 'score' | 'responseRate'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  // Pre-compute metrics for all chats
  const chatsWithMetrics = useMemo(() => {
    return ALL_CHATS.map(chat => ({
      ...chat,
      metrics: getChatResponseMetrics(chat),
    }));
  }, []);

  // Filter and sort
  const filteredChats = useMemo(() => {
    let result = chatsWithMetrics;

    // Search by agent name
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c => c.agent_name.toLowerCase().includes(term));
    }

    // Agent filter
    if (selectedAgent !== 'all') {
      result = result.filter(c => c.agent_id === selectedAgent);
    }

    // Grade filter
    if (gradeFilter !== 'all') {
      result = result.filter(c => c.grade === gradeFilter);
    }

    // Date range
    if (dateFrom) {
      result = result.filter(c => c.timestamp >= dateFrom);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter(c => new Date(c.timestamp) <= toDate);
    }

    // Silent only
    if (silentOnly) {
      result = result.filter(c => c.metrics.customerUnresponded > 0);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      if (sortField === 'date') {
        aVal = new Date(a.timestamp).getTime();
        bVal = new Date(b.timestamp).getTime();
      } else if (sortField === 'score') {
        aVal = a.total_score;
        bVal = b.total_score;
      } else if (sortField === 'responseRate') {
        aVal = a.metrics.responseRate;
        bVal = b.metrics.responseRate;
      }

      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    return result;
  }, [chatsWithMetrics, searchTerm, selectedAgent, gradeFilter, dateFrom, dateTo, silentOnly, sortField, sortOrder]);

  // Stats
  const stats = useMemo(() => {
    const total = filteredChats.length;
    const avgResponseRate = total > 0
      ? filteredChats.reduce((sum, c) => sum + c.metrics.responseRate, 0) / total
      : 0;
    const silentChats = filteredChats.filter(c => c.metrics.customerUnresponded > 0).length;
    const autoFails = filteredChats.filter(c => c.auto_fail.triggered).length;
    return { total, avgResponseRate, silentChats, autoFails };
  }, [filteredChats]);

  // Pagination
  const totalPages = Math.ceil(filteredChats.length / PER_PAGE);
  const pageChats = filteredChats.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  // Sorting handlers
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setPage(0);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Date',
      'Agent',
      'Grade',
      'Score',
      'Msgs Sent',
      'Agent Replied',
      'Response Rate %',
      'Silent',
      'Auto-Fail',
      'Chat ID',
    ];
    const rows = filteredChats.map(c => [
      new Date(c.timestamp).toLocaleString(),
      c.agent_name,
      c.grade,
      c.total_score,
      c.metrics.totalMessages,
      c.metrics.agentMessages,
      c.metrics.responseRate.toFixed(1),
      c.metrics.customerUnresponded > 0 ? 'Yes' : 'No',
      c.auto_fail.triggered ? 'Yes' : 'No',
      c.chat_id,
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jackpot-chats-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDateTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <span className="text-slate-600">↕</span>;
    return <span className="text-[#E91E8C]">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="space-y-6 max-w-[1600px]">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-white">💬 All Chats</h1>
        <Link href="/" className="text-slate-400 hover:text-white text-sm">← Back</Link>
      </div>

      {/* Controls */}
      <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <input
            type="text"
            placeholder="Search agent name..."
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
            {AGENTS.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          {/* Date from */}
          <input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(0); }}
            className="px-3 py-2 bg-[#0D0D1A] border border-[#7B2D8B]/30 rounded-lg text-white text-sm focus:outline-none focus:border-[#E91E8C]"
          />

          {/* Date to */}
          <input
            type="date"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(0); }}
            className="px-3 py-2 bg-[#0D0D1A] border border-[#7B2D8B]/30 rounded-lg text-white text-sm focus:outline-none focus:border-[#E91E8C]"
          />
        </div>

        {/* Grade filters + Silent toggle */}
        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={() => { setGradeFilter('all'); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              gradeFilter === 'all' ? 'bg-[#E91E8C] text-white' : 'bg-[#0D0D1A] text-slate-400 hover:text-white border border-[#7B2D8B]/20'
            }`}
          >
            All Grades
          </button>
          {GRADES.map(g => (
            <button
              key={g}
              onClick={() => { setGradeFilter(g); setPage(0); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                gradeFilter === g ? 'bg-[#E91E8C] text-white' : 'bg-[#0D0D1A] text-slate-400 hover:text-white border border-[#7B2D8B]/20'
              }`}
            >
              Grade {g}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => { setSilentOnly(!silentOnly); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              silentOnly ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-[#0D0D1A] text-slate-400 hover:text-white border border-[#7B2D8B]/20'
            }`}
          >
            🔴 Silent Only
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            ⬇️ Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Chats', value: stats.total, color: '#fff' },
          { label: 'Avg Response Rate', value: `${stats.avgResponseRate.toFixed(1)}%`, color: '#00C882' },
          { label: 'Silent Chats', value: stats.silentChats, color: '#FF4444' },
          { label: 'Auto-Fails', value: stats.autoFails, color: '#f97316' },
        ].map(stat => (
          <div key={stat.label} className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4">
            <div className="text-2xl font-black" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-xs text-slate-400 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#2D1B4E]/30">
              <tr>
                <th
                  className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-[#E91E8C]"
                  onClick={() => handleSort('date')}
                >
                  Date <SortIcon field="date" />
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Agent</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Grade</th>
                <th
                  className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-[#E91E8C]"
                  onClick={() => handleSort('score')}
                >
                  Score <SortIcon field="score" />
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Msgs Sent</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Agent Replied</th>
                <th
                  className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-[#E91E8C]"
                  onClick={() => handleSort('responseRate')}
                >
                  Response Rate <SortIcon field="responseRate" />
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Silent?</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Auto-Fail</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {pageChats.map((chat, i) => {
                const responseRateColor = chat.metrics.responseRate >= 80 ? 'text-green-400' : chat.metrics.responseRate >= 50 ? 'text-amber-400' : 'text-red-400';
                return (
                  <tr key={i} className="hover:bg-[#2D1B4E]/15 transition-colors">
                    <td className="py-3 px-4 text-sm text-slate-300">{formatDateTime(chat.timestamp)}</td>
                    <td className="py-3 px-4 text-sm">
                      <Link href={`/agent/${chat.agent_id}`} className="text-[#E91E8C] hover:text-blue-300">
                        {chat.agent_name}
                      </Link>
                    </td>
                    <td className="py-3 px-4"><GradeBadge grade={chat.grade} /></td>
                    <td className="py-3 px-4 font-mono font-bold text-sm" style={{ color: gradeColor(chat.grade) }}>
                      {chat.total_score}/100
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-300">{chat.metrics.totalMessages}</td>
                    <td className="py-3 px-4 text-sm text-slate-300">{chat.metrics.agentMessages}</td>
                    <td className={`py-3 px-4 text-sm font-medium ${responseRateColor}`}>
                      {chat.metrics.responseRate.toFixed(0)}%
                    </td>
                    <td className="py-3 px-4 text-lg">
                      {chat.metrics.customerUnresponded > 0 ? '🔴' : '✅'}
                    </td>
                    <td className="py-3 px-4 text-lg">
                      {chat.auto_fail.triggered ? '🚨' : ''}
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/chat/${chat.chat_id}`}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="block md:hidden divide-y divide-slate-700/30">
          {pageChats.map((chat, i) => {
            const responseRateColor = chat.metrics.responseRate >= 80 ? 'text-green-400' : chat.metrics.responseRate >= 50 ? 'text-amber-400' : 'text-red-400';
            return (
              <div key={i} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GradeBadge grade={chat.grade} />
                    <span className="font-mono font-bold text-sm" style={{ color: gradeColor(chat.grade) }}>
                      {chat.total_score}
                    </span>
                    {chat.metrics.customerUnresponded > 0 && <span>🔴</span>}
                    {chat.auto_fail.triggered && <span>🚨</span>}
                  </div>
                  <Link
                    href={`/chat/${chat.chat_id}`}
                    className="px-2 py-1 bg-blue-600 text-white text-xs rounded"
                  >
                    View →
                  </Link>
                </div>
                <div className="text-xs text-slate-400">{formatDateTime(chat.timestamp)}</div>
                <Link href={`/agent/${chat.agent_id}`} className="text-sm text-[#E91E8C] hover:text-blue-300">
                  {chat.agent_name}
                </Link>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>Msgs: {chat.metrics.totalMessages}</span>
                  <span className={responseRateColor}>Rate: {chat.metrics.responseRate.toFixed(0)}%</span>
                </div>
              </div>
            );
          })}
        </div>

        {filteredChats.length === 0 && (
          <div className="text-center py-12 text-slate-400">😔 No chats match your filters.</div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#7B2D8B]/20">
            <span className="text-xs text-slate-400">
              Page {page + 1} of {totalPages} · {filteredChats.length} chats
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
      </div>
    </div>
  );
}
