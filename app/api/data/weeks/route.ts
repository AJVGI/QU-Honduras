export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Get distinct week_start dates from pipeline_runs (completed only)
    const { data: runs, error } = await supabase
      .from('pipeline_runs')
      .select('period_start, period_end, completed_at')
      .eq('status', 'completed')
      .order('period_start', { ascending: false });

    if (error) {
      console.error('[API] Error fetching weeks:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const weeks = (runs || []).map((run: any) => ({
      week_start: run.period_start,
      week_end: run.period_end,
      completed_at: run.completed_at,
    }));

    return NextResponse.json({
      weeks,
    });
  } catch (err) {
    console.error('[API] Weeks error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
