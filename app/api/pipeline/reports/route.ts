/**
 * GET /api/pipeline/reports
 * Returns all completed pipeline runs with signed download URLs
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
      .order('period_start', { ascending: false });

    if (error) throw error;

    // Generate signed URLs for each report
    const reports = await Promise.all(
      (data || []).map(async (run) => {
        const urls: { qa: string | null; inquiry: string | null; individual: string | null } = { qa: null, inquiry: null, individual: null };

        if (run.qa_report_path) {
          const { data: url } = await supabase.storage.from('qa-reports').createSignedUrl(run.qa_report_path, 3600);
          if (url) urls.qa = url.signedUrl;
        }

        if (run.inquiry_report_path) {
          const { data: url } = await supabase.storage.from('qa-reports').createSignedUrl(run.inquiry_report_path, 3600);
          if (url) urls.inquiry = url.signedUrl;
        }

        if (run.individual_report_path) {
          const { data: url } = await supabase.storage.from('qa-reports').createSignedUrl(run.individual_report_path, 3600);
          if (url) urls.individual = url.signedUrl;
        }

        return {
          id: run.id,
          periodLabel: run.period_label,
          periodStart: run.period_start,
          periodEnd: run.period_end,
          createdAt: run.created_at,
          totalTickets: run.total_tickets,
          agentCount: run.agent_count,
          downloadUrls: urls,
        };
      })
    );

    return NextResponse.json({
      ok: true,
      reports,
    });
  } catch (error) {
    console.error('Reports fetch error:', (error as Error).message);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
