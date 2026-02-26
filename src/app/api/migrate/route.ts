import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// POST /api/migrate — run database migrations
// Call this once after deploying to add new columns
export async function POST() {
  const supabase = getSupabaseServer();
  const results: string[] = [];

  // 1. Add title column if it doesn't exist
  const { error: titleError } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE notes ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';`,
  });

  if (titleError) {
    // rpc 'exec_sql' might not exist — try via raw insert + check
    // Fallback: just try to select the column to see if it exists
    const { error: checkError } = await supabase
      .from('notes')
      .select('title')
      .limit(1);

    if (checkError && checkError.message.includes('title')) {
      results.push(`title column: NEEDS MANUAL MIGRATION — run in Supabase SQL Editor: ALTER TABLE notes ADD COLUMN title text NOT NULL DEFAULT '';`);
    } else {
      results.push('title column: already exists');
    }
  } else {
    results.push('title column: added successfully');
  }

  return NextResponse.json({ results });
}
