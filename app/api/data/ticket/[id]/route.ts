export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ticketId = params.id;
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

    // Try welly_conversation_id first (most common path from all-chats)
    const { data: byWelly } = await supabase
      .from('pipeline_tickets')
      .select('*')
      .eq('welly_conversation_id', ticketId)
      .limit(1)
      .maybeSingle();

    if (byWelly) {
      return NextResponse.json({ ticket: byWelly });
    }

    // Fallback: try by Supabase UUID (only valid UUIDs)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(ticketId)) {
      const { data: byId } = await supabase
        .from('pipeline_tickets')
        .select('*')
        .eq('id', ticketId)
        .maybeSingle();

      if (byId) {
        return NextResponse.json({ ticket: byId });
      }
    }

    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  } catch (err) {
    console.error('[API] Ticket error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
