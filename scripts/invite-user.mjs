import { createClient } from "@supabase/supabase-js";
const email = process.argv[2];
if (!/^\S+@\S+\.\S+$/.test(email || ""))
  throw new Error("Usage: npm run invite -- person@example.com");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY,
  siteUrl = process.env.PILOT_SITE_URL;
if (!url || !key || !siteUrl)
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and PILOT_SITE_URL are required",
  );
const callback = new URL("/auth/callback", siteUrl);
if (callback.protocol !== "https:" && callback.hostname !== "localhost")
  throw new Error("PILOT_SITE_URL must use HTTPS outside localhost");
const client = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await client.auth.admin.inviteUserByEmail(email, {
  redirectTo: callback.href,
});
if (error) throw error;
process.stdout.write(
  `${JSON.stringify({ invited: true, userId: data.user.id, email: data.user.email })}\n`,
);
