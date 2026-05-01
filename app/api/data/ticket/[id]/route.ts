export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface TicketData {
  id: string;
  welly_conversation_id: string;
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
  transcript: string | null;
  score: number | null;
  grade: string | null;
  auto_fail: boolean;
  auto_fail_reason: string | null;
  coaching_tip: string | null;
  week_start: string;
  created_at: string;
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ticketId = params.id;

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Fetch ticket by Supabase UUID or welly_conversation_id
    let query = supabase
      .from('pipeline_tickets')
      .select('*');

    // Try UUID first, then conversation_id
    const { data, error } = await query
      .or(`id.eq.${ticketId},welly_conversation_id.eq.${ticketId}`)
      .limit(1)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ticket: data as TicketData,
    });
  } catch (err) {
    console.error('[API] Ticket error:', err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
