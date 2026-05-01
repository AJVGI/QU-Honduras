'use client';
import { useMemo, useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface Ticket {
  id: string;
  welly_conversation_id: string | null;
  agent_name: string;
  subject: string;
  category: string;
  frt_seconds: number | null;
  is_closed: boolean;
  has_recall: boolean;
  auto_fail: boolean;
  auto_fail_reason: string | null;
  grade: string | null;
  score: number | null;
  created_at: string;
  week_start: string;
}

function AutoFailsInner() {
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter') || 'autofail';

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        setLoading(true);
        const weeksRes = await fetch('/api/data/weeks');
        const weeksData = await weeksRes.json();
        const weeks = weeksData.weeks || [];
        if (weeks.length > 0) {
          const weekStart = weeks[0].week_start;
          const res = await fetch(`/api/data/tickets?week_start=${weekStart}&limit=2000`);
          const data = await res.json();
          setAllTickets(data.tickets || []);
        }
      } catch (err) {
        console.error('Error fetching tickets:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTickets();
  }, []);

  const FILTERS = [
    { key: 'autofail', label: '🚨 Auto-Fails', color: '#FF4444' },
    { key: 'recall',   label: '⚠️ Recalls',    color: '#f97316' },
    { key: 'slowfrt',  label: '⏱️ Slow FRT',   color: '#FFD600' },
    { key: 'all',      label: '📋 All Flags',   color: '#7B2D8B' },
  ];

  const flaggedTickets = useMemo(() => {
    return allTickets
      .filter(t => {
        if (filterParam === 'autofail') return t.auto_fail;
        if (filterParam === 'recall')   return t.has_recall;
        if (filterParam === 'slowfrt')  return (t.frt_seconds ?? 0) > 300;
        // 'all'
        return t.auto_fail || t.has_recall || (t.frt_seconds ?? 0) > 300;
      })
      .map(t => {
        const tags: string[] = [];
        if (t.auto_fail)                        tags.push('Auto-Fail');
        if (t.has_recall)                        tags.push('Recall');
        if ((t.frt_seconds ?? 0) > 300)          tags.push('Slow FRT');
        return { ...t, tags };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [allTickets, filterParam]);

  // Group by agent
  const grouped = useMemo(() => {
    const byAgent = new Map<string, typeof flaggedTickets>();
    flaggedTickets.forEach(t => {
      const cur = byAgent.get(t.agent_name) || [];
      cur.push(t);
      byAgent.set(t.agent_name, cur);
    });
    return Array.from(byAgent.entries())
      .map(([agent_name, tickets]) => ({ agent_name, count: tickets.length, tickets }))
      .sort((a, b) => b.count - a.count);
  }, [flaggedTickets]);

  const fmt = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const fmtFRT = (s: number | null) => {
    if (s === null) return 'N/A';
    if (s < 60) return `${Math.round(s)}s`;
    return `${Math.floor(s/60)}m ${s%60}s`;
  };

  const TAG_STYLE: Record<string,{bg:string;color:string}> = {
    'Auto-Fail': { bg:'rgba(255,68,68,0.15)',   color:'#FF4444' },
    'Recall':    { bg:'rgba(249,115,22,0.15)',   color:'#f97316' },
    'Slow FRT':  { bg:'rgba(255,214,0,0.15)',    color:'#e6c200' },
  };

  const GRADE_COLOR: Record<string,string> = {
    A:'#00C882', B:'#E91E8C', C:'#FFD600', D:'#f97316', F:'#FF4444',
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div>
        <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 900, margin: 0 }}>🚨 Auto-Flags</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Auto-fail violations, recalls, and slow FRT · Click any row to view transcript
        </p>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <Link key={f.key} href={`/reports/autofails?filter=${f.key}`}
            style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              textDecoration: 'none', transition: 'all 0.15s',
              background: filterParam === f.key ? `${f.color}22` : 'var(--surface-card)',
              border: `1px solid ${filterParam === f.key ? f.color : 'var(--border-default)'}`,
              color: filterParam === f.key ? f.color : 'var(--text-muted)',
            }}>
            {f.label} {filterParam === f.key && <span style={{ marginLeft: 6, fontWeight: 900 }}>{flaggedTickets.length}</span>}
          </Link>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Loading…</div>
      ) : grouped.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>No flagged tickets</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>Nothing to show for this filter.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {grouped.map(({ agent_name, count, tickets }) => (
            <div key={agent_name} className="jd-card" style={{ borderColor: 'rgba(255,68,68,0.25)', overflow: 'hidden' }}>
              {/* Agent header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: 'rgba(255,68,68,0.06)', borderBottom: '1px solid rgba(255,68,68,0.15)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,68,68,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF4444', fontWeight: 900, fontSize: 13 }}>{count}</div>
                  <Link href={`/all-chats?agent=${encodeURIComponent(agent_name)}`}
                    style={{ color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#E91E8C')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#fff')}>
                    {agent_name}
                  </Link>
                </div>
                <span style={{ color: '#FF4444', fontSize: 12, fontWeight: 600 }}>{count} flagged ticket{count !== 1 ? 's' : ''}</span>
              </div>

              {/* Ticket rows */}
              <div>
                {tickets.map((ticket, i) => (
                  <div key={i}
                    style={{ padding: '12px 18px', borderTop: i > 0 ? '1px solid var(--border-default)' : 'none', transition: 'background 0.12s', cursor: ticket.welly_conversation_id ? 'pointer' : 'default' }}
                    onMouseEnter={e => { if (ticket.welly_conversation_id) e.currentTarget.style.background = 'rgba(233,30,140,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    onClick={() => ticket.welly_conversation_id && window.open(`/chat/${ticket.welly_conversation_id}`, '_blank')}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Tags */}
                        <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                          {ticket.tags.map(tag => (
                            <span key={tag} style={{ ...TAG_STYLE[tag], padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{tag}</span>
                          ))}
                          {ticket.grade && (
                            <span style={{ background: `${GRADE_COLOR[ticket.grade]}18`, color: GRADE_COLOR[ticket.grade], padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                              Grade {ticket.grade} · {ticket.score ?? '—'}
                            </span>
                          )}
                        </div>
                        {/* Subject */}
                        <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ticket.subject || '(no subject)'}
                        </div>
                        {/* Auto-fail reason */}
                        {ticket.auto_fail_reason && (
                          <div style={{ color: '#FF4444', fontSize: 12, marginBottom: 4, background: 'rgba(255,68,68,0.08)', padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(255,68,68,0.20)' }}>
                            ⚡ {ticket.auto_fail_reason}
                          </div>
                        )}
                        {/* Meta */}
                        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                          <span>{fmt(ticket.created_at)}</span>
                          <span>{ticket.category}</span>
                          <span>FRT: {fmtFRT(ticket.frt_seconds)}</span>
                          <span>{ticket.is_closed ? '✅ Closed' : '⏳ Open'}</span>
                        </div>
                      </div>
                      {/* Transcript link */}
                      {ticket.welly_conversation_id && (
                        <div style={{ flexShrink: 0, color: '#E91E8C', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                          View Chat →
                        </div>
                      )}
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

export default function AutoFailsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>}>
      <AutoFailsInner />
    </Suspense>
  );
}
