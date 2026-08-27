import type { Garment } from "./demo-data";

export type GarmentLayout = { anchorX: number; anchorY: number; scale: number; rotation: number; layer: number };
export type JobStatus = "queued" | "validating" | "processing" | "completed" | "failed" | "cancelled";

const categoryLayout: Record<Garment["category"], GarmentLayout> = {
  Tops: { anchorX: 35, anchorY: 15, scale: 0.47, rotation: -3, layer: 3 },
  Bottoms: { anchorX: 45, anchorY: 34, scale: 0.49, rotation: 2, layer: 2 },
  Dresses: { anchorX: 30, anchorY: 9, scale: 0.62, rotation: -1, layer: 3 },
  Outerwear: { anchorX: 7, anchorY: 10, scale: 0.58, rotation: -7, layer: 4 },
  Shoes: { anchorX: 52, anchorY: 75, scale: 0.34, rotation: 4, layer: 5 },
};

export function calculateOutfitLayout(garments: Garment[]): Array<GarmentLayout & { garment: Garment }> {
  return garments.map((garment, index) => {
    const base = categoryLayout[garment.category];
    const same = garments.slice(0, index).filter((item) => item.category === garment.category).length;
    return { garment, ...base, anchorX: base.anchorX + same * 10, anchorY: base.anchorY + same * 5, rotation: base.rotation + same * 5, layer: base.layer + same };
  });
}

export function resolveGarmentConflict(selected: Garment[], next: Garment): Garment[] {
  let result = selected.filter((item) => item.category !== next.category);
  if (next.category === "Dresses") result = result.filter((item) => item.category !== "Tops" && item.category !== "Bottoms");
  if (next.category === "Tops" || next.category === "Bottoms") result = result.filter((item) => item.category !== "Dresses");
  return [...result, next];
}

export function normalizePrivateLocation(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (/\d{2,}.*(street|st\.?|avenue|ave\.?|road|rd\.?|drive|dr\.?|boulevard|blvd|lane|ln\.?)/i.test(value) || normalized.includes("home")) return "bright residential dressing area";
  if (normalized.includes("office") || normalized.includes("salesforce")) return "modern city office";
  if (normalized.includes("dinner") || normalized.includes("restaurant") || normalized.includes("aba")) return "warm contemporary restaurant";
  return value.trim().slice(0, 80) || "neutral studio";
}

export function normalizeCalendarContext(title: string): string {
  const value = title.toLowerCase();
  if (value.includes("dinner")) return "Dinner";
  if (value.includes("office") || value.includes("work")) return "Office";
  if (value.includes("flight") || value.includes("airport")) return "Travel";
  return "Personal plans";
}

export function createRequestHash(input: unknown): string {
  const source = JSON.stringify(input, Object.keys(input as Record<string, unknown>).sort());
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
  return `v2-${(hash >>> 0).toString(16)}`;
}

export function buildMirrorPrompt(garments: Garment[], context: { event: string; weather: string }): string {
  const selected = garments.map((item) => `${item.name}, ${item.category}, ${item.color}`).join("; ");
  return `Create a photorealistic virtual outfit preview. Preserve identity, face, hair, skin tone, body proportions, pose, hands, camera angle, lighting, and background. Replace only visible clothing with: ${selected}. Preserve exact colors and garment details. Context: ${context.event}; ${context.weather}. No body reshaping, retouching, added items, text, watermark, or extra people.`;
}

export function buildScenePrompt(scene: string): string {
  return `Place the approved Mirror result in ${normalizePrivateLocation(scene)}. Preserve the person, identity, face, hair, body proportions, outfit, colors, garment shapes, shoes, accessories, and styling exactly. Change only the background and environmental lighting. No added garments, strangers, text, watermark, or prominent branding.`;
}

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  const allowed: Record<JobStatus, JobStatus[]> = { queued: ["validating", "cancelled"], validating: ["processing", "failed", "cancelled"], processing: ["completed", "failed", "cancelled"], completed: [], failed: ["queued"], cancelled: ["queued"] };
  return allowed[from].includes(to);
}
