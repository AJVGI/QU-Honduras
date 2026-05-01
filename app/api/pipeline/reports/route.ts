/**
 * GET /api/pipeline/reports
 * Returns all available reports
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const indexResp = await fetch('https://blob.vercelusercontent.com/reports/index.json', {
      cache: 'no-store',
    });

    if (!indexResp.ok) {
      return NextResponse.json({
        ok: true,
        reports: [],
        message: 'No reports available yet',
      });
    }

    const index = await indexResp.json();

    return NextResponse.json({
      ok: true,
      reports: index.periods || [],
      last_updated: index.last_updated,
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
