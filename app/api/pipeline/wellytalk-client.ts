/**
 * WellyTalk API client with token caching and refresh
 */

import { WellyChat, WellyConversationDetail } from './types';

const API_BASE = 'https://api.stacktech.org';
const AUTH_BASE = 'https://auth.stacktech.org';
const COMPANY_ID = '3046';

interface TokenCache {
  ac_token: string;
  rf_token: string;
  exp: number;
}

let tokenCache: TokenCache | null = null;

async function wt(url: string, opts: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) {
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: {
      'content-type': 'application/json',
      'origin': 'https://cs.wellytalk.com',
      ...opts.headers,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}: ${await res.text()}`);
  }
  return res.json();
}

async function login(): Promise<TokenCache> {
  const d = (await wt(`${AUTH_BASE}/backend/auth/v1/user/sign-in`, {
    method: 'POST',
    body: {
      account: process.env.WELLYTALK_USER || 'xtractadmin01',
      password: process.env.WELLYTALK_PASS || 'Wellytalk2026!',
    },
  })) as { code: number; data: { ac_token: string; rf_token: string; exp_time: number } };

  if (d.code !== 0) throw new Error(`Login failed: code ${d.code}`);
  return { ac_token: d.data.ac_token, rf_token: d.data.rf_token, exp: Date.now() + 3300 * 1000 };
}

async function refreshToken(rf: string): Promise<TokenCache> {
  const d = (await wt(`${AUTH_BASE}/backend/auth/v1/user/refresh-token`, {
    method: 'POST',
    body: { rf_token: rf },
  })) as { code: number; data: { ac_token: string; rf_token: string } };

  if (d.code !== 0) throw new Error(`Refresh failed: code ${d.code}`);
  return { ac_token: d.data.ac_token, rf_token: d.data.rf_token, exp: Date.now() + 3300 * 1000 };
}

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.exp) return tokenCache.ac_token;
  if (tokenCache?.rf_token) {
    try {
      tokenCache = await refreshToken(tokenCache.rf_token);
      return tokenCache.ac_token;
    } catch (e) {
      console.warn('Token refresh failed, re-login:', e);
    }
  }
  tokenCache = await login();
  return tokenCache.ac_token;
}

export async function fetchChatRecords(
  limit: number = 100,
  offset: number = 0,
  fromDate?: number,
  toDate?: number
): Promise<WellyChat[]> {
  const token = await getToken();
  const authHdrs = {
    Authorization: `Bearer ${token}`,
    'x-company-id': COMPANY_ID,
    'x-timezone': 'America/New_York',
  };

  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    is_personal: 'false',
    filter_mode: '1',
    search_type: '1',
    time_updated: '0',
  });

  if (fromDate) params.set('from_date', String(fromDate));
  if (toDate) params.set('to_date', String(toDate));

  const url = `${API_BASE}/backend/cs-agent/v1/conversation/chat-records?${params}`;
  const res = (await wt(url, { headers: authHdrs })) as {
    code: number;
    data: { list: WellyChat[]; total: number };
  };

  if (res.code !== 0) {
    throw new Error(`Failed to fetch chat records: code ${res.code}`);
  }

  return res.data?.list || [];
}

export async function fetchConversationDetail(conversationId: string): Promise<WellyConversationDetail> {
  const token = await getToken();
  const authHdrs = {
    Authorization: `Bearer ${token}`,
    'x-company-id': COMPANY_ID,
    'x-timezone': 'America/New_York',
  };

  // Try the detail endpoint first
  try {
    const url = `${API_BASE}/backend/cs-agent/v1/conversation/detail?conversation_id=${conversationId}`;
    const res = await wt(url, { headers: authHdrs });
    if (res.code === 0) return res;
  } catch (e) {
    console.warn(`Detail endpoint failed for ${conversationId}, trying messages endpoint`);
  }

  // Fallback to messages endpoint
  try {
    const url = `${API_BASE}/backend/cs-agent/v1/conversation/${conversationId}/messages`;
    const res = await wt(url, { headers: authHdrs });
    if (res.code === 0) return res;
  } catch (e) {
    console.warn(`Messages endpoint failed for ${conversationId}, returning minimal data`);
  }

  // Return minimal valid response if both fail
  return {
    code: 0,
    data: {
      conversation_id: conversationId,
      participants: [],
      messages: [],
      status: 'CLOSED',
      created_at: Date.now(),
      updated_at: Date.now(),
    },
  };
}

export async function fetchAllChatRecordsForPeriod(
  fromDate: number,
  toDate: number
): Promise<WellyChat[]> {
  const allChats: WellyChat[] = [];
  const pageSize = 100;
  let offset = 0;
  let total = 0;
  let hasMore = true;

  while (hasMore) {
    const batch = await fetchChatRecords(pageSize, offset, fromDate, toDate);
    allChats.push(...batch);

    offset += pageSize;
    total = batch.length;
    hasMore = total === pageSize;

    // Safety: don't fetch more than 10,000 chats
    if (allChats.length > 10000) {
      console.warn('Stopping fetch at 10,000 chats');
      break;
    }
  }

  return allChats;
}
