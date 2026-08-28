import { getAvatar3DProvider } from "../../../../lib/providers/avatar-3d-provider";
import { apiError, privateResponse, requireUser, unauthorized } from "../../../../lib/supabase-server";

export async function POST(request: Request) {
  const demo = process.env.DEMO_MODE === "true" || process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  let ownerId = "demo-local-user";
  let applyCookies = (response: Response) => response;
  if (!demo) {
    const auth = await requireUser(request);
    if (!auth) return unauthorized();
    ownerId = auth.user.id;
    applyCookies = auth.applyCookies;
  }
  const body = await request.json().catch(() => ({})) as { referencePhotoPaths?: string[] };
  const paths = (body.referencePhotoPaths || []).filter((path) => typeof path === "string" && !/^https?:\/\//i.test(path)).slice(0, 3);
  const result = await getAvatar3DProvider().createAvatar({ ownerId, referencePhotoPaths: paths });
  if (result.data.status === "disabled") {
    return applyCookies(apiError("AVATAR_3D_DISABLED", result.warnings[0], 503, false));
  }
  return applyCookies(privateResponse(result, { status: 202 }));
}
