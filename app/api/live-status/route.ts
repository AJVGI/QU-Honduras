/**
 * Live Agent Status API
 *
 * Fast path: fetch only the most recent 200 closed chats + all OPEN chats.
 * This gives us current active agents in <3 seconds.
 * Zero AI cost — pure WellyTalk API calls.
 *
 * GET /api/live-status
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // Vercel Pro allows up to 60s; hobby = 10s

import { NextResponse } from 'next/server';

const API_BASE = 'https://api.stacktech.org';
const AUTH_BASE = 'https://auth.stacktech.org';
const COMPANY_ID = '3046';

interface TokenCache { ac_token: string; rf_token: string; exp: number }
let tokenCache: TokenCache | null = null;

async function wt(url: string, opts: { method?: string; headers?: Record<string,string>; body?: unknown } = {}) {
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: { 'content-type': 'application/json', 'origin': 'https://cs.wellytalk.com', ...opts.headers },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

async function login(): Promise<TokenCache> {
  const d = await wt(`${AUTH_BASE}/backend/auth/v1/user/sign-in`, {
    method: 'POST',
    body: { account: process.env.WELLYTALK_USER || 'xtractadmin01', password: process.env.WELLYTALK_PASS || 'Wellytalk2026!' },
  }) as { code: number; data: { ac_token: string; rf_token: string; exp_time: number } };
  if (d.code !== 0) throw new Error(`Login failed: code ${d.code}`);
  return { ac_token: d.data.ac_token, rf_token: d.data.rf_token, exp: Date.now() + 3300 * 1000 };
}

async function refreshToken(rf: string): Promise<TokenCache> {
  const d = await wt(`${AUTH_BASE}/backend/auth/v1/user/refresh-token`, {
    method: 'POST', body: { rf_token: rf },
  }) as { code: number; data: { ac_token: string; rf_token: string } };
  if (d.code !== 0) throw new Error(`Refresh failed: code ${d.code}`);
  return { ac_token: d.data.ac_token, rf_token: d.data.rf_token, exp: Date.now() + 3300 * 1000 };
}

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.exp) return tokenCache.ac_token;
  if (tokenCache?.rf_token) {
    try { tokenCache = await refreshToken(tokenCache.rf_token); return tokenCache.ac_token; } catch {}
  }
  tokenCache = await login();
  return tokenCache.ac_token;
}

interface WellyParticipant { source_type: string; source_user_id: string; name: string; nick_name: string; chat_user_id: string }
interface WellyChat { conversation_id: string; participants: WellyParticipant[]; status: string; updated_at: number; created_at: number; website_name: string }

function relTime(ms: number): string {
  const ago = Math.round((Date.now() - ms) / 60000);
  if (ago < 1) return 'just now';
  if (ago < 60) return `${ago}m ago`;
  if (ago < 1440) return `${Math.round(ago/60)}h ago`;
  return `${Math.round(ago/1440)}d ago`;
}

function statusOf(ms: number) {
  const ago = Date.now() - ms;
  if (ago < 15*60*1000) return { status: 'active' as const, label: '🟢 Active' };
  if (ago < 2*60*60*1000) return { status: 'idle' as const, label: '🟡 Idle' };
  return { status: 'offline' as const, label: '🔴 Offline' };
}

export async function GET() {
  try {
    const token = await getToken();
    const authHdrs = { 'Authorization': `Bearer ${token}`, 'x-company-id': COMPANY_ID, 'x-timezone': 'America/New_York' };

    // ET today string
    const etNow = new Date(Date.now() - 4 * 3600 * 1000);
    const todayStr = etNow.toISOString().slice(0, 10);
    const todayStartSec = Math.floor(new Date(todayStr + 'T04:00:00Z').getTime() / 1000);

    // Fetch last 300 closed chats (fast — 3 pages) + all OPEN chats in parallel
    const [page1raw, page2raw, page3raw, openRaw] = await Promise.all([
      wt(`${API_BASE}/backend/cs-agent/v1/conversation/chat-records?limit=100&is_personal=false&filter_mode=1&search_type=1&time_updated=0`, { headers: authHdrs }),
      wt(`${API_BASE}/backend/cs-agent/v1/conversation/chat-records?limit=100&is_personal=false&filter_mode=1&search_type=1&time_updated=0&from_date=${todayStartSec}`, { headers: authHdrs }),
      wt(`${API_BASE}/backend/cs-agent/v1/conversation/chat-records?limit=100&is_personal=false&filter_mode=1&search_type=1&time_updated=0&from_date=${todayStartSec - 3600}`, { headers: authHdrs }),
      wt(`${API_BASE}/backend/cs-agent/v1/conversation/chat-records?limit=100&is_personal=false&filter_mode=1&search_type=1&time_updated=0&status=OPEN`, { headers: authHdrs }),
    ]) as Array<{ code: number; data: { list: WellyChat[]; total: number } }>;

    // Combine and dedupe chats
    const seen = new Set<string>();
    const allChats: WellyChat[] = [];
    for (const raw of [page1raw, page2raw, page3raw]) {
      for (const c of (raw.code === 0 ? raw.data?.list || [] : [])) {
        if (!seen.has(c.conversation_id)) { seen.add(c.conversation_id); allChats.push(c); }
      }
    }

    const openChats: WellyChat[] = openRaw.code === 0 ? openRaw.data?.list || [] : [];
    for (const c of openChats) {
      if (!seen.has(c.conversation_id)) { seen.add(c.conversation_id); allChats.push(c); }
    }

    const totalToday = page2raw.code === 0 ? (page2raw.data?.total ?? 0) : 0;

    // Build agent map
    type AgentRow = { id: string; name: string; chatUserId: string; chatsInWindow: number; openChats: number; lastSeenMs: number; firstSeenMs: number; status: 'active'|'idle'|'offline'; statusLabel: string; lastSeenAgo: string };
    const agents: Record<string, AgentRow> = {};

    for (const chat of allChats) {
      const ap = chat.participants?.find(p => p.source_type === 'INTERNAL');
      if (!ap) continue;
      const id = ap.source_user_id;
      const name = ap.nick_name || ap.name || `Agent ${id}`;
      const updMs = chat.updated_at > 1e12 ? chat.updated_at : chat.updated_at * 1000;
      const crtMs = chat.created_at > 1e12 ? chat.created_at : chat.created_at * 1000;
      if (!agents[id]) agents[id] = { id, name, chatUserId: ap.chat_user_id, chatsInWindow: 0, openChats: 0, lastSeenMs: 0, firstSeenMs: crtMs, status: 'offline', statusLabel: '', lastSeenAgo: '' };
      agents[id].chatsInWindow++;
      if (chat.status === 'OPEN') agents[id].openChats++;
      if (updMs > agents[id].lastSeenMs) agents[id].lastSeenMs = updMs;
      if (crtMs < agents[id].firstSeenMs) agents[id].firstSeenMs = crtMs;
    }

    const rows = Object.values(agents).map(a => {
      const { status, label } = statusOf(a.lastSeenMs);
      return { ...a, chatsToday: a.chatsInWindow, status, statusLabel: label, lastSeenAgo: relTime(a.lastSeenMs) };
    }).sort((a, b) => b.lastSeenMs - a.lastSeenMs);

    const activeCount = rows.filter(a => a.status === 'active').length;
    const idleCount = rows.filter(a => a.status === 'idle').length;

    return NextResponse.json({
      ok: true,
      pulledAt: new Date().toISOString(),
      todayStr,
      summary: {
        activeAgents: activeCount,
        idleAgents: idleCount,
        offlineAgents: rows.length - activeCount - idleCount,
        totalAgents: rows.length,
        chatsToday: totalToday,
        openChatsNow: openChats.length,
      },
      agents: rows,
      openChats: openChats.map(c => {
        const ap = c.participants?.find(p => p.source_type === 'INTERNAL');
        const cu = c.participants?.find(p => p.source_type === 'CLIENT_USER');
        const ms = c.updated_at > 1e12 ? c.updated_at : c.updated_at * 1000;
        return { conversationId: c.conversation_id, agentName: ap?.nick_name || ap?.name || '', agentId: ap?.source_user_id || '', customerName: cu?.name || cu?.nick_name || 'Customer', websiteName: c.website_name, updatedAgo: relTime(ms), updatedMs: ms };
      }),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err), pulledAt: new Date().toISOString() }, { status: 500 });
  }
}
