export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const env = {
    SUPABASE_URL: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.slice(0, 40) + '...' : 'MISSING',
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? process.env.SUPABASE_SERVICE_KEY.slice(0, 20) + '...' : 'MISSING',
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ? `SET(${process.env.OPENROUTER_API_KEY.length}chars, starts:${process.env.OPENROUTER_API_KEY.slice(0, 14)}...)` : 'MISSING',
    WELLYTALK_USER: process.env.WELLYTALK_USER || 'MISSING',
    WELLYTALK_PASS: process.env.WELLYTALK_PASS ? `SET(${process.env.WELLYTALK_PASS.length}chars)` : 'MISSING',
  };

  // Test Supabase connection + get recent runs
  let recentRuns: unknown[] = [];
  let supabaseStatus = 'untested';
  try {
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
    const { data, error } = await sb
      .from('pipeline_runs')
      .select('id, status, period_label, total_tickets, error_message, created_at, completed_at')
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) throw error;
    recentRuns = data || [];
    supabaseStatus = 'connected';
  } catch (e) {
    supabaseStatus = `error: ${(e as Error).message}`;
  }

  // Test WellyTalk auth
  let wellyStatus = 'untested';
  try {
    const res = await fetch('https://auth.stacktech.org/backend/auth/v1/user/sign-in', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ account: process.env.WELLYTALK_USER, password: process.env.WELLYTALK_PASS }),
    });
    const d = await res.json() as { code: number; message: string };
    wellyStatus = d.code === 0 ? 'auth OK' : `auth failed: ${d.message}`;
  } catch (e) {
    wellyStatus = `error: ${(e as Error).message}`;
  }

  // Test OpenRouter
  let openrouterStatus = 'untested';
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` },
    });
    openrouterStatus = res.ok ? `OK (${res.status})` : `failed (${res.status})`;
  } catch (e) {
    openrouterStatus = `error: ${(e as Error).message}`;
  }

  return NextResponse.json({
    env,
    connectivity: { supabase: supabaseStatus, wellytalk: wellyStatus, openrouter: openrouterStatus },
    recentRuns,
  }, { status: 200 });
}
