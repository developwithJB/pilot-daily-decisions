import {
  apiError,
  privateResponse,
  requireUser,
  unauthorized,
} from "../../../../../lib/supabase-server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (!auth) return unauthorized();
  const { id } = await context.params;
  const { data, error } = await auth.supabase
    .from("shopping_analyses")
    .select("*,shopping_matches(garment_id,similarity,reasons_json)")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error)
    return auth.applyCookies(
      apiError(
        "SHOPPING_READ_FAILED",
        "The shopping decision could not be loaded.",
        500,
        true,
      ),
    );
  if (!data)
    return auth.applyCookies(
      apiError(
        "SHOPPING_NOT_FOUND",
        "That shopping decision was not found.",
        404,
      ),
    );
  let screenshotUrl = "";
  if (data.screenshot_path)
    screenshotUrl =
      (
        await auth.supabase.storage
          .from("shopping-screenshots")
          .createSignedUrl(data.screenshot_path, 300)
      ).data?.signedUrl || "";
  return auth.applyCookies(
    privateResponse({ analysis: { ...data, screenshotUrl } }),
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (!auth) return unauthorized();
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    attributes?: Record<string, unknown>;
  };
  const { data: analysis } = await auth.supabase
    .from("shopping_analyses")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!analysis)
    return auth.applyCookies(
      apiError(
        "SHOPPING_NOT_FOUND",
        "That shopping decision was not found.",
        404,
      ),
    );
  if (body.action === "save") {
    const result = await auth.supabase
      .from("shopping_analyses")
      .update({
        saved: true,
        expires_at: null,
        attributes_json: body.attributes || analysis.attributes_json,
      })
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .select()
      .single();
    return auth.applyCookies(
      result.error
        ? apiError(
            "SHOPPING_SAVE_FAILED",
            "The item could not be saved.",
            500,
            true,
          )
        : privateResponse({ analysis: result.data }),
    );
  }
  if (body.action === "bought") {
    if (analysis.purchased_garment_id) {
      const existing = await auth.supabase
        .from("garments")
        .select("*")
        .eq("id", analysis.purchased_garment_id)
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (existing.data)
        return auth.applyCookies(
          privateResponse({ garment: existing.data, idempotent: true }),
        );
    }
    const attributes = (body.attributes || analysis.attributes_json) as Record<
      string,
      unknown
    >;
    let image_path: null | string = null;
    if (analysis.screenshot_path) {
      const source = await auth.supabase.storage
        .from("shopping-screenshots")
        .download(analysis.screenshot_path);
      if (source.data) {
        image_path = `${auth.user.id}/${id}.webp`;
        const upload = await auth.supabase.storage
          .from("garments")
          .upload(image_path, source.data, {
            contentType: source.data.type || "image/webp",
            upsert: false,
          });
        if (
          upload.error &&
          upload.error.message &&
          !upload.error.message.toLowerCase().includes("exist")
        )
          image_path = null;
      }
    }
    const garment = await auth.supabase
      .from("garments")
      .insert({
        id,
        user_id: auth.user.id,
        name: String(attributes.name || "New purchase"),
        brand: "My Closet",
        category: String(attributes.category || "Tops"),
        subcategory: String(
          attributes.subcategory || attributes.category || "Top",
        ),
        color: String(attributes.color || "Neutral"),
        material: String(attributes.material || "Material to confirm"),
        material_confidence: "inferred",
        warmth_score: Number(attributes.warmth || 2),
        formality_score: Number(attributes.formality || 3),
        seasons: ["Spring", "Summer", "Fall", "Winter"],
        occasions: Array.isArray(attributes.occasions)
          ? attributes.occasions
          : ["Casual"],
        rain_compatible: Boolean(attributes.rainCompatible),
        image_path,
        inventory_type: "owned",
        source: "shopping",
      })
      .select()
      .single();
    if (garment.error) {
      if (garment.error.code === "23505") {
        const existing = await auth.supabase
          .from("garments")
          .select("*")
          .eq("id", id)
          .eq("user_id", auth.user.id)
          .maybeSingle();
        if (existing.data)
          return auth.applyCookies(
            privateResponse({ garment: existing.data, idempotent: true }),
          );
      }
      return auth.applyCookies(
        apiError(
          "PURCHASE_SAVE_FAILED",
          "The purchase could not be added to your closet.",
          500,
          true,
        ),
      );
    }
    const updated = await auth.supabase
      .from("shopping_analyses")
      .update({
        saved: true,
        expires_at: null,
        purchased_garment_id: garment.data.id,
      })
      .eq("id", id)
      .eq("user_id", auth.user.id);
    if (updated.error)
      return auth.applyCookies(
        apiError(
          "PURCHASE_LINK_FAILED",
          "The purchase was added, but its shopping decision could not be updated.",
          500,
          true,
        ),
      );
    return auth.applyCookies(privateResponse({ garment: garment.data }));
  }
  return apiError(
    "SHOPPING_ACTION_INVALID",
    "Choose Save or I bought it.",
    400,
  );
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (!auth) return unauthorized();
  const { id } = await context.params;
  const { data } = await auth.supabase
    .from("shopping_analyses")
    .select("screenshot_path,thumbnail_path")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!data) return auth.applyCookies(privateResponse({ ok: true }));
  const paths = [data.screenshot_path, data.thumbnail_path].filter(Boolean);
  if (paths.length) {
    const removed = await auth.supabase.storage
      .from("shopping-screenshots")
      .remove(paths);
    if (removed.error)
      return auth.applyCookies(
        apiError(
          "SHOPPING_DELETE_PENDING",
          "The screenshot could not be removed yet.",
          503,
          true,
        ),
      );
  }
  const result = await auth.supabase
    .from("shopping_analyses")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);
  return auth.applyCookies(
    result.error
      ? apiError(
          "SHOPPING_DELETE_FAILED",
          "The shopping decision could not be removed.",
          500,
          true,
        )
      : privateResponse({ ok: true }),
  );
}
