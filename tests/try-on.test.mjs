import assert from "node:assert/strict";
import test from "node:test";
import { recommendations, starterCloset } from "../lib/demo-data.ts";
import { buildMirrorPrompt, buildScenePrompt, calculateOutfitLayout, canTransition, createRequestHash, normalizeCalendarContext, normalizePrivateLocation, resolveGarmentConflict } from "../lib/try-on.ts";

test("outfit layer calculation keeps shoes low and outerwear forward", () => {
  const garments = recommendations[0].garmentIds.map((id) => starterCloset.find((item) => item.id === id));
  const layout = calculateOutfitLayout(garments);
  const shoes = layout.find((item) => item.garment.category === "Shoes");
  const outerwear = layout.find((item) => item.garment.category === "Outerwear");
  assert.ok(shoes.anchorY >= 70);
  assert.ok(outerwear.layer >= 4);
});

test("garment conflict resolution keeps a sensible outfit", () => {
  const top = starterCloset.find((item) => item.id === "g01");
  const bottom = starterCloset.find((item) => item.id === "g04");
  const dress = starterCloset.find((item) => item.id === "g10");
  assert.deepEqual(resolveGarmentConflict([top, bottom], dress).map((item) => item.id), ["g10"]);
  assert.deepEqual(resolveGarmentConflict([dress], top).map((item) => item.id), ["g01"]);
});

test("request hashing is deterministic and context normalization is private", () => {
  const input = { mode: "mirror", lookId: "look-1" };
  assert.equal(createRequestHash(input), createRequestHash(input));
  assert.notEqual(createRequestHash(input), createRequestHash({ ...input, lookId: "look-2" }));
  assert.equal(normalizePrivateLocation("123 Main Street"), "bright residential dressing area");
  assert.equal(normalizeCalendarContext("Dinner at Aba with Maya"), "Dinner");
});

test("server prompt builders retain the core invariants", () => {
  const garments = starterCloset.slice(0, 2);
  const mirror = buildMirrorPrompt(garments, { event: "Office", weather: "Breezy" });
  assert.match(mirror, /Preserve identity/);
  assert.match(mirror, /No body reshaping/);
  assert.match(mirror, /Oatmeal Merino Crew/);
  assert.match(buildScenePrompt("Home at 123 Main Street"), /bright residential dressing area/);
});

test("job state transitions reject accidental regeneration", () => {
  assert.equal(canTransition("queued", "validating"), true);
  assert.equal(canTransition("processing", "completed"), true);
  assert.equal(canTransition("completed", "processing"), false);
});
