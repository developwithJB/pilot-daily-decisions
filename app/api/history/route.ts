import { apiError, privateResponse, requireUser, unauthorized } from "../../../lib/supabase-server";

export async function GET(request:Request){
  const auth=await requireUser(request); if(!auth)return unauthorized();
  const {data,error}=await auth.supabase.from("wear_history").select("id,worn_on,context_snapshot,outfit_snapshot_json,try_on_result_id,feedback(id,temperature_feedback,style_feedback)").eq("user_id",auth.user.id).order("worn_on",{ascending:false}).limit(100);
  return auth.applyCookies(error?apiError("HISTORY_READ_FAILED","History could not be loaded.",500,true):privateResponse({items:data||[]}));
}

export async function POST(request:Request){
  const auth=await requireUser(request); if(!auth)return unauthorized();
  const body=await request.json().catch(()=>({})) as {garmentIds?:string[];context?:Record<string,unknown>;tryOnResultId?:string};
  const ids=Array.isArray(body.garmentIds)?[...new Set(body.garmentIds.map(String))]:[];
  if(!ids.length||ids.length>8)return apiError("OUTFIT_INVALID","Choose a complete outfit first.",400);
  const {data:garments,error}=await auth.supabase.from("garments").select("id,name,category,color,image_path,active,laundry_status,worn_count").eq("user_id",auth.user.id).in("id",ids);
  if(error||!garments||garments.length!==ids.length||garments.some(item=>!item.active||item.laundry_status))return auth.applyCookies(apiError("OUTFIT_UNAVAILABLE","One or more pieces are unavailable.",409));
  const wornOn=new Date().toISOString().slice(0,10);
  const hashBytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode([...ids].sort().join("|")));const outfitHash=Array.from(new Uint8Array(hashBytes),value=>value.toString(16).padStart(2,"0")).join("");
  const snapshot={garmentIds:ids,garments:garments.map(({id,name,category,color})=>({id,name,category,color}))};
  const {data,error:insertError}=await auth.supabase.from("wear_history").insert({user_id:auth.user.id,worn_on:wornOn,outfit_hash:outfitHash,context_snapshot:body.context||{},outfit_snapshot_json:snapshot,try_on_result_id:body.tryOnResultId||null}).select().single();
  if(insertError?.code==="23505"){const existing=await auth.supabase.from("wear_history").select("*").eq("user_id",auth.user.id).eq("worn_on",wornOn).eq("outfit_hash",outfitHash).single();return auth.applyCookies(existing.error?apiError("HISTORY_SAVE_FAILED","This outfit could not be confirmed in history.",500,true):privateResponse({item:existing.data,reused:true}));}
  if(insertError)return auth.applyCookies(apiError("HISTORY_SAVE_FAILED","This outfit could not be marked worn.",500,true));
  await Promise.all(garments.map(item=>auth.supabase.from("garments").update({last_worn:wornOn,worn_count:Number(item.worn_count||0)+1}).eq("id",item.id).eq("user_id",auth.user.id)));
  await auth.supabase.from("product_events").insert({user_id:auth.user.id,event_name:"outfit_worn",properties_json:{garmentCount:ids.length}});
  return auth.applyCookies(privateResponse({item:data},{status:201}));
}
