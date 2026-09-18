import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error('VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY devono essere impostate (vedi .env.example).');
}

export const supabase = createClient(url, publishableKey);
