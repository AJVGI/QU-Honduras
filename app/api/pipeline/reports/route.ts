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

    // Fetch completed pipeline runs
    const { data: runs, error } = await supabase
      .from('pipeline_runs')
      .select('id, period_label, status, created_at, completed_at, total_tickets, agent_count, storage_paths')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    if (!runs || runs.length === 0) {
      return NextResponse.json({
        ok: true,
        reports: [],
        message: 'No reports available yet',
      });
    }

    // Build signed URLs for each run's files
    const reports = await Promise.all(
      runs.map(async (run) => {
        const paths: Record<string, string> = run.storage_paths || {};
        const signedUrls: Record<string, string> = {};

        for (const [key, storagePath] of Object.entries(paths)) {
          const { data: signed, error: signErr } = await supabase.storage
            .from('qa-reports')
            .createSignedUrl(storagePath as string, 3600); // 1 hour

          if (!signErr && signed?.signedUrl) {
            signedUrls[key] = signed.signedUrl;
          }
        }

        return {
          id: run.id,
          label: run.period_label,
          generated_at: run.completed_at || run.created_at,
          total_tickets: run.total_tickets,
          agent_count: run.agent_count,
          files: signedUrls,
        };
      })
    );

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
