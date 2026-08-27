import {
  calendarConfigReady,
  decryptCalendarToken,
  normalizeCalendarTitle,
} from "../../../lib/calendar-security";
import {
  apiError,
  privateResponse,
  requireUser,
  unauthorized,
} from "../../../lib/supabase-server";

async function accessToken(encrypted: string) {
  if (!calendarConfigReady()) throw new Error("CALENDAR_NOT_CONFIGURED");
  const refresh = await decryptCalendarToken(
    encrypted,
    process.env.CALENDAR_TOKEN_ENCRYPTION_KEY!,
  );
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("CALENDAR_REFRESH_FAILED");
  return ((await response.json()) as { access_token: string }).access_token;
}

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth) return unauthorized();
  const { data: connection } = await auth.supabase
    .from("calendar_connections")
    .select("encrypted_refresh_token")
    .eq("user_id", auth.user.id)
    .eq("provider", "google")
    .maybeSingle();
  if (!connection?.encrypted_refresh_token)
    return auth.applyCookies(
      privateResponse({
        configured: calendarConfigReady(),
        connected: false,
        mode: "manual",
        events: [],
      }),
    );
  try {
    const token = await accessToken(connection.encrypted_refresh_token);
    const start = new Date(),
      end = new Date(Date.now() + 7 * 86400000);
    const url = new URL(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    );
    url.searchParams.set("timeMin", start.toISOString());
    url.searchParams.set("timeMax", end.toISOString());
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "50");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("CALENDAR_FETCH_FAILED");
    const payload = (await response.json()) as {
      items?: Array<{
        summary?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
      }>;
    };
    const events = (payload.items || []).map((item) => ({
      id: crypto.randomUUID(),
      category: normalizeCalendarTitle(item.summary || "Busy"),
      start: item.start?.dateTime || item.start?.date || "",
      end: item.end?.dateTime || item.end?.date || "",
      placeType: "other",
    }));
    const grouped = new Map<string, typeof events>();
    for (const event of events) {
      const date = event.start.slice(0, 10);
      grouped.set(date, [...(grouped.get(date) || []), event]);
    }
    for (const [date, items] of grouped) {
      const existing = await auth.supabase
        .from("daily_contexts")
        .select("user_confirmed")
        .eq("user_id", auth.user.id)
        .eq("context_date", date)
        .maybeSingle();
      if (existing.data?.user_confirmed) continue;
      const activities = [...new Set(items.map((item) => item.category))];
      const stored = await auth.supabase.from("daily_contexts").upsert(
        {
          user_id: auth.user.id,
          context_date: date,
          source: "calendar",
          day_type: activities.join(" → "),
          activities,
          user_confirmed: false,
        },
        { onConflict: "user_id,context_date" },
      );
      if (stored.error) throw new Error("CALENDAR_CONTEXT_SAVE_FAILED");
    }
    return auth.applyCookies(
      privateResponse({
        configured: true,
        connected: true,
        mode: "live",
        events,
      }),
    );
  } catch {
    return auth.applyCookies(
      apiError(
        "CALENDAR_REFRESH_FAILED",
        "Calendar is connected but could not be refreshed.",
        502,
        true,
      ),
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth) return unauthorized();
  const body = (await request.json().catch(() => ({}))) as {
    date?: string;
    dayType?: string;
    activities?: string[];
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date || "") || !body.dayType)
    return apiError(
      "CALENDAR_OVERRIDE_INVALID",
      "Choose a date and day type.",
      400,
    );
  const allowed = new Set([
    "Office",
    "WFH",
    "Dinner",
    "Date",
    "Wedding",
    "Event",
    "Travel",
    "Workout",
    "Errands",
    "Casual",
  ]);
  const activities = (body.activities || [body.dayType])
    .filter((item) => allowed.has(item))
    .slice(0, 8);
  const result = await auth.supabase
    .from("daily_contexts")
    .upsert(
      {
        user_id: auth.user.id,
        context_date: body.date,
        source: "manual",
        day_type: String(body.dayType).slice(0, 100),
        activities,
        user_confirmed: true,
      },
      { onConflict: "user_id,context_date" },
    )
    .select()
    .single();
  return auth.applyCookies(
    result.error
      ? apiError(
          "CALENDAR_OVERRIDE_FAILED",
          "The day could not be updated.",
          500,
          true,
        )
      : privateResponse({ context: result.data }),
  );
}

export async function DELETE(request: Request) {
  const auth = await requireUser(request);
  if (!auth) return unauthorized();
  const result = await auth.supabase
    .from("calendar_connections")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("provider", "google");
  return auth.applyCookies(
    result.error
      ? apiError(
          "CALENDAR_DISCONNECT_FAILED",
          "Calendar could not be disconnected.",
          500,
          true,
        )
      : privateResponse({ ok: true }),
  );
}
