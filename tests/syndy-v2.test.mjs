import assert from "node:assert/strict";
import test from "node:test";
import {
  todaySignals,
  suggestStudioLook,
  readGoogleCalendar,
} from "../examples/syndy-v2/src/daily-context.ts";
import { normalizeOpenMeteo } from "../lib/providers/weather-provider.ts";
import { GET as calendarRoute } from "../app/api/calendar/route.ts";

const event = (start, end, category = "Dinner") => ({
  id: "sample",
  category,
  start,
  end,
  placeType: "other",
});
test("studio agenda respects local days, overnight events, and exclusive all-day ends", () => {
  const now = new Date("2026-09-09T04:30:00Z"); // September 8 in Chicago
  const events = [
    event("2026-09-09T01:00:00Z", "2026-09-09T02:00:00Z"),
    event("2026-09-08", "2026-09-09", "Wedding"),
    event("2026-09-09", "2026-09-10", "Office"),
    event("2026-09-08T23:00:00Z", "2026-09-09T08:00:00Z", "Travel"),
    event("bad", "bad"),
  ];
  assert.deepEqual(
    todaySignals(events, now, "America/Chicago").map((e) => e.category),
    ["Dinner", "Wedding", "Travel"],
  );
  assert.equal(
    todaySignals(
      [event("2026-09-08", "2026-09-09")],
      new Date("2026-09-09T18:00:00Z"),
      "America/Chicago",
    ).length,
    0,
  );
});
test("weather and plans both affect the proposed sample look", () => {
  const mild = {
    currentFeelsLike: 74,
    eveningFeelsLike: 70,
    rainProbability: 0,
  };
  assert.equal(suggestStudioLook(mild, ["Dinner"]).outfit, "evening");
  assert.equal(suggestStudioLook(mild, ["Office"]).outfit, "tailored");
  const wet = suggestStudioLook({ ...mild, rainProbability: 70 }, ["Dinner"]);
  assert.equal(wet.outfit, "tailored");
  assert.match(wet.warnings.join(" "), /weather-ready footwear/);
  assert.equal(
    suggestStudioLook({ ...mild, eveningFeelsLike: 42 }, ["Dinner"]).outfit,
    "tailored",
  );
  assert.ok(suggestStudioLook(null, ["Workout"]).warnings.length);
});
test("Google sync uses the existing authenticated API and retains only minimized signals", async () => {
  const result = await readGoogleCalendar(async (url, init) => {
    assert.equal(url, "/api/calendar");
    assert.equal(init.credentials, "same-origin");
    assert.equal(init.cache, "no-store");
    return Response.json({
      connected: true,
      events: [
        {
          ...event("2026-09-09", "2026-09-10"),
          summary: "PRIVATE TITLE",
          attendees: ["private@example.com"],
        },
        null,
      ],
    });
  });
  assert.equal(result.connected, true);
  assert.equal(result.events.length, 1);
  assert.doesNotMatch(
    JSON.stringify(result),
    /PRIVATE|attendees|private@example/,
  );
  await assert.rejects(
    readGoogleCalendar(async () => new Response("", { status: 401 })),
    /Sign in/,
  );
  await assert.rejects(
    readGoogleCalendar(async () => new Response("", { status: 502 })),
    /unavailable/,
  );
  const disconnected = await readGoogleCalendar(async () =>
    Response.json({ configured: false, connected: false }),
  );
  assert.equal(disconnected.connected, false);
  assert.deepEqual(disconnected.events, []);
});
test("calendar server does not expose events without a signed-in user", async () => {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return; // Never touch a configured external project in this unit test.
  assert.equal(
    (await calendarRoute(new Request("http://localhost/api/calendar"))).status,
    401,
  );
});
test("Open-Meteo Unix timestamps render in the requested city timezone", () => {
  const now = new Date("2026-09-08T20:00:00Z");
  const times = Array.from(
    { length: 24 },
    (_, i) => now.getTime() / 1000 + i * 3600,
  );
  const data = normalizeOpenMeteo(
    {
      timezone: "America/Chicago",
      current: {
        temperature_2m: 70,
        apparent_temperature: 70,
        relative_humidity_2m: 50,
        precipitation_probability: 0,
        weather_code: 0,
        wind_speed_10m: 5,
      },
      hourly: {
        time: times,
        temperature_2m: times.map(() => 70),
        apparent_temperature: times.map((_, i) => 60 + i),
        precipitation_probability: times.map(() => 0),
      },
      daily: { temperature_2m_max: [75] },
    },
    "Chicago",
    now,
  ).data;
  assert.equal(data.hours[0].time, "3 PM");
  assert.equal(data.eveningFeelsLike, 63);
});
