/**
 * GET /api/pipeline/download?path=...
 * Generates a signed URL and redirects to it
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

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

    const { data, error } = await supabase.storage.from('qa-reports').createSignedUrl(path, 3600);

    if (error || !data) {
      return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 });
    }

    return NextResponse.redirect(data.signedUrl);
  } catch (error) {
    console.error('Download error:', (error as Error).message);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
