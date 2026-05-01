/**
 * GET /api/pipeline/status
 * Returns the last pipeline run
 */

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
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (!data) {
      return NextResponse.json({
        lastRun: null,
        message: 'No runs yet',
      });
    }

    return NextResponse.json({
      ok: true,
      lastRun: data,
    });
  } catch (error) {
    console.error('Status check error:', (error as Error).message);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
