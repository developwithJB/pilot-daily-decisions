import {
  apiError,
  privateResponse,
  requireUser,
  unauthorized,
} from "../../../../lib/supabase-server";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (!auth) return unauthorized();
  const { id } = await context.params;
  const { data, error } = await auth.supabase
    .from("deletion_requests")
    .select("id,kind,status,attempts,error_code,completed_at,created_at")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  return auth.applyCookies(
    error
      ? apiError(
          "DELETION_READ_FAILED",
          "Deletion status could not be loaded.",
          500,
          true,
        )
      : !data
        ? apiError("DELETION_NOT_FOUND", "Deletion request not found.", 404)
        : privateResponse({ deletion: data }),
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (!auth) return unauthorized();
  const { id } = await context.params;
  const { data } = await auth.supabase
    .from("deletion_requests")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!data)
    return auth.applyCookies(
      apiError("DELETION_NOT_FOUND", "Deletion request not found.", 404),
    );
  const raw: unknown[] = Array.isArray(data.object_paths_json)
    ? data.object_paths_json
    : [];
  const fallbackBucket = String(data.kind).includes("shopping")
    ? "shopping-screenshots"
    : String(data.kind).includes("try_on")
      ? "try-on-results"
      : "person-reference-photos";
  const objects: { bucket: string; path: string }[] = raw
    .map((value: unknown) =>
      typeof value === "string"
        ? { bucket: fallbackBucket, path: value }
        : (value as { bucket: string; path: string }),
    )
    .filter(
      (value: { bucket: string; path: string }) =>
        Boolean(value.path) &&
        [
          "person-reference-photos",
          "try-on-results",
          "shopping-screenshots",
          "garments",
        ].includes(value.bucket),
    );
  await auth.supabase
    .from("deletion_requests")
    .update({
      status: "processing",
      attempts: Number(data.attempts || 0) + 1,
      error_code: null,
    })
    .eq("id", id);
  for (const bucket of [...new Set(objects.map((object) => object.bucket))]) {
    const result = await auth.supabase.storage
      .from(bucket)
      .remove(
        objects
          .filter((object) => object.bucket === bucket)
          .map((object) => object.path),
      );
    if (result.error) {
      await auth.supabase
        .from("deletion_requests")
        .update({ status: "failed", error_code: "STORAGE_DELETE_FAILED" })
        .eq("id", id);
      return auth.applyCookies(
        apiError("DELETION_PENDING", "Deletion is still pending.", 503, true),
      );
    }
  }
  if (data.kind === "all_private_media") {
    for (const table of [
      "person_reference_photos",
      "try_on_results",
      "try_on_sessions",
    ]) {
      const deleted = await auth.supabase
        .from(table)
        .delete()
        .eq("user_id", auth.user.id);
      if (deleted.error) {
        await auth.supabase
          .from("deletion_requests")
          .update({ status: "failed", error_code: "DATABASE_DELETE_FAILED" })
          .eq("id", id);
        return auth.applyCookies(
          apiError(
            "DELETION_PENDING",
            "Private files were removed; record cleanup is still pending.",
            503,
            true,
          ),
        );
      }
    }
  } else {
    const table = String(data.kind).includes("shopping")
      ? "shopping_analyses"
      : String(data.kind).includes("try_on")
        ? "try_on_results"
        : "person_reference_photos";
    let deletion = auth.supabase
      .from(table)
      .delete()
      .eq("user_id", auth.user.id);
    if (data.target_id) deletion = deletion.eq("id", data.target_id);
    const deleted = await deletion;
    if (deleted.error) {
      await auth.supabase
        .from("deletion_requests")
        .update({ status: "failed", error_code: "DATABASE_DELETE_FAILED" })
        .eq("id", id);
      return auth.applyCookies(
        apiError(
          "DELETION_PENDING",
          "Private files were removed; record cleanup is still pending.",
          503,
          true,
        ),
      );
    }
  }
  const completed = await auth.supabase
    .from("deletion_requests")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", id);
  if (completed.error)
    return auth.applyCookies(
      apiError(
        "DELETION_PENDING",
        "Private files were removed; status update is still pending.",
        503,
        true,
      ),
    );
  return auth.applyCookies(privateResponse({ ok: true, status: "completed" }));
}
