import type { SupabaseClient } from "@supabase/supabase-js";
import type { Garment } from "./demo-data";
import { generateDailyDecision } from "./outfit-engine";
import type { DailyContext, WardrobeProfile, WearSignal } from "./pilot-domain";

export const defaultProfile:WardrobeProfile = { preferredFormality:3, favoriteColors:[], avoidRules:[], styleVibe:"Polished feminine" };

export function dbGarment(row:Record<string, unknown>, signedUrl?:string):Garment {
  return {
    id:String(row.id), name:String(row.name), brand:String(row.brand || "My Closet"),
    category:String(row.category) as Garment["category"], subcategory:String(row.subcategory || row.category),
    color:String(row.color || "Neutral"), material:`${String(row.material || "Material to confirm")} · ${String(row.material_confidence || "inferred")}`,
    warmth:Number(row.warmth_score || 2), formality:Number(row.formality_score || 3),
    seasons:Array.isArray(row.seasons) ? row.seasons.map(String) : [], occasions:Array.isArray(row.occasions) ? row.occasions.map(String) : [],
    rainCompatible:Boolean(row.rain_compatible), image:signedUrl || "", inventoryType:"owned",
    laundry:Boolean(row.laundry_status), active:Boolean(row.active), worn:Number(row.worn_count || 0),
    lastWorn:row.last_worn ? String(row.last_worn) : undefined, learnedFrom:String(row.source || "manual") === "scan" ? "scan" : "manual",
    confidence:row.confidence === null || row.confidence === undefined ? undefined : Number(row.confidence),
  };
}

export async function loadProfile(supabase:SupabaseClient, userId:string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id",userId).maybeSingle();
  if (error) throw error;
  const style = (data?.style_preferences || {}) as Record<string, unknown>;
  return {
    raw:data,
    engine:{
      preferredFormality:Number(style.preferredFormality || 3),
      favoriteColors:Array.isArray(style.favoriteColors) ? style.favoriteColors.map(String) : [],
      avoidRules:Array.isArray(style.avoidRules) ? style.avoidRules.map(String) : [],
      styleVibe:String(style.styleVibe || "Polished feminine"),
    } satisfies WardrobeProfile,
  };
}

export async function loadGarments(supabase:SupabaseClient, userId:string) {
  const { data, error } = await supabase.from("garments").select("*").eq("user_id",userId).eq("active",true).order("created_at",{ascending:false});
  if (error) throw error;
  const paths = (data || []).map((row) => row.image_path).filter(Boolean) as string[];
  const signed = new Map<string,string>();
  if (paths.length) {
    const { data:signedRows } = await supabase.storage.from("garments").createSignedUrls(paths,300);
    signedRows?.forEach((row,index) => { if (row.signedUrl) signed.set(paths[index],row.signedUrl); });
  }
  return (data || []).map((row) => dbGarment(row as Record<string,unknown>, signed.get(row.image_path)));
}

export async function loadWearSignals(supabase:SupabaseClient, userId:string, limit=60):Promise<WearSignal[]> {
  const { data, error } = await supabase.from("wear_history").select("worn_on,outfit_snapshot_json,feedback(temperature_feedback,style_feedback)").eq("user_id",userId).order("worn_on",{ascending:false}).limit(limit);
  if (error) throw error;
  return (data || []).map((row) => {
    const snapshot = (row.outfit_snapshot_json || {}) as { garmentIds?:string[] };
    const feedback = Array.isArray(row.feedback) ? row.feedback[0] : row.feedback;
    return {
      garmentIds:Array.isArray(snapshot.garmentIds) ? snapshot.garmentIds : [], wornOn:String(row.worn_on),
      style:feedback?.style_feedback || undefined, temperature:feedback?.temperature_feedback === "perfect" ? "just_right" : feedback?.temperature_feedback || undefined,
    } as WearSignal;
  });
}

export async function dailyDecision(supabase:SupabaseClient, userId:string, context:DailyContext) {
  const [profile, garments, signals] = await Promise.all([loadProfile(supabase,userId),loadGarments(supabase,userId),loadWearSignals(supabase,userId)]);
  return { profile, garments, signals, decision:generateDailyDecision({ garments, context, profile:profile.engine, signals }) };
}

export function fallbackContext(date=new Date().toISOString().slice(0,10), dayType="Casual"):DailyContext {
  return { date, timezone:"America/Chicago", dayType, activities:[dayType], source:"manual", weather:{departureFeelsLike:68,dayHigh:74,eveningFeelsLike:64,rainProbability:10,observedAt:new Date().toISOString()} };
}
