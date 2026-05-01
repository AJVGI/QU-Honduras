/**
 * GET /api/pipeline/reports
 * Returns all completed pipeline runs with download paths (not pre-signed URLs)
 * Downloads go through /api/pipeline/download?path=... which generates fresh signed URLs
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

    const { data, error } = await supabase
      .from('pipeline_runs')
      .select('*')
      .eq('status', 'completed')
      .not('period_label', 'ilike', 'test%')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const reports = (data || []).map((run) => ({
      id: run.id,
      periodLabel: run.period_label,
      periodStart: run.period_start,
      periodEnd: run.period_end,
      createdAt: run.created_at,
      totalTickets: run.total_tickets,
      agentCount: run.agent_count,
      // Return proxy download URLs — fresh signed URL generated on each click
      downloadUrls: {
        qa: run.qa_report_path
          ? `/api/pipeline/download?path=${encodeURIComponent(run.qa_report_path)}`
          : null,
        inquiry: run.inquiry_report_path
          ? `/api/pipeline/download?path=${encodeURIComponent(run.inquiry_report_path)}`
          : null,
        individual: run.individual_report_path
          ? `/api/pipeline/download?path=${encodeURIComponent(run.individual_report_path)}`
          : null,
      },
    }));

    return NextResponse.json({ ok: true, reports });
  } catch (error) {
    console.error('Reports fetch error:', (error as Error).message);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
