export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({
    SUPABASE_URL: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.slice(0,30)+'...' : 'MISSING',
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? process.env.SUPABASE_SERVICE_KEY.slice(0,20)+'...' : 'MISSING',
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ? 'SET('+process.env.OPENROUTER_API_KEY.length+'chars)' : 'MISSING',
    WELLYTALK_USER: process.env.WELLYTALK_USER || 'MISSING',
    WELLYTALK_PASS: process.env.WELLYTALK_PASS ? 'SET('+process.env.WELLYTALK_PASS.length+'chars)' : 'MISSING',
  });
}
