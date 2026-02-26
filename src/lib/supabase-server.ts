import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabaseServer: SupabaseClient | null = null;

export function getSupabaseServer(): SupabaseClient {
  if (!_supabaseServer) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
    _supabaseServer = createClient(supabaseUrl, supabaseServiceKey);
  }
  return _supabaseServer;
}

// Keep backward-compatible export as a getter
export const supabaseServer = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol) {
    const client = getSupabaseServer();
    return client[prop as keyof SupabaseClient];
  },
});
