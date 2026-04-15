import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

const PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH || '';
const COOKIE_SECRET = process.env.AUTH_COOKIE_SECRET || '';
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'jd_qa_auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: NextRequest) {
  // Rate limiting: simple in-memory (resets on cold start, good enough for demo)
  const body = await request.json().catch(() => ({}));
  const { password } = body as { password?: string };

  if (!password) {
    return NextResponse.json({ error: 'Password required' }, { status: 400 });
  }

  // Hash the submitted password and compare
  const submitted = createHash('sha256').update(password).digest('hex');
  const valid = submitted === PASSWORD_HASH;

  if (!valid) {
    // Artificial delay to slow brute force
    await new Promise(r => setTimeout(r, 800));
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  // Build signed token: payload.hmac
  const payload = `auth:${Date.now()}`;
  const sig = await hmacSign(payload, COOKIE_SECRET);
  const token = `${payload}.${sig}`;

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });

  return response;
}
