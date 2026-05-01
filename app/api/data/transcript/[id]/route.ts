export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

const API_BASE = 'https://api.stacktech.org';
const AUTH_BASE = 'https://auth.stacktech.org';

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

interface Participant {
  chat_user_id: string;
  source_type: string; // 'INTERNAL' or 'CLIENT_USER'
  name: string;
  nick_name: string;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const conversationId = params.id;
    const token = await getToken();
    const hdrs = { 'Authorization': `Bearer ${token}`, 'x-company-id': '3046' };

    // Step 1: Get conversation detail to identify agent vs client sender_ids
    const detailRes = await fetch(`${API_BASE}/backend/cs-agent/v1/conversation/${conversationId}`, { headers: hdrs });
    const detailData = await detailRes.json() as { code: number; data: { participants?: Participant[]; detail_payload?: { participants?: Participant[] } } };

    // Build a map of chat_user_id → role
    const senderRoleMap = new Map<string, 'agent' | 'client'>();
    if (detailData.code === 0) {
      const participants = (detailData.data?.participants || detailData.data?.detail_payload?.participants || []) as Participant[];
      for (const p of participants) {
        const id = String(p.chat_user_id || '');
        if (id) {
          senderRoleMap.set(id, p.source_type === 'INTERNAL' ? 'agent' : 'client');
        }
      }
    }

    // Step 2: Fetch message history
    const url = `${API_BASE}/backend/cs-agent/v1/conversation/histories?last_message_id=0&limit=200&direction=previous&conversation_ids=%5B${conversationId}%5D`;
    const res = await fetch(url, { headers: hdrs });
    const data = await res.json() as { code: number; data: { items: Array<Record<string, unknown>> } };
    if (data.code !== 0) return NextResponse.json({ error: 'API error', messages: [] });

    const items = (data.data?.items || []).reverse(); // Reverse to show oldest first

    const messages = items.map(msg => {
      const senderId = String(msg.sender_id || '');
      const isBot = senderId === '-2147483648' || senderId.startsWith('-');
      const content = msg.content as Record<string, unknown> | null;
      const contentType = (content?.type as string) || 'text';

      // Skip pure event messages with no text
      if (contentType === 'event') return null;

      let text = ((content?.body_content as string) || (content?.text as string) || '').replace(/<[^>]+>/g, '').trim();
      if (!text) return null;

      // Determine sender from participant map
      let sender: 'agent' | 'client' | 'bot';
      if (isBot) {
        sender = 'bot';
        // Only show meaningful bot messages
        if (!text.includes('Welcome') && !text.includes('received') && !text.includes('patience')) return null;
      } else {
        sender = senderRoleMap.get(senderId) || 'client';
      }

      const recalled = ((msg.recall_info as Record<string, unknown>)?.recall_at as number) > 0;

      return {
        messageId: msg.message_id as string,
        sender,
        text,
        recalled,
        createdAt: msg.created_at as number,
        contentType,
      };
    }).filter((m): m is NonNullable<typeof m> => m !== null);

    // Get agent name from participants
    const agentParticipant = detailData.code === 0
      ? ((detailData.data?.participants || detailData.data?.detail_payload?.participants || []) as Participant[])
          .find(p => p.source_type === 'INTERNAL')
      : null;

    return NextResponse.json({
      ok: true,
      conversationId,
      messages,
      total: messages.length,
      agentName: agentParticipant?.name || null,
      agentAlias: agentParticipant?.nick_name || null,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message, messages: [] }, { status: 500 });
  }
}
