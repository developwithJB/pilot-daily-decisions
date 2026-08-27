import { apiError, privateResponse, requireUser, unauthorized } from "../../../lib/supabase-server";

const allowed = new Set(["name","city","latitude","longitude","styleVibe","preferredFormality","favoriteColors","avoidRules","routine","otherApps","autopilotGoals"]);

export async function GET(request:Request) {
  const auth=await requireUser(request); if(!auth) return unauthorized();
  const {data,error}=await auth.supabase.from("profiles").select("*").eq("id",auth.user.id).maybeSingle();
  if(error) return auth.applyCookies(apiError("PROFILE_READ_FAILED","Your profile could not be loaded.",500,true));
  return auth.applyCookies(privateResponse({profile:data}));
}

export async function PATCH(request:Request) {
  const auth=await requireUser(request); if(!auth) return unauthorized();
  const body=await request.json().catch(()=>({})) as Record<string,unknown>;
  const clean=Object.fromEntries(Object.entries(body).filter(([key])=>allowed.has(key)));
  const style_preferences={
    styleVibe:String(clean.styleVibe||"Polished feminine").slice(0,80),
    preferredFormality:Math.max(1,Math.min(5,Number(clean.preferredFormality)||3)),
    favoriteColors:Array.isArray(clean.favoriteColors)?clean.favoriteColors.map(String).slice(0,20):String(clean.favoriteColors||"").split(",").map(v=>v.trim()).filter(Boolean).slice(0,20),
    avoidRules:Array.isArray(clean.avoidRules)?clean.avoidRules.map(String).slice(0,20):String(clean.avoidRules||"").split(",").map(v=>v.trim()).filter(Boolean).slice(0,20),
    routine:String(clean.routine||"").slice(0,500), otherApps:String(clean.otherApps||"").slice(0,300), autopilotGoals:String(clean.autopilotGoals||"").slice(0,500),
    city:String(clean.city||"").slice(0,100), latitude:clean.latitude||null, longitude:clean.longitude||null,
  };
  const row={id:auth.user.id,name:String(clean.name||auth.user.email?.split("@")[0]||"Pilot").slice(0,80),home_location:String(clean.city||"").slice(0,100),style_preferences,updated_at:new Date().toISOString()};
  const {data,error}=await auth.supabase.from("profiles").upsert(row).select().single();
  if(error) return auth.applyCookies(apiError("PROFILE_SAVE_FAILED","Your profile could not be saved.",500,true));
  return auth.applyCookies(privateResponse({profile:data}));
}
