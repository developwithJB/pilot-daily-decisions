import {
  apiError,
  privateResponse,
  requireUser,
  unauthorized,
} from "../../../../../lib/supabase-server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (!auth) return unauthorized();
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    style?: string;
    temperature?: string;
  };
  const style = new Set(["loved", "not_for_me"]);
  const temperature = new Set(["too_cold", "just_right", "too_warm"]);
  if (
    (body.style && !style.has(body.style)) ||
    (body.temperature && !temperature.has(body.temperature))
  )
    return apiError(
      "FEEDBACK_INVALID",
      "Choose one of the available feedback options.",
      400,
    );
  const { data: wear } = await auth.supabase
    .from("wear_history")
    .select("id")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!wear)
    return auth.applyCookies(
      apiError("HISTORY_NOT_FOUND", "That worn outfit no longer exists.", 404),
    );
  const row = {
    user_id: auth.user.id,
    wear_history_id: id,
    style_feedback: body.style || null,
    temperature_feedback:
      body.temperature === "just_right" ? "perfect" : body.temperature || null,
    updated_at: new Date().toISOString(),
  };
  const result = await auth.supabase
    .from("feedback")
    .upsert(row, { onConflict: "user_id,wear_history_id" })
    .select()
    .single();
  if (result.error)
    return auth.applyCookies(
      apiError(
        "FEEDBACK_SAVE_FAILED",
        "Feedback could not be saved.",
        500,
        true,
      ),
    );
  return auth.applyCookies(privateResponse({ feedback: result.data }));
}
