import {
  apiError,
  privateResponse,
  requireUser,
  unauthorized,
} from "../../../lib/supabase-server";

function validImage(bytes: Uint8Array, type: string) {
  if (bytes.byteLength > 12 * 1024 * 1024 || bytes.byteLength < 12)
    return false;
  if (type === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png")
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    );
  if (type === "image/webp")
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  return false;
}

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth) return unauthorized();
  const { data, error } = await auth.supabase
    .from("person_reference_photos")
    .select("id,image_path,thumbnail_path,assessment_json,is_default,active")
    .eq("user_id", auth.user.id)
    .eq("active", true);
  if (error)
    return auth.applyCookies(
      apiError(
        "PHOTOS_READ_FAILED",
        "Reference photos could not be loaded.",
        500,
        true,
      ),
    );
  const paths = (data || []).map((row) => row.thumbnail_path || row.image_path);
  const signed = paths.length
    ? (
        await auth.supabase.storage
          .from("person-reference-photos")
          .createSignedUrls(paths, 300)
      ).data || []
    : [];
  return auth.applyCookies(
    privateResponse({
      photos: (data || []).map((row, index) => ({
        ...row,
        src: signed[index]?.signedUrl || "",
      })),
    }),
  );
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth) return unauthorized();
  const form = await request.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File))
    return apiError("PHOTO_REQUIRED", "Choose a reference photo.", 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validImage(bytes, file.type))
    return apiError(
      "PHOTO_INVALID",
      "Use a processed JPEG, PNG, or WebP under 12 MB.",
      400,
    );
  const profile = await auth.supabase
    .from("person_profiles")
    .upsert(
      {
        user_id: auth.user.id,
        consent_confirmed_at: new Date().toISOString(),
        active: true,
      },
      { onConflict: "user_id" },
    )
    .select()
    .single();
  if (profile.error)
    return auth.applyCookies(
      apiError(
        "PHOTO_PROFILE_FAILED",
        "Consent could not be recorded.",
        500,
        true,
      ),
    );
  const id = crypto.randomUUID();
  const extension =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const image_path = `${auth.user.id}/${id}.${extension}`;
  const upload = await auth.supabase.storage
    .from("person-reference-photos")
    .upload(image_path, bytes, { contentType: file.type, upsert: false });
  if (upload.error)
    return auth.applyCookies(
      apiError(
        "PHOTO_UPLOAD_FAILED",
        "The reference photo could not be stored.",
        500,
        true,
      ),
    );
  const existing = await auth.supabase
    .from("person_reference_photos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id)
    .eq("active", true);
  const row = await auth.supabase
    .from("person_reference_photos")
    .insert({
      id,
      user_id: auth.user.id,
      person_profile_id: profile.data.id,
      image_path,
      assessment_json: { processed: true },
      is_default: (existing.count || 0) === 0,
      active: true,
    })
    .select()
    .single();
  if (row.error) {
    await auth.supabase.storage
      .from("person-reference-photos")
      .remove([image_path]);
    return auth.applyCookies(
      apiError(
        "PHOTO_SAVE_FAILED",
        "The reference photo could not be saved.",
        500,
        true,
      ),
    );
  }
  return auth.applyCookies(
    privateResponse({ photo: row.data }, { status: 201 }),
  );
}

export async function DELETE(request: Request) {
  const auth = await requireUser(request);
  if (!auth) return unauthorized();
  const id = new URL(request.url).searchParams.get("id");
  if (!id)
    return apiError("PHOTO_ID_REQUIRED", "Choose a photo to delete.", 400);
  let photoQuery = auth.supabase
    .from("person_reference_photos")
    .select("id,image_path,thumbnail_path")
    .eq("user_id", auth.user.id)
    .eq("active", true);
  if (id !== "all") photoQuery = photoQuery.eq("id", id);
  const photosResult = await photoQuery;
  if (photosResult.error)
    return auth.applyCookies(
      apiError(
        "PHOTO_DELETE_FAILED",
        "Photos could not be prepared for deletion.",
        500,
        true,
      ),
    );
  const photos = photosResult.data || [];
  const photoIds = photos.map((photo) => photo.id);
  let resultQuery = auth.supabase
    .from("try_on_results")
    .select("id,job_id,image_path,thumbnail_path")
    .eq("user_id", auth.user.id);
  if (id !== "all") {
    const jobs = await auth.supabase
      .from("try_on_jobs")
      .select("id")
      .eq("user_id", auth.user.id)
      .eq("reference_photo_id", id);
    if (jobs.error)
      return auth.applyCookies(
        apiError(
          "PHOTO_DELETE_FAILED",
          "Dependent previews could not be prepared for deletion.",
          500,
          true,
        ),
      );
    const jobIds = (jobs.data || []).map((job) => job.id);
    if (!jobIds.length)
      resultQuery = resultQuery.in("job_id", [
        "00000000-0000-0000-0000-000000000000",
      ]);
    else resultQuery = resultQuery.in("job_id", jobIds).eq("saved", false);
  }
  const resultsResult = await resultQuery;
  if (resultsResult.error)
    return auth.applyCookies(
      apiError(
        "PHOTO_DELETE_FAILED",
        "Dependent previews could not be prepared for deletion.",
        500,
        true,
      ),
    );
  const results = resultsResult.data || [];
  const objects = [
    ...photos.flatMap((photo) =>
      [photo.image_path, photo.thumbnail_path]
        .filter(Boolean)
        .map((path) => ({ bucket: "person-reference-photos", path })),
    ),
    ...results.flatMap((result) =>
      [result.image_path, result.thumbnail_path]
        .filter(Boolean)
        .map((path) => ({ bucket: "try-on-results", path })),
    ),
  ];
  const requestRow = await auth.supabase
    .from("deletion_requests")
    .insert({
      user_id: auth.user.id,
      kind: id === "all" ? "all_private_media" : "reference_photo",
      target_id: id === "all" ? null : id,
      object_paths_json: objects,
      status: "processing",
      attempts: 1,
    })
    .select()
    .single();
  if (requestRow.error)
    return auth.applyCookies(
      apiError(
        "DELETION_CREATE_FAILED",
        "Deletion could not be started.",
        500,
        true,
      ),
    );
  const pending = async (code: string) => {
    await auth.supabase
      .from("deletion_requests")
      .update({ status: "failed", error_code: code })
      .eq("id", requestRow.data.id);
    return auth.applyCookies(
      privateResponse(
        { ok: false, status: "pending", deletionId: requestRow.data.id },
        { status: 202 },
      ),
    );
  };
  if (photoIds.length) {
    const tombstone = await auth.supabase
      .from("person_reference_photos")
      .update({ active: false, deleted_at: new Date().toISOString() })
      .eq("user_id", auth.user.id)
      .in("id", photoIds);
    if (tombstone.error) return pending("TOMBSTONE_FAILED");
  }
  for (const bucket of ["person-reference-photos", "try-on-results"]) {
    const paths = objects
      .filter((object) => object.bucket === bucket)
      .map((object) => object.path);
    if (!paths.length) continue;
    const removed = await auth.supabase.storage.from(bucket).remove(paths);
    if (removed.error) return pending("STORAGE_DELETE_FAILED");
  }
  if (results.length) {
    const deleted = await auth.supabase
      .from("try_on_results")
      .delete()
      .eq("user_id", auth.user.id)
      .in(
        "id",
        results.map((result) => result.id),
      );
    if (deleted.error) return pending("DATABASE_DELETE_FAILED");
  }
  if (photoIds.length) {
    const deleted = await auth.supabase
      .from("person_reference_photos")
      .delete()
      .eq("user_id", auth.user.id)
      .in("id", photoIds);
    if (deleted.error) return pending("DATABASE_DELETE_FAILED");
  }
  if (id === "all") {
    const sessions = await auth.supabase
      .from("try_on_sessions")
      .delete()
      .eq("user_id", auth.user.id);
    if (sessions.error) return pending("DATABASE_DELETE_FAILED");
  }
  const completed = await auth.supabase
    .from("deletion_requests")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", requestRow.data.id);
  if (completed.error) return pending("STATUS_UPDATE_FAILED");
  return auth.applyCookies(
    privateResponse({
      ok: true,
      status: "completed",
      deletionId: requestRow.data.id,
    }),
  );
}
