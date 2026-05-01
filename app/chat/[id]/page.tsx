'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { gradeColor } from '@/lib/utils';

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

interface TranscriptMessage {
  messageId: string;
  sender: 'client' | 'agent' | 'bot';
  text: string;
  recalled: boolean;
  createdAt: number;
  contentType: string;
}

interface TranscriptResponse {
  ok: boolean;
  conversationId: string;
  messages: TranscriptMessage[];
  total: number;
}

function gradeColorStyle(grade: string | null): string {
  if (!grade) return '#94a3b8';
  switch (grade.toUpperCase()) {
    case 'A': return '#10b981';
    case 'B': return '#14b8a6';
    case 'C': return '#eab308';
    case 'D': return '#f97316';
    case 'F': return '#ef4444';
    default: return '#94a3b8';
  }
}

function formatTime(ms: number): string {
  const date = new Date(ms);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatFRT(seconds: number | null) {
  if (seconds === null) return 'N/A';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${(seconds / 60).toFixed(1)}m`;
}

export default function ChatDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [transcriptLoading, setTranscriptLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch ticket metadata
  useEffect(() => {
    const fetchTicket = async () => {
      try {
        const res = await fetch(`/api/data/ticket/${ticketId}`);
        if (!res.ok) throw new Error('Ticket not found');
        const json = await res.json();
        setTicket(json.ticket);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    if (ticketId) fetchTicket();
  }, [ticketId]);

  // Fetch live transcript from WellyTalk
  useEffect(() => {
    const fetchTranscript = async () => {
      if (!ticket?.welly_conversation_id) return;
      setTranscriptLoading(true);
      try {
        const res = await fetch(`/api/data/transcript/${ticket.welly_conversation_id}`);
        const json: TranscriptResponse = await res.json();
        if (json.ok) {
          setMessages(json.messages);
        }
      } catch (e) {
        console.error('Failed to fetch transcript:', e);
      } finally {
        setTranscriptLoading(false);
      }
    };
    if (ticket) fetchTranscript();
  }, [ticket]);

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
          <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm">
            ← Back
          </button>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
          {error || 'Ticket not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.back()}
            className="text-[#E91E8C] hover:text-[#E91E8C]/80 text-sm font-semibold mb-2"
          >
            ← Back to Chat History
          </button>
          <h1 className="text-2xl font-black text-white">Chat Detail</h1>
          <p className="text-slate-400 text-sm mt-1">
            Agent: {ticket.agent_name} ({ticket.agent_alias}) | {ticket.category} | FRT {formatFRT(ticket.frt_seconds)} | {ticket.is_closed ? '✓ Closed' : '○ Open'}
          </p>
        </div>
      </div>

      {/* Main: Two-column layout (35% left, 65% right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: QA Score Card (35%) */}
        <div className="lg:col-span-1">
          {ticket.score !== null ? (
            <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-6">
              {/* Grade Circle */}
              <div className="text-center mb-6">
                <div
                  className="text-7xl font-black mb-2"
                  style={{ color: gradeColorStyle(ticket.grade) }}
                >
                  {ticket.grade}
                </div>
                <div className="text-lg font-bold text-white">{ticket.score}/100</div>
                <div className="text-xs text-slate-400 mt-1">
                  {ticket.score >= 90 && 'Excellent'}
                  {ticket.score >= 80 && ticket.score < 90 && 'Good'}
                  {ticket.score >= 70 && ticket.score < 80 && 'Acceptable'}
                  {ticket.score >= 60 && ticket.score < 70 && 'Needs Work'}
                  {ticket.score < 60 && 'Poor'}
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-[#7B2D8B]/20 mb-4" />

              {/* Auto-Fail Badge */}
              {ticket.auto_fail && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
                  🚨 <strong>Auto-Fail</strong>
                  <br />
                  {ticket.auto_fail_reason || 'Quality threshold not met'}
                </div>
              )}

              {/* View in WellyTalk */}
              <a
                href={`https://cs.wellytalk.com/conversations/${ticket.welly_conversation_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-2 px-3 rounded-lg bg-[#E91E8C]/15 border border-[#E91E8C]/30 text-[#E91E8C] hover:bg-[#E91E8C]/25 text-xs font-semibold text-center transition-colors"
              >
                → View in WellyTalk
              </a>
            </div>
          ) : (
            <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-6 text-center">
              <div className="text-sm text-slate-400">⏳ Grading pending...</div>
            </div>
          )}

          {/* Coaching Tip */}
          {ticket.coaching_tip && (
            <div className="mt-4 bg-[#1A1A2E] border border-amber-500/20 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-amber-400 mb-2">💡 Coaching Tip</h3>
              <p className="text-xs text-slate-300">{ticket.coaching_tip}</p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Transcript (65%) */}
        <div className="lg:col-span-2">
          <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl overflow-hidden flex flex-col" style={{ minHeight: '500px' }}>
            {/* Header */}
            <div className="p-4 border-b border-[#7B2D8B]/20 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-300">Conversation</h2>
                <p className="text-xs text-slate-500 mt-1">{messages.length} messages</p>
              </div>
              {transcriptLoading && (
                <div className="text-xs text-slate-500">Loading transcript...</div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {transcriptLoading ? (
                <div className="flex items-center justify-center h-32 text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-5 h-5 border-2 border-[#E91E8C]/30 border-t-[#E91E8C] rounded-full animate-spin" />
                    <span className="text-xs">Loading...</span>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
                  No messages available
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div key={idx} className={`flex gap-3 ${msg.sender === 'agent' ? 'flex-row-reverse' : ''}`}>
                    {/* Sender Avatar */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#7B2D8B]/20 flex items-center justify-center text-xs font-semibold">
                      {msg.sender === 'agent' && '👤'}
                      {msg.sender === 'client' && '🙋'}
                      {msg.sender === 'bot' && '🤖'}
                    </div>

                    {/* Message Bubble */}
                    <div
                      className={`flex-1 max-w-[70%] rounded-lg p-3 ${
                        msg.sender === 'agent'
                          ? 'bg-[#7B2D8B]/30 text-slate-100 text-right glow-agent-msg'
                          : msg.sender === 'bot'
                          ? 'bg-slate-800/50 text-slate-400 text-center text-xs max-w-full'
                          : 'bg-slate-800/50 text-slate-100'
                      } ${msg.recalled ? 'opacity-60 line-through' : ''}`}
                    >
                      <p className="text-sm leading-relaxed">{msg.text}</p>
                      {msg.recalled && (
                        <p className="text-xs text-slate-500 mt-1">[RECALLED]</p>
                      )}
                      <p className="text-xs text-slate-500 mt-2 opacity-70">{formatTime(msg.createdAt)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Category</div>
          <div className="text-sm font-bold text-white">{ticket.category}</div>
        </div>
        <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Status</div>
          <div className="text-sm font-bold" style={{ color: ticket.is_closed ? '#00C882' : '#fbbf24' }}>
            {ticket.is_closed ? 'Closed' : 'Open'}
          </div>
        </div>
        <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Flags</div>
          <div className="text-sm font-bold text-white">
            {ticket.has_recall && '🔔'} {ticket.auto_fail && '🚨'} {!ticket.has_recall && !ticket.auto_fail && '—'}
          </div>
        </div>
        <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Created</div>
          <div className="text-sm font-bold text-white">{new Date(ticket.created_at).toLocaleDateString()}</div>
        </div>
      </div>
    </div>
  );
}
