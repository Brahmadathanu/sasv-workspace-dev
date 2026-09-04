/* eslint-env node */

const { createClient } = require("@supabase/supabase-js");
const { ERROR_KINDS, workerError } = require("./errors");

const SUPABASE_URL = "https://qhmoqtxpeasamtlxaoak.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFobW9xdHhwZWFzYW10bHhhb2FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwMzc0MDMsImV4cCI6MjA3NDYxMzQwM30.jCGzy4y_-35wEBfvbRABy56mAjO6dr6Tti-aODiwDs4";

function createUserScopedClient(accessToken) {
  const token = String(accessToken || "").trim();
  if (!token) {
    throw workerError(ERROR_KINDS.AUTHORIZATION, "A session token is required.");
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
    },
  });
}

async function callWorkerRpc(accessToken, name, args) {
  const client = createUserScopedClient(accessToken);
  try {
    const { data, error } = await client.rpc(name, args);
    if (error) throw error;
    return data;
  } finally {
    try {
      await client.removeAllChannels();
    } catch {
      // memory-only client; ignore
    }
  }
}

module.exports = {
  SUPABASE_URL,
  createUserScopedClient,
  callWorkerRpc,
};
