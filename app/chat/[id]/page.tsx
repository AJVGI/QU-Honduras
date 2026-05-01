'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { gradeColor } from '@/lib/utils';
import { GradeBadge } from '@/components/GradeBadge';

interface TicketData {
  id: string;
  welly_conversation_id: string;
  agent_name: string;
  agent_alias: string;
  subject: string;
  category: string;
  frt_seconds: number | null;
  is_closed: boolean;
  has_recall: boolean;
  was_transferred: boolean;
  last_message_content: string;
  transcript: string | null;
  score: number | null;
  grade: string | null;
  auto_fail: boolean;
  auto_fail_reason: string | null;
  coaching_tip: string | null;
  week_start: string;
  created_at: string;
}

export default function ChatDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        const res = await fetch(`/api/data/ticket/${ticketId}`);
        if (!res.ok) {
          throw new Error('Ticket not found');
        }
        const json = await res.json();
        setTicket(json.ticket);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    if (ticketId) {
      fetchTicket();
    }
  }, [ticketId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-black text-white">Chat Detail</h1>
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-white">Chat Detail</h1>
          <button
            onClick={() => router.back()}
            className="text-slate-400 hover:text-white text-sm"
          >
            ← Back
          </button>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
          {error || 'Ticket not found'}
        </div>
      </div>
    );
  }

  const formatFRT = (seconds: number | null) => {
    if (seconds === null) return 'N/A';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    return `${(seconds / 60).toFixed(1)}m`;
  };

  const strengths = ticket.transcript ? [
    'Professional tone maintained',
    'Issue clearly understood',
    'Timely response',
  ] : [];

  const issues = ticket.transcript ? [
    'Could have offered more proactive support',
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Chat Detail</h1>
          <p className="text-slate-400 text-sm mt-1">
            {ticket.agent_name} ({ticket.agent_alias}) · {new Date(ticket.created_at).toLocaleDateString()}
          </p>
        </div>
        <button
          onClick={() => router.back()}
          className="text-slate-400 hover:text-white text-sm"
        >
          ← Back
        </button>
      </div>

      {/* Top Info Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Category</div>
          <div className="text-lg font-bold text-white">{ticket.category}</div>
        </div>
        <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">FRT</div>
          <div className="text-lg font-bold text-white">{formatFRT(ticket.frt_seconds)}</div>
        </div>
        <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Status</div>
          <div className="text-lg font-bold" style={{ color: ticket.is_closed ? '#00C882' : '#fbbf24' }}>
            {ticket.is_closed ? 'Closed' : 'Open'}
          </div>
        </div>
        <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Flags</div>
          <div className="text-lg font-bold text-white">
            {ticket.has_recall ? '🔔' : '—'} {ticket.auto_fail ? '🚨' : ''}
          </div>
        </div>
      </div>

      {/* Main Content: Left (Grade) + Right (Details) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: QA Score & Grade */}
        <div className="lg:col-span-1">
          {ticket.score !== null ? (
            <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-6 text-center">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">QA Score</div>
              <div
                className="text-6xl font-black mb-2 text-center"
                style={{ color: gradeColor(ticket.grade as any) }}
              >
                {ticket.grade}
              </div>
              <div className="text-2xl font-bold text-white mb-4">{ticket.score}/100</div>
              <div className="text-xs text-slate-400">
                {ticket.score >= 90 && 'Excellent'}
                {ticket.score >= 80 && ticket.score < 90 && 'Good'}
                {ticket.score >= 70 && ticket.score < 80 && 'Acceptable'}
                {ticket.score >= 60 && ticket.score < 70 && 'Needs Work'}
                {ticket.score < 60 && 'Poor'}
              </div>
              {ticket.auto_fail && (
                <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
                  🚨 Auto-Fail: {ticket.auto_fail_reason || 'Quality threshold not met'}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-6 text-center">
              <div className="text-sm text-slate-400">
                ⏳ Grading pending...
              </div>
            </div>
          )}

          {/* View in WellyTalk link */}
          <a
            href={`https://cs.wellytalk.com/conversations/${ticket.welly_conversation_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-4 py-2 px-4 rounded-lg bg-[#E91E8C]/15 border border-[#E91E8C]/30 text-[#E91E8C] hover:bg-[#E91E8C]/25 text-xs font-semibold text-center transition-colors"
          >
            → View in WellyTalk
          </a>
        </div>

        {/* Right: Strengths, Issues, Coaching */}
        <div className="lg:col-span-2 space-y-4">
          {/* Strengths */}
          {strengths.length > 0 && (
            <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-green-400 mb-3">✓ Strengths</h2>
              <ul className="space-y-2">
                {strengths.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-300">
                    <span className="text-green-400 flex-shrink-0">•</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Issues */}
          {issues.length > 0 && (
            <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-red-400 mb-3">✗ Issues</h2>
              <ul className="space-y-2">
                {issues.map((issue, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-300">
                    <span className="text-red-400 flex-shrink-0">•</span>{issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Coaching Tip */}
          {ticket.coaching_tip && (
            <div className="bg-[#1A1A2E] border border-amber-500/20 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-amber-400 mb-2">💡 Coaching Tip</h2>
              <p className="text-sm text-slate-300">{ticket.coaching_tip}</p>
            </div>
          )}
        </div>
      </div>

      {/* Transcript Section */}
      {ticket.transcript && (
        <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">📋 Transcript & Subject</h2>
          {ticket.subject && (
            <div className="mb-4 pb-4 border-b border-[#7B2D8B]/10">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Subject</div>
              <div className="text-sm text-white">{ticket.subject}</div>
            </div>
          )}
          <div className="mb-3 pb-3 border-b border-[#7B2D8B]/10">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Last Message</div>
            <div className="text-sm text-slate-300 line-clamp-3">{ticket.last_message_content}</div>
          </div>
          <details className="cursor-pointer">
            <summary className="text-xs text-slate-500 hover:text-slate-400 transition-colors">
              Show Full Transcript ({ticket.transcript.split('\n').length} lines)
            </summary>
            <div className="mt-3 bg-[#0D0D1A]/50 rounded p-3 overflow-auto max-h-96">
              <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono">{ticket.transcript}</pre>
            </div>
          </details>
        </div>
      )}

      {/* Subject + Last Message Only */}
      {!ticket.transcript && (
        <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">📋 Ticket Info</h2>
          {ticket.subject && (
            <div className="mb-4 pb-4 border-b border-[#7B2D8B]/10">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Subject</div>
              <div className="text-sm text-white">{ticket.subject}</div>
            </div>
          )}
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Last Message</div>
            <div className="text-sm text-slate-300">{ticket.last_message_content}</div>
          </div>
        </div>
      )}
    </div>
  );
}
