import {
  adminSupabase,
  apiError,
  privateResponse,
} from "../../../../lib/supabase-server";

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (
    !expected ||
    request.headers.get("authorization") !== `Bearer ${expected}`
  )
    return apiError(
      "MAINTENANCE_UNAUTHORIZED",
      "Maintenance authorization is required.",
      401,
    );
  try {
    const admin = adminSupabase();
    const now = new Date().toISOString();
    const [shopping, results] = await Promise.all([
      admin
        .from("shopping_analyses")
        .select("id,screenshot_path,thumbnail_path")
        .eq("saved", false)
        .lt("expires_at", now)
        .limit(1000),
      admin
        .from("try_on_results")
        .select("id,image_path,thumbnail_path")
        .eq("saved", false)
        .lt("expires_at", now)
        .limit(1000),
    ]);
    if (shopping.error || results.error)
      throw new Error("RETENTION_READ_FAILED");
    const shoppingPaths = (shopping.data || []).flatMap((row) =>
      [row.screenshot_path, row.thumbnail_path].filter(Boolean),
    );
    const resultPaths = (results.data || []).flatMap((row) =>
      [row.image_path, row.thumbnail_path].filter(Boolean),
    );
    if (shoppingPaths.length) {
      const removed = await admin.storage
        .from("shopping-screenshots")
        .remove(shoppingPaths);
      if (removed.error) throw new Error("SHOPPING_STORAGE_DELETE_FAILED");
    }
    if (resultPaths.length) {
      const removed = await admin.storage
        .from("try-on-results")
        .remove(resultPaths);
      if (removed.error) throw new Error("TRY_ON_STORAGE_DELETE_FAILED");
    }
    if (shopping.data?.length) {
      const deleted = await admin
        .from("shopping_analyses")
        .delete()
        .in(
          "id",
          shopping.data.map((row) => row.id),
        );
      if (deleted.error) throw new Error("SHOPPING_DATABASE_DELETE_FAILED");
    }
    if (results.data?.length) {
      const deleted = await admin
        .from("try_on_results")
        .delete()
        .in(
          "id",
          results.data.map((row) => row.id),
        );
      if (deleted.error) throw new Error("TRY_ON_DATABASE_DELETE_FAILED");
    }
    return privateResponse({
      ok: true,
      deletedShopping: shopping.data?.length || 0,
      deletedTryOns: results.data?.length || 0,
    });
  } catch {
    return apiError(
      "MAINTENANCE_FAILED",
      "Retention cleanup failed.",
      500,
      true,
    );
  }
}
