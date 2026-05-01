export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

const API_BASE = 'https://api.stacktech.org';
const AUTH_BASE = 'https://auth.stacktech.org';

// Simple token cache for this route
let cachedToken: { token: string; exp: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.exp) return cachedToken.token;
  const res = await fetch(`${AUTH_BASE}/backend/auth/v1/user/sign-in`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account: process.env.WELLYTALK_USER, password: process.env.WELLYTALK_PASS }),
  });
  const d = await res.json() as { code: number; data: { ac_token: string } };
  if (d.code !== 0) throw new Error('WellyTalk auth failed');
  cachedToken = { token: d.data.ac_token, exp: Date.now() + 3300 * 1000 };
  return cachedToken.token;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const conversationId = params.id;
    const token = await getToken();
    
    const url = `${API_BASE}/backend/cs-agent/v1/conversation/histories?last_message_id=0&limit=200&direction=previous&conversation_ids=%5B${conversationId}%5D`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-company-id': '3046',
      },
    });
    
    const data = await res.json() as { code: number; data: { items: Array<Record<string, unknown>> } };
    if (data.code !== 0) return NextResponse.json({ error: 'API error', messages: [] });
    
    const items = data.data?.items || [];
    
    const messages = items.map(msg => {
      const isBot = String(msg.sender_id) === '-2147483648';
      const isAgent = msg.source_type === 1 && !isBot;
      const content = msg.content as Record<string, unknown> | null;
      const text = ((content?.body_content as string) || (content?.text as string) || '').replace(/<[^>]+>/g, '').trim();
      const recalled = (msg.recall_info as Record<string, unknown>)?.recall_at ? true : false;
      
      return {
        messageId: msg.message_id as string,
        sender: isBot ? 'bot' : isAgent ? 'agent' : 'client',
        text,
        recalled,
        createdAt: msg.created_at as number,
        contentType: (content?.type as string) || 'text',
      };
    }).filter(m => m.text);
    
    return NextResponse.json({ ok: true, conversationId, messages, total: messages.length });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message, messages: [] }, { status: 500 });
  }
}
