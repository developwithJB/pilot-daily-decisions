import { calendarConfigReady } from "../../../../lib/calendar-security";
import {
  apiError,
  requireUser,
  unauthorized,
} from "../../../../lib/supabase-server";

async function hash(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (item) =>
    item.toString(16).padStart(2, "0"),
  ).join("");
}
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth) return unauthorized();
  if (!calendarConfigReady())
    return auth.applyCookies(
      apiError(
        "CALENDAR_NOT_CONFIGURED",
        "Google Calendar is not configured.",
        503,
      ),
    );
  const state = crypto.randomUUID() + crypto.randomUUID();
  const stateHash = await hash(state);
  const stored = await auth.supabase.from("calendar_oauth_states").insert({
    state_hash: stateHash,
    user_id: auth.user.id,
    expires_at: new Date(Date.now() + 600000).toISOString(),
  });
  if (stored.error)
    return auth.applyCookies(
      apiError(
        "CALENDAR_CONNECT_FAILED",
        "Calendar connection could not be started.",
        500,
        true,
      ),
    );
  const origin = new URL(request.url).origin;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || `${origin}/api/calendar/callback`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    "https://www.googleapis.com/auth/calendar.readonly",
  );
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return auth.applyCookies(Response.redirect(url));
}
