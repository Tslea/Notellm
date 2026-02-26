import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { processNoteWithAI } from '@/lib/ai';

// GET /api/notes — list notes
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get('category_id');
  const search = searchParams.get('search');

  let query = supabaseServer
    .from('notes')
    .select('*, categories(*)')
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false });

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  if (search) {
    query = query.ilike('content', `%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/notes — create a note
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { content } = body;

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('notes')
    .insert({ content: content.trim(), ai_status: 'pending' })
    .select('*, categories(*)')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Trigger AI processing asynchronously (don't await)
  processNoteWithAI(data.id).catch(console.error);

  return NextResponse.json(data, { status: 201 });
}
