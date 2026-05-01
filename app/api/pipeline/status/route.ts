/**
 * GET /api/pipeline/status
 * Returns last pipeline run status
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Try to fetch the index from Vercel Blob
    const indexResp = await fetch('https://blob.vercelusercontent.com/reports/index.json', {
      cache: 'no-store',
    });

    if (!indexResp.ok) {
      return NextResponse.json({
        ok: true,
        status: 'no_runs',
        message: 'No pipeline runs yet',
      });
    }

    const index = await indexResp.json();
    const lastRun = index.periods?.[0];

    if (!lastRun) {
      return NextResponse.json({
        ok: true,
        status: 'no_runs',
        message: 'No pipeline runs yet',
      });
    }

    return NextResponse.json({
      ok: true,
      status: 'success',
      last_run: {
        period: lastRun.label,
        generated_at: lastRun.generated_at,
        files: lastRun.files,
      },
      index_updated: index.last_updated,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: String(err),
      },
      { status: 500 }
    );
  }
}
