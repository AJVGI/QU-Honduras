import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'jd_qa_auth';
const COOKIE_SECRET = process.env.AUTH_COOKIE_SECRET || '';

// Public paths — no auth required
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout', '/api/live-status'];

// Admin-only paths — user role gets 403
const ADMIN_ONLY_PATHS = ['/settings', '/reports/export'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p));
}

function isAdminOnly(pathname: string): boolean {
  return ADMIN_ONLY_PATHS.some(p => pathname.startsWith(p));
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyToken(token: string): Promise<{ valid: boolean; role: string | null }> {
  if (!token || !COOKIE_SECRET) return { valid: false, role: null };
  try {
    const lastDot = token.lastIndexOf('.');
    if (lastDot === -1) return { valid: false, role: null };
    const payload = token.substring(0, lastDot);
    const sig = token.substring(lastDot + 1);
    const expected = await hmacSign(payload, COOKIE_SECRET);
    if (expected !== sig) return { valid: false, role: null };
    // payload format: role:timestamp
    const role = payload.split(':')[0];
    return { valid: true, role };
  } catch {
    return { valid: false, role: null };
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const { valid, role } = await verifyToken(token || '');

  if (!valid) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin-only route check
  if (isAdminOnly(pathname) && role !== 'admin') {
    return NextResponse.redirect(new URL('/denied', request.url));
  }

  // Inject role into request header for downstream use
  const response = NextResponse.next();
  response.headers.set('x-user-role', role || 'user');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
