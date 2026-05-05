/**
 * GET /api/pipeline/reports
 * Returns all available pipeline runs with signed download URLs from Supabase Storage
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Fetch completed pipeline runs — deduplicate by period_label, take most recent per period
    const { data: runs, error } = await supabase
      .from('pipeline_runs')
      .select('id, period_label, status, created_at, completed_at, total_tickets, agent_count, storage_paths, qa_report_path, inquiry_report_path, individual_report_path')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    if (!runs || runs.length === 0) {
      return NextResponse.json({
        ok: true,
        reports: [],
        message: 'No reports available yet',
      });
    }

    // Deduplicate: keep only the most recent run per period_label
    const seen = new Set<string>();
    const uniqueRuns = runs.filter(r => {
      if (seen.has(r.period_label)) return false;
      seen.add(r.period_label);
      return true;
    });

    // Build proxy download URLs — read from the correct path columns
    const reports = uniqueRuns.map((run) => {
      // Resolve paths: prefer storage_paths JSON blob, fall back to individual columns
      const storagePaths: Record<string, string> = run.storage_paths || {};
      const qaPath = storagePaths.qa_report || run.qa_report_path;
      const inquiryPath = storagePaths.inquiry_report || run.inquiry_report_path;
      const agentPath = storagePaths.agent_report || run.individual_report_path;

      const makeUrl = (p: string | null) =>
        p ? `/api/pipeline/download?path=${encodeURIComponent(p)}` : null;

      return {
        id: run.id,
        label: run.period_label,
        generated_at: run.completed_at || run.created_at,
        total_tickets: run.total_tickets,
        agent_count: run.agent_count,
        files: {
          qa_report: makeUrl(qaPath),
          inquiry_report: makeUrl(inquiryPath),
          agent_report: makeUrl(agentPath),
        },
      };
    }).filter(r => r.files.qa_report || r.files.inquiry_report || r.files.agent_report);

    return NextResponse.json({
      ok: true,
      reports,
      last_updated: runs[0]?.completed_at || runs[0]?.created_at,
    });
  } catch (err) {
    console.error('[Reports] Error:', err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
