import { createRequestHash } from "../../../../lib/try-on";
import { apiError, privateResponse, requireUser, unauthorized } from "../../../../lib/supabase-server";

function validGrammar(garments:Array<{category:string}>){
  const counts=new Map<string,number>();for(const garment of garments){const category=String(garment.category).toLowerCase();counts.set(category,(counts.get(category)||0)+1);}
  const count=(name:string)=>counts.get(name.toLowerCase())||0;
  const onlyKnown=[...counts.keys()].every(name=>["tops","bottoms","dresses","shoes","outerwear"].includes(name));
  const dress=count("dresses")===1&&count("tops")===0&&count("bottoms")===0;
  const separates=count("tops")===1&&count("bottoms")===1&&count("dresses")===0;
  return onlyKnown&&(dress||separates)&&count("shoes")===1&&count("outerwear")<=1&&[...counts.values()].every(value=>value===1);
}

export async function POST(request:Request){
  const auth=await requireUser(request);if(!auth)return unauthorized();const body=await request.json().catch(()=>({})) as {garmentIds?:string[];referencePhotoId?:string;mode?:string};
  const ids=Array.isArray(body.garmentIds)?[...new Set(body.garmentIds.map(String))]:[];if(!ids.length||ids.length>8)return apiError("OUTFIT_INVALID","Choose between one and eight owned pieces.",400);
  const start=new Date();start.setUTCHours(0,0,0,0);const {count}=await auth.supabase.from("try_on_jobs").select("id",{count:"exact",head:true}).eq("user_id",auth.user.id).gte("created_at",start.toISOString());if((count||0)>=10)return auth.applyCookies(apiError("TRY_ON_LIMIT","You have reached today’s private preview limit.",429));
  const {data:garments,error}=await auth.supabase.from("garments").select("id,name,category,color,image_path,active,laundry_status").eq("user_id",auth.user.id).in("id",ids);if(error||!garments||garments.length!==ids.length)return auth.applyCookies(apiError("GARMENT_NOT_OWNED","Every preview piece must belong to your closet.",422));if(garments.some(item=>!item.active||item.laundry_status))return auth.applyCookies(apiError("GARMENT_UNAVAILABLE","One selected piece is unavailable.",409));
  if(!validGrammar(garments))return auth.applyCookies(apiError("OUTFIT_INCOMPLETE","Choose a dress and shoes, or a top, bottom, and shoes. Outerwear is optional.",422));
  if(body.referencePhotoId){const {data:photo}=await auth.supabase.from("person_reference_photos").select("id").eq("id",body.referencePhotoId).eq("user_id",auth.user.id).eq("active",true).maybeSingle();if(!photo)return auth.applyCookies(apiError("REFERENCE_NOT_FOUND","Choose one of your active reference photos.",422));}
  const requestHash=createRequestHash({mode:"mirror",garments:[...ids].sort().join("|"),person:body.referencePhotoId||"board"});
  const {data:existing}=await auth.supabase.from("try_on_jobs").select("id,status,try_on_results(id,board_json,image_path,saved)").eq("user_id",auth.user.id).eq("request_hash",requestHash).eq("status","completed").maybeSingle();if(existing)return auth.applyCookies(privateResponse({job:existing,reused:true,renderMode:"composition",requestHash,board:Array.isArray(existing.try_on_results)?existing.try_on_results[0]?.board_json:undefined}));
  const {data:session,error:sessionError}=await auth.supabase.from("try_on_sessions").insert({user_id:auth.user.id,session_date:new Date().toISOString().slice(0,10),reference_photo_id:body.referencePhotoId||null,status:"completed"}).select().single();if(sessionError)return auth.applyCookies(apiError("TRY_ON_CREATE_FAILED","The preview session could not be created.",500,true));
  const {data:job,error:jobError}=await auth.supabase.from("try_on_jobs").insert({session_id:session.id,user_id:auth.user.id,mode:"mirror",provider:"exact_board",provider_model:"deterministic",prompt_version:"board-v1",status:"completed",request_hash:requestHash,garment_ids:ids,reference_photo_id:body.referencePhotoId||null,started_at:new Date().toISOString(),completed_at:new Date().toISOString()}).select().single();if(jobError)return auth.applyCookies(apiError("TRY_ON_CREATE_FAILED","The preview job could not be created.",500,true));
  const board={label:"Outfit preview",garmentIds:ids,garments:garments.map(item=>({id:item.id,name:item.name,category:item.category,color:item.color}))};const {data:result,error:resultError}=await auth.supabase.from("try_on_results").insert({job_id:job.id,user_id:auth.user.id,image_path:"",board_json:board,saved:false,expires_at:new Date(Date.now()+86_400_000).toISOString()}).select().single();if(resultError)return auth.applyCookies(apiError("TRY_ON_RESULT_FAILED","The exact outfit board could not be saved.",500,true));
  return auth.applyCookies(privateResponse({job:{...job,result},renderMode:"composition",requestHash,board},{status:201}));
}
