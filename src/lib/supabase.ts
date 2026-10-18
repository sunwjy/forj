import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type SupabaseEnv = {
  url: string | undefined;
  publishableKey: string | undefined;
};

/**
 * Builds a client that talks to Supabase with the publishable key only.
 * The browser and `generateMetadata` reach data through `public` RPCs; no
 * secret key exists in this app (spec 4, 9.5).
 */
export function createSupabaseClient({ url, publishableKey }: SupabaseEnv): SupabaseClient {
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!publishableKey) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set");
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let client: SupabaseClient | undefined;

/** The shared client, configured from `NEXT_PUBLIC_*` variables. */
export function getSupabase(): SupabaseClient {
  // Each variable is read by its full name so Next.js inlines it into the bundle.
  client ??= createSupabaseClient({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return client;
}
