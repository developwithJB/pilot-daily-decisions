import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/", init) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html", "content-type": "application/json" }, ...init }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the complete V2 Today experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>pilot: life’s daily decisions on autopilot<\/title>/i);
  assert.match(html, /Good (morning|afternoon|evening), Sydney/);
  assert.match(html, /Office → Dinner/);
  assert.match(html, /Best match/);
  assert.match(html, /Try it on/);
  assert.match(html, /Customize/);
  assert.match(html, /Wear today/);
  assert.match(html, /Share pilot/);
  assert.match(html, /Your wardrobe, decided/);
  assert.match(html, /Your second brain is working/);
  assert.match(html, /Weather \+ Calendar \+ closet \+ location \+ preferences/);
  assert.match(html, /Make pilot mine/);
  assert.match(html, /Manual day/);
  assert.match(html, /Updating live weather/);
  assert.match(html, />Try On</);
  assert.match(html, />Closet</);
  assert.doesNotMatch(html, /Tuesday, August 25|Leave for Salesforce|Dinner · Aba|Presentation day/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("server-renders each V2 route without dead ends", async () => {
  for (const [path, text] of [["/week", "This Week"], ["/try-on", "Dressing Room"], ["/closet", "Your Closet"], ["/history", "History"], ["/settings/model", "Make pilot yours"]]) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), new RegExp(text), path);
  }
});

test("high-value screens ship clear, task-specific CTAs", async () => {
  const [week, closet, history, setup] = await Promise.all([
    render("/week").then((response) => response.text()),
    render("/closet").then((response) => response.text()),
    render("/history").then((response) => response.text()),
    render("/settings/model").then((response) => response.text()),
  ]);
  assert.match(week, /Your week, already dressed/);
  assert.match(closet, /Scan outfit &amp; shopping photos/);
  assert.match(closet, /Scan photos/);
  assert.match(history, /Update feedback for/);
  assert.match(setup, /Save &amp; see today’s look/);
});

test("private try-on API requires an authenticated invite", async () => {
  const response = await render("/api/try-on", { method: "POST", body: JSON.stringify({ mode: "mirror", lookId: "look-1" }) });
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.error.code, "AUTH_REQUIRED");
});

test("try-on rejects client-supplied image URLs before provider work", async () => {
  const response = await render("/api/try-on", { method: "POST", body: JSON.stringify({ garmentIds:["owned"], personImageUrl:"http://127.0.0.1/private" }) });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "CLIENT_URL_REJECTED");
});

test("Calendar context is private and requires an authenticated invite", async () => {
  const response = await render("/api/calendar");
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.error.code, "AUTH_REQUIRED");
  assert.match(response.headers.get("cache-control") || "", /no-store/);
});

test("wardrobe scan requires an authenticated owner", async () => {
  const response = await render("/api/wardrobe/scan", { method:"POST", body:JSON.stringify({ image:"data:image/jpeg;base64,AA==", photoIndex:1, dominantColor:"Navy" }) });
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.error.code, "AUTH_REQUIRED");
});

test("wardrobe scan ships private lightweight storage and a correction loop", async () => {
  const [scanner, schema, hosting, commitRoute] = await Promise.all([
    readFile(new URL("../app/WardrobeScanner.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../app/api/wardrobe/commit/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(scanner, /maxEdge = 1600/);
  assert.match(scanner, /canvas\.width = 512/);
  assert.match(scanner, /Adjust crop/);
  assert.match(scanner, /Scan more photos/);
  assert.match(scanner, /possibleDuplicate/);
  assert.match(schema, /wardrobe_items_user_fingerprint_idx/);
  assert.match(schema, /wardrobe_learning/);
  assert.match(hosting, /WARDROBE_IMAGES/);
  assert.match(commitRoute, /THUMBNAIL_TOO_LARGE/);
  assert.match(commitRoute, /itemsMerged/);
});

test("ships local assets, portable second-brain setup, privacy schema, and provider boundaries", async () => {
  const [data, migration, provider, layout, packageJson, weatherRoute, appSource] = await Promise.all([
    readFile(new URL("../lib/demo-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/0002_v2_dressing_room.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/providers/try-on-provider.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/api/weather/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/SydneyApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.equal((data.match(/item\(\s*"g\d{2}"/g) || []).length, 22);
  assert.doesNotMatch(data, /https?:\/\//);
  assert.match(migration, /person_reference_photos/);
  assert.match(migration, /try_on_results/);
  assert.match(migration, /enable row level security/g);
  assert.match(migration, /auth\.uid\(\) = user_id/g);
  assert.match(provider, /interface TryOnProvider/);
  assert.match(provider, /gpt-image-2/);
  assert.match(layout, /pilot: life’s daily decisions on autopilot/);
  assert.match(packageJson, /"name": "pilot-daily-decisions"/);
  assert.match(weatherRoute, /api\.weather\.gov/);
  assert.match(weatherRoute, /source:"unavailable"/);
  assert.doesNotMatch(weatherRoute, /demoWeather|departureFeelsLike: 61|dayHigh: 68/);
  assert.match(appSource, /pilot-profile-v1/);
  assert.match(appSource, /Export my Pilot Pack/);
  assert.match(appSource, /Import a Pilot Pack/);
  assert.match(appSource, /navigator\.geolocation/);
  assert.match(appSource, /Weather \+ Calendar \+ closet \+ location \+ preferences/);
  await access(new URL("../public/assets/garments/cobalt-draped-midi.webp", import.meta.url));
  await access(new URL("../public/assets/garments/bronze-strappy-sandal.webp", import.meta.url));
  await access(new URL("../public/assets/garments/black-pointed-stiletto.webp", import.meta.url));
  await access(new URL("../public/assets/garments/ivory-bow-blouse.webp", import.meta.url));
  await access(new URL("../public/assets/garments/blush-pleated-midi-skirt.webp", import.meta.url));
  await access(new URL("../public/assets/garments/berry-slingback-pump.webp", import.meta.url));
  await access(new URL("../docs/V2_IMPLEMENTATION_PLAN.md", import.meta.url));
});
