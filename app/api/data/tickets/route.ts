export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface Ticket {
  id: string;
  run_id: string;
  agent_name: string;
  agent_alias: string;
  subject: string;
  category: string;
  frt_seconds: number | null;
  is_closed: boolean;
  has_recall: boolean;
  was_transferred: boolean;
  last_message_content: string;
  created_at: string;
  week_start: string;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const weekStart = url.searchParams.get('week_start');
    const limit = parseInt(url.searchParams.get('limit') || '200', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const agent = url.searchParams.get('agent');
    const category = url.searchParams.get('category');

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

    // Build query
    let query = supabase
      .from('pipeline_tickets')
      .select('*', { count: 'exact' });

    if (targetWeek) {
      query = query.eq('week_start', targetWeek);
    }

    if (agent) {
      query = query.eq('agent_name', agent);
    }

    if (category) {
      query = query.eq('category', category);
    }

    // Pagination
    query = query.order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error('[API] Error fetching tickets:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      tickets: (data || []) as Ticket[],
      total: count || 0,
      limit,
      offset,
      week_start: targetWeek,
    });
  } catch (err) {
    console.error('[API] Tickets error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
