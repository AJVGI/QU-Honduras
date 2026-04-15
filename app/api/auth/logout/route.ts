import { NextResponse } from 'next/server';

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'jd_qa_auth';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
  return response;
}
