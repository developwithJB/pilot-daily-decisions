import type {
  CalendarSignalV1,
  WeatherContextV1,
} from "../../../lib/providers/contracts";

export const dateInZone = (date: Date, timezone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
export function todaySignals(
  events: CalendarSignalV1[],
  now: Date,
  timezone: string,
) {
  const today = dateInZone(now, timezone);
  return events.filter((event) => {
    // Calendar all-day DTEND is exclusive; don't convert a date-only value to UTC.
    if (/^\d{4}-\d{2}-\d{2}$/.test(event.start))
      return (
        event.start <= today &&
        (event.end > event.start ? today < event.end : today === event.start)
      );
    const start = new Date(event.start),
      end = new Date(event.end);
    return (
      Number.isFinite(start.getTime()) &&
      dateInZone(start, timezone) <= today &&
      dateInZone(
        Number.isFinite(end.getTime()) && end > start
          ? new Date(end.getTime() - 1)
          : start,
        timezone,
      ) >= today
    );
  });
}
export function suggestStudioLook(
  weather: WeatherContextV1 | null,
  activities: string[],
) {
  const formal = activities.some((a) =>
    ["Dinner", "Date", "Wedding", "Event"].includes(a),
  );
  const cold =
    weather !== null &&
    Math.min(weather.currentFeelsLike, weather.eveningFeelsLike) < 62;
  const wet = weather !== null && weather.rainProbability >= 40;
  const warnings = [
    cold && "Bring a warm layer.",
    wet && "Rain is possible: choose weather-ready footwear.",
    activities.includes("Workout") && "Neither sample look is workout gear.",
  ].filter(Boolean) as string[];
  return {
    outfit: formal && !cold && !wet ? "evening" : "tailored",
    reason: formal
      ? cold || wet
        ? "Layers are the more practical sample for your plans and forecast."
        : "The evening sample suits your occasion."
      : "The layered sample is a starting point for your day.",
    warnings,
  };
}

export const planCategories = [
  "Casual",
  "Office",
  "WFH",
  "Dinner",
  "Date",
  "Wedding",
  "Event",
  "Travel",
  "Workout",
  "Errands",
];
export async function readGoogleCalendar(fetcher: typeof fetch = fetch) {
  const response = await fetcher("/api/calendar", {
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "Sign in to Pilot, connect Google, then refresh."
        : "Calendar unavailable. Check the Pilot backend and refresh.",
    );
  const body = (await response.json()) as {
    connected?: boolean;
    configured?: boolean;
    events?: unknown;
  };
  if (!body || typeof body !== "object")
    throw new Error("Unexpected calendar response.");
  if (!body.connected)
    return {
      connected: false,
      configured: Boolean(body.configured),
      events: [] as CalendarSignalV1[],
    };
  if (!Array.isArray(body.events))
    throw new Error("Unexpected calendar response. Check the Pilot backend.");
  const events: CalendarSignalV1[] = body.events
    .filter(
      (e) =>
        e &&
        planCategories.includes(e.category) &&
        typeof e.start === "string" &&
        typeof e.end === "string",
    )
    .map((e) => ({
      id: typeof e.id === "string" ? e.id : crypto.randomUUID(),
      category: e.category,
      start: e.start,
      end: e.end,
      placeType: "other",
    }));
  return { connected: true, configured: true, events };
}
