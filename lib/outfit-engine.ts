import type { Garment } from "./demo-data";
import {
  OUTFIT_ENGINE_VERSION,
  type DailyContext,
  type DailyDecision,
  type OutfitRecommendation,
  type RecommendationFactors,
  type RecommendationType,
  type WardrobeProfile,
  type WearSignal,
} from "./pilot-domain";

type Candidate = OutfitRecommendation & { signature: string };

const DAY_MS = 86_400_000;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const clean = (value: string) => value.trim().toLowerCase();

function stableHash(value: unknown) {
  const input = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `ctx-${(hash >>> 0).toString(36)}`;
}

function requiredOuterwear(context: DailyContext) {
  return context.weather.departureFeelsLike <= 62
    || context.weather.dayHigh - context.weather.eveningFeelsLike >= 8
    || context.weather.rainProbability >= 40;
}

function desiredWarmth(context: DailyContext, signals: WearSignal[]) {
  const base = context.weather.departureFeelsLike <= 45 ? 5
    : context.weather.departureFeelsLike <= 56 ? 4
      : context.weather.departureFeelsLike <= 67 ? 3
        : context.weather.departureFeelsLike <= 78 ? 2 : 1;
  const recent = signals.slice(0, 5).reduce((sum, signal) => sum + (signal.temperature === "too_cold" ? .2 : signal.temperature === "too_warm" ? -.2 : 0), 0);
  return clamp(base + clamp(recent, -1, 1), 1, 5);
}

function viable(garment: Garment, context: DailyContext, profile: WardrobeProfile) {
  if (!garment.active || garment.laundry || garment.inventoryType !== "owned") return false;
  if (context.weather.rainProbability >= 50 && !garment.rainCompatible) return false;
  const avoid = profile.avoidRules.map(clean);
  if (avoid.some((rule) => rule && `${garment.name} ${garment.subcategory} ${garment.material}`.toLowerCase().includes(rule))) return false;
  return true;
}

function garmentRotation(garmentId: string, signals: WearSignal[], now: Date) {
  let penalty = 0;
  for (const signal of signals) {
    if (!signal.garmentIds.includes(garmentId)) continue;
    const days = Math.floor((now.getTime() - new Date(`${signal.wornOn}T12:00:00Z`).getTime()) / DAY_MS);
    if (days >= 0 && days <= 7) penalty = Math.min(penalty, -4);
    else if (days <= 14) penalty = Math.min(penalty, -2);
  }
  return penalty;
}

function feedbackScore(ids: string[], signals: WearSignal[], now: Date) {
  let score = 0;
  for (const signal of signals) {
    const age = (now.getTime() - new Date(`${signal.wornOn}T12:00:00Z`).getTime()) / DAY_MS;
    if (age < 0 || age > 60) continue;
    const overlap = ids.filter((id) => signal.garmentIds.includes(id)).length;
    const exact = overlap === ids.length && overlap === signal.garmentIds.length;
    if (signal.style === "loved") score += (exact ? 6 : 0) + overlap * 2;
    if (signal.style === "not_for_me") score -= (exact ? 12 : 0) + overlap * 3;
  }
  return clamp(score, -20, 10);
}

function factorsFor(garments: Garment[], type: RecommendationType, context: DailyContext, profile: WardrobeProfile, signals: WearSignal[], now: Date): RecommendationFactors {
  const desired = desiredWarmth(context, signals);
  const occasions = context.activities.length ? context.activities : [context.dayType];
  const occasionHits = garments.filter((garment) => garment.occasions.some((occasion) => occasions.some((activity) => clean(activity).includes(clean(occasion)) || clean(occasion).includes(clean(activity))))).length;
  const outfitWarmth = average(garments.map((garment) => garment.warmth));
  const outfitFormality = average(garments.map((garment) => garment.formality));
  const favoriteColors = new Set(profile.favoriteColors.map(clean));
  const flatShoes = garments.some((garment) => garment.category === "Shoes" && !/(stiletto|high heel|pump)/i.test(`${garment.name} ${garment.subcategory}`));
  const rotation = clamp(garments.reduce((sum, garment) => sum + garmentRotation(garment.id, signals, now), 0), -20, 0);
  const formalityTarget = type === "most_polished" ? clamp(profile.preferredFormality + 1, 1, 5) : profile.preferredFormality;
  return {
    occasion: clamp(Math.round(25 * occasionHits / Math.max(1, garments.length)), 0, 25),
    warmth: clamp(Math.round(20 - Math.abs(outfitWarmth - desired) * 6), 0, 20),
    formality: clamp(Math.round(15 - Math.abs(outfitFormality - formalityTarget) * 4), 0, 15),
    rain: context.weather.rainProbability < 40 ? 10 : garments.every((garment) => garment.rainCompatible) ? 10 : 0,
    comfort: context.weather.walking || type === "most_comfortable" ? (flatShoes ? 10 : 2) : 8,
    style: clamp(garments.reduce((sum, garment) => sum + (favoriteColors.has(clean(garment.color)) ? 4 : 0), 2), 0, 10),
    feedback: feedbackScore(garments.map((garment) => garment.id), signals, now),
    rotation,
  };
}

function explanation(factors: RecommendationFactors, context: DailyContext) {
  const positives = Object.entries(factors).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([key]) => key);
  const labels: Record<string, string> = { occasion:"your plans", warmth:"the temperature", formality:"the dress code", rain:"the forecast", comfort:"walking comfort", style:"your colors", feedback:"what you have loved", rotation:"wardrobe rotation" };
  return `Strong for ${positives.map((item) => labels[item]).join(" and ") || context.dayType.toLowerCase()}.`;
}

function candidate(garments: Garment[], type: RecommendationType, context: DailyContext, profile: WardrobeProfile, signals: WearSignal[], now: Date): Candidate {
  const factors = factorsFor(garments, type, context, profile, signals, now);
  const score = clamp(Object.values(factors).reduce((sum, value) => sum + value, 0), 0, 100);
  const ids = garments.map((garment) => garment.id);
  const signature = [...ids].sort().join("|");
  const label = type === "best_overall" ? "Best overall" : type === "most_polished" ? "Most polished" : "Most comfortable";
  return {
    id:`${OUTFIT_ENGINE_VERSION}-${stableHash({ signature, type })}`,
    rank:0, type, title:label, garmentIds:ids, score, factors, reason:explanation(factors, context),
    note: requiredOuterwear(context) ? "A layer is included for the temperature shift." : "Built only from pieces ready in your closet.",
    warmth:Math.round(average(garments.map((garment) => garment.warmth))),
    formality:Math.round(average(garments.map((garment) => garment.formality))),
    walking:factors.comfort >= 8 ? "Ready for walking" : "Best for shorter walks", signature,
  };
}

function combinations(items: Garment[][], limit = 4000) {
  const output: Garment[][] = [];
  const visit = (index: number, selected: Garment[]) => {
    if (output.length >= limit) return;
    if (index === items.length) { output.push(selected); return; }
    for (const item of items[index].slice(0, 12)) visit(index + 1, [...selected, item]);
  };
  visit(0, []);
  return output;
}

export function generateDailyDecision(input: { garments: Garment[]; context: DailyContext; profile: WardrobeProfile; signals?: WearSignal[]; now?: Date }): DailyDecision {
  const now = input.now || new Date();
  const signals = input.signals || [];
  const active = input.garments.filter((garment) => viable(garment, input.context, input.profile));
  const by = (category: Garment["category"]) => active.filter((garment) => garment.category === category);
  const tops = by("Tops"), bottoms = by("Bottoms"), dresses = by("Dresses"), shoes = by("Shoes"), outerwear = by("Outerwear");
  const layerRequired = requiredOuterwear(input.context);
  const base: Garment[][] = [
    ...combinations([dresses, shoes]),
    ...combinations([tops, bottoms, shoes]),
  ];
  const outfits = base.flatMap((pieces) => layerRequired ? outerwear.map((layer) => [...pieces, layer]) : [pieces, ...outerwear.slice(0, 4).map((layer) => [...pieces, layer])]);
  const variants: RecommendationType[] = ["best_overall", "most_polished", "most_comfortable"];
  const used = new Set<string>();
  const recommendations = variants.flatMap((type) => {
    const ranked = outfits.map((items) => candidate(items, type, input.context, input.profile, signals, now)).sort((a, b) => b.score - a.score || a.signature.localeCompare(b.signature));
    const pick = ranked.find((item) => !used.has(item.signature)) || ranked[0];
    if (!pick) return [];
    used.add(pick.signature);
    return [{ ...pick, rank:used.size }];
  });
  const missingCategories:string[] = [];
  if (!shoes.length) missingCategories.push("Shoes");
  if (!dresses.length && !tops.length) missingCategories.push("Tops or Dresses");
  if (!dresses.length && !bottoms.length) missingCategories.push("Bottoms or Dresses");
  if (layerRequired && !outerwear.length) missingCategories.push("Outerwear");
  return {
    contextHash:stableHash({ context:input.context, wardrobe:active.map((item) => [item.id,item.active,item.laundry]), profile:input.profile, signals }),
    engineVersion:OUTFIT_ENGINE_VERSION,
    recommendations:recommendations.map((item) => ({ id:item.id,rank:item.rank,type:item.type,title:item.title,garmentIds:item.garmentIds,score:item.score,factors:item.factors,reason:item.reason,note:item.note,warmth:item.warmth,formality:item.formality,walking:item.walking })),
    missingCategories,
    cta:recommendations.length ? undefined : missingCategories.length ? `Add ${missingCategories[0].toLowerCase()}` : "Add wardrobe pieces",
  };
}
