import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { SUPABASE_PROJECT_ID } from "@/lib/appConfig";

// NOTE: This proxy exists to keep the app working even if the preview/build
// environment fails to inject VITE_* variables temporarily.

const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const envProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;

const projectId = envProjectId || SUPABASE_PROJECT_ID;

const SUPABASE_URL = (envUrl && envUrl.trim()) || (projectId ? `https://${projectId}.supabase.co` : "");

// Publishable (anon) key fallback. This is NOT a secret.
const SUPABASE_PUBLISHABLE_KEY = (envKey && envKey.trim()) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVyYXp1bmF6aGhyaGFzYWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NjQyNzMsImV4cCI6MjA3OTM0MDI3M30.9pSbWiSKOwO5YkoRwtE2-pgjtxXSBhD59RwxA1fYsMY";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
