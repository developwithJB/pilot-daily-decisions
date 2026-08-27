import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { wardrobeItems } from "../../../../../db/schema";
import { getWardrobeBucket, userIdFor } from "../../../../../lib/wardrobe-server";

export async function GET(request: Request, context: { params: Promise<{ id:string }> }) {
  const userId = userIdFor(request);
  if (!userId) return new Response("Unauthorized", { status:401 });
  const { id } = await context.params;
  const rows = await getDb().select({ imageKey:wardrobeItems.imageKey }).from(wardrobeItems).where(and(eq(wardrobeItems.id, id), eq(wardrobeItems.userId, userId), eq(wardrobeItems.active, true))).limit(1);
  if (!rows[0]) return new Response("Not found", { status:404 });
  const object = await getWardrobeBucket().get(rows[0].imageKey);
  if (!object) return new Response("Not found", { status:404 });
  return new Response(object.body, { headers:{ "content-type":object.httpMetadata?.contentType || "image/webp", "cache-control":"private, max-age=3600", "x-content-type-options":"nosniff" } });
}
