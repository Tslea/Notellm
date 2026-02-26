export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export interface Note {
  id: string;
  content: string;
  ai_rewrite: string | null;
  category_id: string | null;
  pinned: boolean;
  ai_status: 'pending' | 'processing' | 'done' | 'error';
  created_at: string;
  updated_at: string;
  categories?: Category | null;
}
