import { supabaseServer } from './supabase-server';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Fallback chain: fast → medium → cheap
const MODELS = [
  'openai/gpt-4o-mini',
  'mistral/mistral-small-3.1-24b-instruct',
  'google/gemini-2.0-flash-lite-001',
];
const TIMEOUT_MS = 15_000; // 15s per model attempt

interface AIResponse {
  rewrite: string;
  category: string;
}

async function callOpenRouter(
  model: string,
  prompt: string
): Promise<AIResponse> {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
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

    const prompt = `You are a note assistant. You receive a raw note and a list of existing categories.

Your tasks:
1. REWRITE the note: improve clarity, fix grammar, organize structure. Keep the same language as the original. Keep it concise. Use markdown formatting if helpful.
2. CATEGORIZE: assign the most fitting category from the existing list. Only create a NEW category if none of the existing ones are a reasonable fit. Category names should be short (1-3 words).

Existing categories: ${categoriesList}

Raw note:
"""
${note.content}
"""

Respond ONLY with valid JSON, no markdown fences:
{
  "rewrite": "...",
  "category": "..."
}`;

    // Try each model in order until one succeeds
    let parsed: AIResponse | null = null;
    let lastError: Error | null = null;

    for (const model of MODELS) {
      try {
        parsed = await callOpenRouter(model, prompt);
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

    // Update note
    await supabaseServer
      .from('notes')
      .update({
        ai_rewrite: parsed.rewrite,
        category_id: categoryId,
        ai_status: 'done',
      })
      .eq('id', noteId);
  } catch (error) {
    console.error('AI processing error:', error);
    await supabaseServer
      .from('notes')
      .update({ ai_status: 'error' })
      .eq('id', noteId);
  }
}
