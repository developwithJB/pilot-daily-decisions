import { requestSupabase } from "../../../lib/supabase-server";
export async function GET(request:Request) {
  const url=new URL(request.url); const code=url.searchParams.get("code");
  if (!code) return Response.redirect(new URL("/?auth=invalid",url));
  try {
    const context=requestSupabase(request); const { error }=await context.supabase.auth.exchangeCodeForSession(code);
    if (error) return Response.redirect(new URL("/?auth=expired",url));
    return context.applyCookies(Response.redirect(new URL("/?auth=connected",url)));
  } catch { return Response.redirect(new URL("/?auth=setup",url)); }
}
