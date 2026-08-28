import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseIcsSignals } from "../lib/calendar-ics.ts";
import { IcsCalendarProvider } from "../lib/providers/calendar-provider.ts";
import { getStarterWardrobe } from "../lib/starter-wardrobes.ts";
import { ManualWeatherProvider, normalizeOpenMeteo } from "../lib/providers/weather-provider.ts";
import { DemoAvatar3DProvider, DisabledAvatar3DProvider, getAvatar3DProvider } from "../lib/providers/avatar-3d-provider.ts";

test("manual weather is normalized, bounded, and explicitly marked manual", async () => {
  const result = await new ManualWeatherProvider().getForecast({ city: "Chicago", manual: { currentTemperature: 64.4, rainProbability: 140, windMph: -2 } });
  assert.equal(result.meta.mode, "manual");
  assert.equal(result.data.currentTemperature, 64);
  assert.equal(result.data.rainProbability, 100);
  assert.equal(result.data.windMph, 0);
  assert.match(result.warnings[0], /only as current/i);
});

test("Open-Meteo payload is normalized into the versioned weather context", () => {
  const now = new Date("2026-08-27T12:00:00Z");
  const times = Array.from({ length: 24 }, (_, index) => new Date(now.getTime() + index * 3600000).toISOString());
  const result = normalizeOpenMeteo({
    timezone: "UTC",
    current: { temperature_2m: 60.4, apparent_temperature: 58.6, relative_humidity_2m: 55, precipitation_probability: 10, weather_code: 2, wind_speed_10m: 17 },
    hourly: { time: times, temperature_2m: times.map((_, i) => 60 + i), apparent_temperature: times.map((_, i) => 59 + i), precipitation_probability: times.map((_, i) => i === 4 ? 70 : 10) },
    daily: { temperature_2m_max: [81] },
  }, "Chicago", now);
  assert.equal(result.meta.provider, "open-meteo");
  assert.equal(result.data.currentTemperature, 60);
  assert.ok(result.data.weatherFlags.includes("possible_rain"));
  assert.ok(result.data.weatherFlags.includes("breezy"));
  assert.equal(result.data.hours.length, 4);
});

test("ICS import retains broad schedule signals but discards private fields", () => {
  const events = parseIcsSignals(`BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260827T150000Z\nDTEND:20260827T160000Z\nSUMMARY:Client presentation at Secret Co\nDESCRIPTION:Do not retain this\nLOCATION:123 Private Street\nATTENDEE:mailto:person@example.com\nEND:VEVENT\nEND:VCALENDAR`);
  assert.deepEqual(events, [{ id: "ics-1-2026-08-27", category: "Office", start: "2026-08-27T15:00:00Z", end: "2026-08-27T16:00:00Z", placeType: "other" }]);
  assert.doesNotMatch(JSON.stringify(events), /Secret Co|Private Street|person@example|Do not retain/);
});

test("ICS calendar provider filters normalized signals to the requested window", async () => {
  const provider = new IcsCalendarProvider(`BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260827T150000Z\nSUMMARY:Dinner with a friend\nEND:VEVENT\nBEGIN:VEVENT\nDTSTART:20260927T150000Z\nSUMMARY:Future trip\nEND:VEVENT\nEND:VCALENDAR`);
  const result = await provider.listSignals({ from: new Date("2026-08-27T00:00:00Z"), to: new Date("2026-08-28T00:00:00Z") });
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].category, "Dinner");
  assert.equal(result.meta.provider, "ics-local");
});

test("starter wardrobe choices are labeled samples and never owned inventory", () => {
  assert.deepEqual(getStarterWardrobe("empty"), []);
  for (const choice of ["menswear", "womenswear", "neutral"]) {
    const items = getStarterWardrobe(choice);
    assert.equal(items.length, 8);
    assert.ok(items.every((item) => item.inventoryType === "sample" && item.brand === "Example wardrobe"));
  }
});

test("3D provider defaults disabled outside demo and returns only a local generic fixture in demo", async () => {
  assert.ok(getAvatar3DProvider({}) instanceof DisabledAvatar3DProvider);
  assert.ok(getAvatar3DProvider({ DEMO_MODE: "true" }) instanceof DemoAvatar3DProvider);
  const result = await new DemoAvatar3DProvider().createAvatar();
  assert.equal(result.data.generatedFrom, "demo-fixture");
  assert.match(result.data.privateAssetPath, /^\/assets\/avatar\//);
  assert.match(result.warnings[0], /not generated from your body/i);
});

test("onboarding and avatar routes render complete accessible product states", async () => {
  const [onboarding, viewer, migration] = await Promise.all([
    readFile(new URL("../app/ProfessionalOnboarding.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/Avatar3DViewer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/0005_professional_product_foundation.sql", import.meta.url), "utf8"),
  ]);
  assert.match(onboarding, /Weather[\s\S]*Calendar[\s\S]*Add yourself[\s\S]*Build closet[\s\S]*Ready/);
  assert.match(onboarding, /processPhoto/);
  assert.match(onboarding, /parseIcsSignals/);
  assert.match(viewer, /GLTFLoader/);
  assert.match(viewer, /front[\s\S]*side[\s\S]*back/);
  assert.match(migration, /enable row level security/g);
  assert.match(migration, /public=false/);
  assert.doesNotMatch(migration, /to anon/);
});
