import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { processNoteWithAI } from '@/lib/ai';

// PATCH /api/notes/[id] — update a note
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const { content, pinned } = body;
  const updates: Record<string, unknown> = {};

  if (content !== undefined) {
    if (typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content cannot be empty' }, { status: 400 });
    }
    updates.content = content.trim();
    updates.ai_status = 'pending';
    updates.ai_rewrite = null;
  }

  if (pinned !== undefined) {
    updates.pinned = Boolean(pinned);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('notes')
    .update(updates)
    .eq('id', params.id)
    .select('*, categories(*)')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Re-trigger AI if content changed
  if (content !== undefined) {
    processNoteWithAI(params.id).catch(console.error);
  }

  return NextResponse.json(data);
}

// DELETE /api/notes/[id] — delete a note
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await supabaseServer
    .from('notes')
    .delete()
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
