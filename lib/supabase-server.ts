import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

type PendingCookie = { name:string; value:string; options:CookieOptions };

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

export function isSupabaseConfigured() { return Boolean(config()); }

function parseCookies(request:Request) {
  return (request.headers.get("cookie") || "").split(";").flatMap((part) => {
    const index = part.indexOf("=");
    if (index < 1) return [];
    return [{ name:part.slice(0,index).trim(), value:decodeURIComponent(part.slice(index+1)) }];
  });
}

function serializeCookie(cookie:PendingCookie) {
  const options = cookie.options || {};
  const pieces = [`${cookie.name}=${encodeURIComponent(cookie.value)}`, `Path=${options.path || "/"}`];
  if (options.maxAge !== undefined) pieces.push(`Max-Age=${options.maxAge}`);
  if (options.expires) pieces.push(`Expires=${options.expires.toUTCString()}`);
  if (options.httpOnly) pieces.push("HttpOnly");
  if (options.secure !== false) pieces.push("Secure");
  if (options.sameSite) pieces.push(`SameSite=${typeof options.sameSite === "string" ? options.sameSite : "Lax"}`);
  return pieces.join("; ");
}

export function requestSupabase(request:Request) {
  const configured = config();
  if (!configured) throw new Error("SUPABASE_NOT_CONFIGURED");
  const pending:PendingCookie[] = [];
  const supabase = createServerClient(configured.url, configured.key, {
    auth:{ flowType:"pkce" },
    cookies:{
      getAll:() => parseCookies(request),
      setAll:(cookies) => { pending.push(...cookies); },
    },
  });
  return {
    supabase,
    applyCookies(response:Response) {
      if (!pending.length) return response;
      const headers = new Headers(response.headers);
      pending.forEach((cookie) => headers.append("Set-Cookie", serializeCookie(cookie)));
      return new Response(response.body, { status:response.status, statusText:response.statusText, headers });
    },
  };
}

export type AuthContext = { supabase:SupabaseClient; user:User; applyCookies:(response:Response)=>Response };

export async function requireUser(request:Request):Promise<AuthContext | null> {
  if (!isSupabaseConfigured()) return null;
  const context = requestSupabase(request);
  const { data, error } = await context.supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase:context.supabase, user:data.user, applyCookies:context.applyCookies };
}

export function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");
  return createClient(url, serviceKey, { auth:{ persistSession:false, autoRefreshToken:false } });
}

export function privateResponse(body:unknown, init:ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "private, no-store");
  return Response.json(body, { ...init, headers });
}

export function apiError(code:string, message:string, status=400, retryable=false) {
  return privateResponse({ error:{ code, message, retryable } }, { status });
}

export function unauthorized() { return apiError("AUTH_REQUIRED", "Sign in with your invited email to continue.", 401); }
