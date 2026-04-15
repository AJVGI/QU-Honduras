import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'jd_qa_auth';
const COOKIE_SECRET = process.env.AUTH_COOKIE_SECRET || '';

// Public paths that never require auth
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p));
}

async function verifyToken(token: string): Promise<boolean> {
  if (!token || !COOKIE_SECRET) return false;
  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return false;
    const expected = await hmacSign(payload, COOKIE_SECRET);
    // Constant-time compare
    return expected === sig;
  } catch {
    return false;
  }
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check auth cookie
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const valid = await verifyToken(token || '');

  if (!valid) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
