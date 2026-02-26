import { supabaseServer } from './supabase-server';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Fallback chain: gpt-oss-20b → MiMo-V2-Flash → Grok 4.1 Fast
const MODELS = [
  'openai/gpt-oss-20b',
  'xiaomi/mimo-v2-flash',
  'x-ai/grok-4.1-fast',
];
const TIMEOUT_MS = 15_000; // 15s per model attempt

interface AIResponse {
  title: string;
  rewrite: string;
  category: string;
}

const SYSTEM_PROMPT = `You are a note-rewriting assistant. You will receive a raw note written quickly by a user and must produce a clean, well-structured version.

CRITICAL RULES:
- IDENTIFY THE SUBJECT: Read the entire note first. Figure out WHO or WHAT the note is about. People, projects, places, events — never lose track of the subject.
- PRESERVE ALL KEY FACTS: names, dates, numbers, locations, deadlines, links — keep everything. Do not drop or invent information.
- KEEP THE ORIGINAL LANGUAGE: if the note is in Italian, rewrite in Italian. If in English, rewrite in English. Never translate.
- BE CONCISE: remove filler words and repetition, but do not cut substance.
- USE MARKDOWN: use headings, bullet points, bold for key terms when it improves readability. Keep it light — don't over-format short notes.
- GENERATE A TITLE: write a short, descriptive title (3-8 words) that captures the main subject of the note.

You must respond ONLY with valid JSON (no markdown fences, no extra text).`;

async function callOpenRouter(
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<AIResponse> {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status} (${model})`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error(`Empty AI response (${model})`);

  // Parse JSON — handle possible markdown fences
  let cleaned = content;
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  return JSON.parse(cleaned) as AIResponse;
}

export async function processNoteWithAI(noteId: string) {
  try {
    // Set status to processing and clear old rewrite
    await supabaseServer
      .from('notes')
      .update({ ai_status: 'processing', ai_rewrite: null })
      .eq('id', noteId);

    // Fetch the note
    const { data: note, error: noteError } = await supabaseServer
      .from('notes')
      .select('content')
      .eq('id', noteId)
      .single();

    if (noteError || !note) throw new Error('Note not found');

    // Fetch existing categories
    const { data: categories } = await supabaseServer
      .from('categories')
      .select('id, name')
      .order('name');

    const categoryNames = categories?.map((c) => c.name) || [];
    const categoriesList = categoryNames.length > 0 ? categoryNames.join(', ') : '(none yet)';

    const userPrompt = `Existing categories: ${categoriesList}

Raw note:
"""
${note.content}
"""

Tasks:
1. TITLE: write a short title (3-8 words) that captures the main subject.
2. REWRITE: improve clarity, fix grammar, organize with markdown. Keep the same language. Keep all facts.
3. CATEGORY: pick the best fit from existing categories. Only create a new one (1-3 words) if none fit.

Respond with JSON:
{"title": "...", "rewrite": "...", "category": "..."}`;

    // Try each model in order until one succeeds
    let parsed: AIResponse | null = null;
    let lastError: Error | null = null;

    for (const model of MODELS) {
      try {
        parsed = await callOpenRouter(model, SYSTEM_PROMPT, userPrompt);
        break; // success
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`Model ${model} failed:`, lastError.message);
      }
    }

    if (!parsed) {
      throw lastError ?? new Error('All models failed');
    }

    // Resolve category
    let categoryId: string | null = null;
    if (parsed.category) {
      // Try to find existing category (case-insensitive)
      const existing = categories?.find(
        (c) => c.name.toLowerCase() === parsed.category.toLowerCase()
      );
      if (existing) {
        categoryId = existing.id;
      } else {
        // Create new category
        const { data: newCat, error: catError } = await supabaseServer
          .from('categories')
          .insert({ name: parsed.category })
          .select('id')
          .single();
        if (!catError && newCat) {
          categoryId = newCat.id;
        }
      }
    }

    // Update note (set AI-generated title only if user hasn't set one)
    const updateFields: Record<string, unknown> = {
      ai_rewrite: parsed.rewrite,
      category_id: categoryId,
      ai_status: 'done',
    };

    // Check if note already has a user-set title
    const { data: current } = await supabaseServer
      .from('notes')
      .select('title')
      .eq('id', noteId)
      .single();

    if (!current?.title || current.title === '') {
      updateFields.title = parsed.title;
    }

    await supabaseServer
      .from('notes')
      .update(updateFields)
      .eq('id', noteId);
  } catch (error) {
    console.error('AI processing error:', error);
    await supabaseServer
      .from('notes')
      .update({ ai_status: 'error' })
      .eq('id', noteId);
  }
}
