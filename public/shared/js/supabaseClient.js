// js/supabaseClient.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Supabase configuration - using remote instance
const SUPABASE_URL = "https://qhmoqtxpeasamtlxaoak.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFobW9xdHhwZWFzYW10bHhhb2FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwMzc0MDMsImV4cCI6MjA3NDYxMzQwM30.jCGzy4y_-35wEBfvbRABy56mAjO6dr6Tti-aODiwDs4";

// Initialize the client with standard configuration
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      "x-client-info": "daily-worklog-app@1.0.0",
    },
  },
});

// Enhanced error handler for CORS and network issues (if needed)
export const handleSupabaseError = (error) => {
  if (error && typeof error === "object") {
    const message = error.message || String(error);
    if (message.includes("CORS") || message.includes("Failed to fetch")) {
      console.error(
        "CORS/Network Error: The Supabase instance may need CORS configuration for localhost:3000"
      );
      console.error(
        'To fix: Add "http://localhost:3000" to the Supabase project\'s CORS allowed origins in the dashboard'
      );
      return {
        ...error,
        userMessage:
          "Network connection error. Please check your connection or contact support.",
        isCorsError: true,
      };
    }
  }
  return error;
};
