export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error('Missing Supabase env vars');
    const supabase = createClient(url, key);

    const { data, error } = await supabase
      .from('pipeline_runs')
      .select('*')
      .in('status', ['completed', 'failed', 'running'])
      .not('period_label', 'ilike', 'test%')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ ok: true, lastRun: data || null });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
