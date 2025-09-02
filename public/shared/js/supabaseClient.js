// js/supabaseClient.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Supabase values
const SUPABASE_URL = "https://qhmoqtxpeasamtlxaoak.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFobW9xdHhwZWFzYW10bHhhb2FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5NDcwMzMsImV4cCI6MjA2NjUyMzAzM30._kqoJy382_7rjSbvJY5lI00JYOpiCE2tO9rF9Qrd1WA";

// initialize the client with persistence + auto-refresh
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true, // <- make sure sessions survive reloads
    autoRefreshToken: true, // <- refresh tokens automatically
  },
});
