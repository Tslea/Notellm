import { NextRequest, NextResponse } from 'next/server';
import { processNoteWithAI } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // allow up to 30s for AI processing

// POST /api/notes/[id]/reprocess — trigger AI processing (awaited so Vercel keeps the function alive)
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  await processNoteWithAI(params.id);
  return NextResponse.json({ status: 'done' });
}
