import { privateResponse, requestSupabase } from "../../../../lib/supabase-server";
export async function POST(request:Request) {
  try { const context=requestSupabase(request); await context.supabase.auth.signOut(); return context.applyCookies(privateResponse({ok:true})); }
  catch { return privateResponse({ok:true}); }
}
