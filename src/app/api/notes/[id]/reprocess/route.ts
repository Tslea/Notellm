import { NextRequest, NextResponse } from 'next/server';
import { processNoteWithAI } from '@/lib/ai';

// POST /api/notes/[id]/reprocess — retry AI processing
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  processNoteWithAI(params.id).catch(console.error);
  return NextResponse.json({ status: 'processing' });
}
