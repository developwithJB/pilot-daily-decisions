import { apiError, privateResponse, requestSupabase } from "../../../../lib/supabase-server";

export async function POST(request:Request) {
  const body = await request.json().catch(()=>({})) as { email?:string };
  const email=String(body.email||"").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return apiError("EMAIL_INVALID","Enter a valid invited email.",400);
  let context;
  try { context=requestSupabase(request); } catch { return apiError("AUTH_NOT_CONFIGURED","Invited sign-in is not configured for this deployment.",503); }
  const { error } = await context.supabase.auth.signInWithOtp({ email, options:{ shouldCreateUser:false, emailRedirectTo:`${new URL(request.url).origin}/auth/callback` } });
  if (error) return apiError("INVITE_REQUIRED","This email has not been invited yet.",403);
  return context.applyCookies(privateResponse({ ok:true, message:"Check your email for the private sign-in link." }));
}
