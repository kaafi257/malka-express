import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** False until both environment variables are set (the app then shows a setup screen). */
export const supabaseReady = Boolean(url && key);

// Placeholder values keep the client constructible when unconfigured; nothing calls it in that state.
export const supabase = createClient(url ?? 'http://localhost', key ?? 'not-configured', {
  auth: { persistSession: true, autoRefreshToken: true },
});

export const DRIVER_EMAIL_DOMAIN =
  (import.meta.env.VITE_DRIVER_EMAIL_DOMAIN as string | undefined) || 'drivers.malkaexpress.app';

export const DOCUMENTS_BUCKET = 'order-documents';
