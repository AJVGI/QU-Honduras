export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface Agent {
  id: string;
  run_id: string;
  agent_name: string;
  agent_alias: string;
  tickets: number;
  closed: number;
  closure_pct: number;
  avg_frt_seconds: number | null;
  recalls: number;
  week_start: string;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const weekStart = url.searchParams.get('week_start');

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // If no week_start provided, get the most recent week
    let targetWeek = weekStart;
    if (!targetWeek) {
      const { data: recentRun } = await supabase
        .from('pipeline_runs')
        .select('period_start')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (recentRun) {
        targetWeek = recentRun.period_start;
      }
    }

    // Get available weeks
    const { data: distinctWeeks } = await supabase
      .from('pipeline_agents')
      .select('week_start')
      .order('week_start', { ascending: false })
      .then(result => {
        if (result.data) {
          const unique = Array.from(new Set((result.data as any[]).map((r: any) => r.week_start)));
          return { data: unique };
        }
        return { data: [] };
      });

    // Get the latest run_id so we don't mix duplicate agent rows from multiple runs
    const { data: latestRun } = await supabase
      .from('pipeline_runs')
      .select('id')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const latestRunId = latestRun?.id;

    // Get agents for the latest run only (avoids 4x duplicate rows)
    let query = supabase
      .from('pipeline_agents')
      .select('*');

    if (latestRunId) {
      query = query.eq('run_id', latestRunId);
    } else if (targetWeek) {
      query = query.eq('week_start', targetWeek);
    }

    query = query.order('tickets', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('[API] Error fetching agents:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      agents: (data || []) as Agent[],
      week_start: targetWeek,
      available_weeks: distinctWeeks || [],
    });
  } catch (err) {
    console.error('[API] Agents error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
