import { dailyDecision, fallbackContext } from "../../../lib/pilot-server";
import { calendarConfigReady } from "../../../lib/calendar-security";
import {
  apiError,
  privateResponse,
  requireUser,
  unauthorized,
} from "../../../lib/supabase-server";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth) return unauthorized();
  try {
    const date =
      new URL(request.url).searchParams.get("date") ||
      new Date().toISOString().slice(0, 10);
    const context = fallbackContext(date);
    const [
      { profile, garments, signals, decision },
      history,
      photos,
      calendar,
    ] = await Promise.all([
      dailyDecision(auth.supabase, auth.user.id, context),
      auth.supabase
        .from("wear_history")
        .select(
          "id,worn_on,context_snapshot,outfit_snapshot_json,try_on_result_id,feedback(temperature_feedback,style_feedback)",
        )
        .eq("user_id", auth.user.id)
        .order("worn_on", { ascending: false })
        .limit(50),
      auth.supabase
        .from("person_reference_photos")
        .select(
          "id,thumbnail_path,image_path,assessment_json,is_default,active",
        )
        .eq("user_id", auth.user.id)
        .eq("active", true)
        .order("created_at", { ascending: false }),
      auth.supabase
        .from("calendar_connections")
        .select("id,provider,connected_at")
        .eq("user_id", auth.user.id)
        .maybeSingle(),
    ]);
    const photoRows = photos.data || [];
    const photoPaths = photoRows
      .map((row) => row.thumbnail_path || row.image_path)
      .filter(Boolean);
    const signed = photoPaths.length
      ? (
          await auth.supabase.storage
            .from("person-reference-photos")
            .createSignedUrls(photoPaths, 300)
        ).data || []
      : [];
    return auth.applyCookies(
      privateResponse({
        user: { id: auth.user.id, email: auth.user.email },
        profile: profile.raw,
        closet: garments,
        history: history.data || [],
        decision,
        context,
        photos: photoRows.map((row, index) => ({
          ...row,
          src: signed[index]?.signedUrl || "",
        })),
        calendar: {
          configured: calendarConfigReady(),
          connected: Boolean(calendar.data),
        },
        signals,
      }),
    );
  } catch {
    return auth.applyCookies(
      apiError(
        "BOOTSTRAP_FAILED",
        "Pilot could not load your private data.",
        500,
        true,
      ),
    );
  }
}
