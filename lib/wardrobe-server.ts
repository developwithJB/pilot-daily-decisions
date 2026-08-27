import { env } from "cloudflare:workers";

export type LearningSummary = {
  totalScans: number;
  photosScanned: number;
  itemsConfirmed: number;
  itemsRejected: number;
  itemsMerged: number;
  categoryCounts: Record<string, number>;
  colorCounts: Record<string, number>;
  updatedAt?: string;
};

export const emptyLearning = (): LearningSummary => ({
  totalScans: 0,
  photosScanned: 0,
  itemsConfirmed: 0,
  itemsRejected: 0,
  itemsMerged: 0,
  categoryCounts: {},
  colorCounts: {},
});

export function getWardrobeBucket() {
  const bindings = env as unknown as { WARDROBE_IMAGES?: R2Bucket };
  if (!bindings.WARDROBE_IMAGES) throw new Error("R2 binding `WARDROBE_IMAGES` is unavailable");
  return bindings.WARDROBE_IMAGES;
}

export function userIdFor(request: Request) {
  const userId = request.headers.get("oai-authenticated-user-id");
  if (userId) return userId;
  const host = new URL(request.url).hostname;
  return host === "localhost" || host === "127.0.0.1" ? "local-preview-user" : null;
}

export async function userNamespace(userId: string) {
  const bytes = new TextEncoder().encode(userId);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).slice(0, 12).map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function safeJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}
