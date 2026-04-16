/**
 * Live Agent Status API
 * 
 * Pulls real-time agent activity from WellyTalk by fetching today's chats.
 * Called by the supervisor dashboard every 30 seconds.
 * Zero AI cost — pure WellyTalk API calls.
 * 
 * GET /api/live-status
 * Returns: { agents, summary, openChats, pulledAt }
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import https from 'https';

const API_BASE = 'https://api.stacktech.org';
const AUTH_BASE = 'https://auth.stacktech.org';
const COMPANY_ID = '3046';

interface TokenCache {
  ac_token: string;
  rf_token: string;
  exp: number;
}

// In-memory token cache (survives across requests in same process)
let tokenCache: TokenCache | null = null;

function httpRequest(url: string, options: {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
} = {}): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'content-type': 'application/json',
        'origin': 'https://cs.wellytalk.com',
        'user-agent': 'Mozilla/5.0 (compatible; CLAJ/1.0)',
        ...options.headers,
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 0, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode || 0, data: body });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function login(): Promise<TokenCache> {
  const resp = await httpRequest(`${AUTH_BASE}/backend/account/v1/account/login`, {
    method: 'POST',
    body: {
      account: process.env.WELLYTALK_USER || 'xtractadmin01',
      password: process.env.WELLYTALK_PASS || 'Wellytalk2026!',
    },
  });
  const d = resp.data as { code: number; data: { ac_token: string; rf_token: string; ac_exp: number } };
  if (d.code !== 0) throw new Error(`Login failed: ${JSON.stringify(d)}`);
  return {
    ac_token: d.data.ac_token,
    rf_token: d.data.rf_token,
    exp: Date.now() + (d.data.ac_exp - 60) * 1000,
  };
}

async function refreshToken(rfToken: string): Promise<TokenCache> {
  const resp = await httpRequest(`${AUTH_BASE}/backend/account/v1/account/refresh-token`, {
    method: 'POST',
    body: { rf_token: rfToken },
  });
  const d = resp.data as { code: number; data: { ac_token: string; rf_token: string; ac_exp: number } };
  if (d.code !== 0) throw new Error(`Refresh failed: ${JSON.stringify(d)}`);
  return {
    ac_token: d.data.ac_token,
    rf_token: d.data.rf_token,
    exp: Date.now() + (d.data.ac_exp - 60) * 1000,
  };
}

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.exp) return tokenCache.ac_token;
  if (tokenCache?.rf_token) {
    try {
      tokenCache = await refreshToken(tokenCache.rf_token);
      return tokenCache.ac_token;
    } catch {
      // fall through to login
    }
  }
  tokenCache = await login();
  return tokenCache.ac_token;
}

interface WellyParticipant {
  source_type: string;
  source_user_id: string;
  name: string;
  nick_name: string;
  chat_user_id: string;
}

interface WellyChat {
  conversation_id: string;
  participants: WellyParticipant[];
  status: string;
  updated_at: number;
  created_at: number;
  website_name: string;
  last_message?: { content?: { body_content?: string } };
}

interface AgentStatus {
  id: string;
  name: string;
  chatUserId: string;
  chatsToday: number;
  openChats: number;
  closedChats: number;
  lastSeenMs: number;           // ms timestamp
  lastSeenAgo: string;          // "Xm ago" etc
  status: 'active' | 'idle' | 'offline';
  statusLabel: string;
  firstChatToday: number;       // ms timestamp
  totalMsgsSent?: number;       // from open chat data
}

function relativeTime(ms: number): string {
  const ago = Math.round((Date.now() - ms) / 60000);
  if (ago < 1) return 'just now';
  if (ago < 60) return `${ago}m ago`;
  if (ago < 1440) return `${Math.round(ago / 60)}h ago`;
  return `${Math.round(ago / 1440)}d ago`;
}

function getStatus(lastSeenMs: number): { status: 'active' | 'idle' | 'offline'; label: string } {
  const ago = Date.now() - lastSeenMs;
  if (ago < 15 * 60 * 1000) return { status: 'active', label: '🟢 Active' };
  if (ago < 2 * 60 * 60 * 1000) return { status: 'idle', label: '🟡 Idle' };
  return { status: 'offline', label: '🔴 Offline' };
}

export async function GET() {
  try {
    const token = await getToken();

    // Today start in ET (UTC-4)
    const etNow = new Date(Date.now() - 4 * 3600 * 1000);
    const todayStr = etNow.toISOString().slice(0, 10);
    const todayStartEpochSec = Math.floor(new Date(todayStr + 'T04:00:00Z').getTime() / 1000); // midnight ET = 4am UTC

    // Fetch all today's chats (paginate)
    const allChats: WellyChat[] = [];
    let cursor = 0;
    let pages = 0;
    while (pages < 20) {
      const url = `${API_BASE}/backend/cs-agent/v1/conversation/chat-records?limit=100&is_personal=false&filter_mode=1&search_type=1&time_updated=${cursor}&from_date=${todayStartEpochSec}`;
      const resp = await httpRequest(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-company-id': COMPANY_ID,
          'x-timezone': 'America/New_York',
        },
      });
      const d = resp.data as { code: number; data: { list: WellyChat[]; total: number } };
      if (d.code !== 0) break;
      const list = d.data?.list || [];
      if (list.length === 0) break;
      allChats.push(...list);
      if (list.length < 100) break;
      cursor = list[list.length - 1].updated_at;
      pages++;
    }

    // Also fetch currently OPEN chats
    const openResp = await httpRequest(
      `${API_BASE}/backend/cs-agent/v1/conversation/chat-records?limit=100&is_personal=false&filter_mode=1&search_type=1&time_updated=0&status=OPEN`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-company-id': COMPANY_ID,
          'x-timezone': 'America/New_York',
        },
      }
    );
    const openData = openResp.data as { code: number; data: { list: WellyChat[] } };
    const openChats = openData.code === 0 ? (openData.data?.list || []) : [];

    // Build agent map from today's chats
    const agentMap: Record<string, AgentStatus> = {};

    for (const chat of allChats) {
      const agentPart = chat.participants?.find((p) => p.source_type === 'INTERNAL');
      if (!agentPart) continue;

      const id = agentPart.source_user_id;
      const name = agentPart.nick_name || agentPart.name || `Agent ${id}`;
      const updatedMs = chat.updated_at > 1e12 ? chat.updated_at : chat.updated_at * 1000;
      const createdMs = chat.created_at > 1e12 ? chat.created_at : chat.created_at * 1000;

      if (!agentMap[id]) {
        agentMap[id] = {
          id,
          name,
          chatUserId: agentPart.chat_user_id,
          chatsToday: 0,
          openChats: 0,
          closedChats: 0,
          lastSeenMs: 0,
          lastSeenAgo: '',
          status: 'offline',
          statusLabel: '🔴 Offline',
          firstChatToday: createdMs,
        };
      }

      agentMap[id].chatsToday++;
      if (chat.status === 'OPEN') agentMap[id].openChats++;
      else agentMap[id].closedChats++;
      if (updatedMs > agentMap[id].lastSeenMs) agentMap[id].lastSeenMs = updatedMs;
      if (createdMs < agentMap[id].firstChatToday) agentMap[id].firstChatToday = createdMs;
    }

    // Finalize statuses
    const agents: AgentStatus[] = Object.values(agentMap).map((a) => {
      const { status, label } = getStatus(a.lastSeenMs);
      return {
        ...a,
        lastSeenAgo: relativeTime(a.lastSeenMs),
        status,
        statusLabel: label,
      };
    }).sort((a, b) => b.lastSeenMs - a.lastSeenMs);

    // Summary
    const activeCount = agents.filter((a) => a.status === 'active').length;
    const idleCount = agents.filter((a) => a.status === 'idle').length;
    const offlineCount = agents.filter((a) => a.status === 'offline').length;
    const totalChatsToday = agents.reduce((s, a) => s + a.chatsToday, 0);
    const totalOpenNow = openChats.length;

    // Open chat details (who has open chats right now)
    const openChatDetails = openChats.map((chat) => {
      const agentPart = chat.participants?.find((p) => p.source_type === 'INTERNAL');
      const customerPart = chat.participants?.find((p) => p.source_type === 'CLIENT_USER');
      const updatedMs = chat.updated_at > 1e12 ? chat.updated_at : chat.updated_at * 1000;
      return {
        conversationId: chat.conversation_id,
        agentName: agentPart?.nick_name || agentPart?.name || 'Unknown',
        agentId: agentPart?.source_user_id || '',
        customerName: customerPart?.name || customerPart?.nick_name || 'Customer',
        websiteName: chat.website_name,
        updatedAgo: relativeTime(updatedMs),
        updatedMs,
      };
    });

    return NextResponse.json({
      ok: true,
      pulledAt: new Date().toISOString(),
      todayStr,
      summary: {
        activeAgents: activeCount,
        idleAgents: idleCount,
        offlineAgents: offlineCount,
        totalAgents: agents.length,
        chatsToday: totalChatsToday,
        openChatsNow: totalOpenNow,
      },
      agents,
      openChats: openChatDetails,
    });
  } catch (err) {
    console.error('[live-status] error:', err);
    return NextResponse.json(
      { ok: false, error: String(err), pulledAt: new Date().toISOString() },
      { status: 500 }
    );
  }
}
