'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ALL_CHATS } from '@/lib/dataLoader';

interface NewChat {
  chat_id: string;
  agent_name: string;
  total_score: number;
  grade: string;
  scored_at: string;
  auto_fail: { triggered: boolean; reason: string | null };
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'text-emerald-400';
    case 'B': return 'text-green-400';
    case 'C': return 'text-yellow-400';
    case 'D': return 'text-orange-400';
    default:  return 'text-red-400';
  }
}

const ET_OFFSET_MS = -4 * 60 * 60 * 1000; // UTC-4 (EDT)

function toET(isoDate: string): string {
  const d = new Date(new Date(isoDate).getTime() + ET_OFFSET_MS);
  const h = d.getUTCHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const mo = d.getUTCMonth() + 1;
  const dy = d.getUTCDate();
  return `${mo}/${dy} ${h12}:${mm} ${ampm} ET`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  // Load dismissed IDs from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('qa_dismissed_notifs');
      if (saved) setDismissed(new Set(JSON.parse(saved)));
    } catch(e) {}
  }, []);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Get chats scored in last 24h, sorted newest first
  const recent: NewChat[] = ALL_CHATS
    .filter(c => c.scored_at && (Date.now() - new Date(c.scored_at).getTime()) < 24 * 60 * 60 * 1000)
    .sort((a, b) => new Date(b.scored_at!).getTime() - new Date(a.scored_at!).getTime())
    .slice(0, 50) as NewChat[];

  const unread = recent.filter(c => !dismissed.has(c.chat_id));

  function dismissAll() {
    const ids = recent.map(c => c.chat_id);
    const next = new Set([...dismissed, ...ids]);
    setDismissed(next);
    try { localStorage.setItem('qa_dismissed_notifs', JSON.stringify([...next])); } catch(e) {}
  }

  function dismissOne(id: string) {
    const next = new Set([...dismissed, id]);
    setDismissed(next);
    try { localStorage.setItem('qa_dismissed_notifs', JSON.stringify([...next])); } catch(e) {}
  }

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-lg hover:bg-slate-700 transition-colors"
        title="New chat notifications"
      >
        <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <div>
              <span className="text-sm font-semibold text-white">New Chats (Last 24h)</span>
              <span className="ml-2 text-xs text-slate-400">{recent.length} total</span>
            </div>
            {unread.length > 0 && (
              <button
                onClick={dismissAll}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {recent.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-400 text-sm">
                No new chats in the last 24h
              </div>
            ) : (
              recent.map(chat => {
                const isUnread = !dismissed.has(chat.chat_id);
                return (
                  <div
                    key={chat.chat_id}
                    className={`px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700/40 transition-colors flex items-start gap-3 ${isUnread ? 'bg-slate-700/20' : ''}`}
                  >
                    {/* Unread dot */}
                    <div className="mt-1.5 flex-shrink-0">
                      {isUnread
                        ? <div className="w-2 h-2 rounded-full bg-blue-400" />
                        : <div className="w-2 h-2 rounded-full bg-transparent" />
                      }
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/chat/${chat.chat_id}`}
                          onClick={() => { dismissOne(chat.chat_id); setOpen(false); }}
                          className="text-sm font-medium text-white hover:text-blue-400 truncate"
                        >
                          {chat.agent_name}
                        </Link>
                        <span className={`text-sm font-bold flex-shrink-0 ${gradeColor(chat.grade)}`}>
                          {chat.total_score}/100 {chat.grade}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-xs text-slate-400">{toET(chat.scored_at)}</span>
                        <span className="text-xs text-slate-500">{timeAgo(chat.scored_at)}</span>
                      </div>
                      {chat.auto_fail?.triggered && (
                        <span className="inline-flex items-center gap-1 mt-1 text-xs text-red-400 font-medium">
                          🚨 AUTO-FAIL
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {recent.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-700 text-center">
              <Link
                href="/reports/daily"
                onClick={() => setOpen(false)}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                View full daily report →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
