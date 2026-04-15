import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'jd_qa_auth';
const COOKIE_SECRET = process.env.AUTH_COOKIE_SECRET || '';

async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ role: null });

  try {
    const lastDot = token.lastIndexOf('.');
    const payload = token.substring(0, lastDot);
    const sig = token.substring(lastDot + 1);
    const expected = await hmacSign(payload, COOKIE_SECRET);
    if (expected !== sig) return NextResponse.json({ role: null });
    const role = payload.split(':')[0];
    return NextResponse.json({ role });
  } catch {
    return NextResponse.json({ role: null });
  }
}
