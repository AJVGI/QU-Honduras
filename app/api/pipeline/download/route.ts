/**
 * GET /api/pipeline/download?path=...
 * Streams the file from Supabase storage through this proxy.
 * Never redirects to Supabase directly — avoids JWT expiry issues.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const path = url.searchParams.get('path');

    if (!path) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Download the raw bytes from storage — no signed URL, uses service key directly
    const { data, error } = await supabase.storage
      .from('qa-reports')
      .download(path);

    if (error || !data) {
      console.error('Storage download error:', error?.message);
      return NextResponse.json(
        { error: error?.message || 'File not found' },
        { status: 404 }
      );
    }

    // Stream bytes back to the browser with proper headers
    const filename = path.split('/').pop() || 'report.docx';
    const arrayBuffer = await data.arrayBuffer();

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': arrayBuffer.byteLength.toString(),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('Download error:', (err as Error).message);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
