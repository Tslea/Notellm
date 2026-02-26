import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

// GET /api/categories — list all categories
export async function GET() {
  const { data, error } = await supabaseServer
    .from('categories')
    .select('*')
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
