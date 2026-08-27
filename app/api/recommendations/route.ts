import { dailyDecision, fallbackContext } from "../../../lib/pilot-server";
import type { DailyContext } from "../../../lib/pilot-domain";
import { apiError, privateResponse, requireUser, unauthorized } from "../../../lib/supabase-server";

export async function POST(request:Request) {
  const auth=await requireUser(request); if(!auth) return unauthorized();
  const body=await request.json().catch(()=>({})) as {date?:string;manualContext?:Partial<DailyContext>};
  const date=/^\d{4}-\d{2}-\d{2}$/.test(body.date||"")?body.date!:new Date().toISOString().slice(0,10);
  const base=fallbackContext(date,String(body.manualContext?.dayType||"Casual"));
  const context={...base,...body.manualContext,date,weather:{...base.weather,...body.manualContext?.weather}} as DailyContext;
  try {
    const result=await dailyDecision(auth.supabase,auth.user.id,context);
    await auth.supabase.from("product_events").insert({user_id:auth.user.id,event_name:"recommendation_generated",properties_json:{date,coverage:result.decision.recommendations.length,engine:result.decision.engineVersion}});
    return auth.applyCookies(privateResponse({context,decision:result.decision}));
  } catch { return auth.applyCookies(apiError("RECOMMENDATION_FAILED","Your closet could not be decided right now.",500,true)); }
}
