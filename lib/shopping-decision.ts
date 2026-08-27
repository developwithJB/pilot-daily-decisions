import type { Garment } from "./demo-data";
import { generateDailyDecision } from "./outfit-engine";
import type { DailyContext, ShoppingAttributes, ShoppingDecision, WardrobeProfile, WearSignal } from "./pilot-domain";

const normalized = (value:string) => value.trim().toLowerCase();
const same = (left:string, right:string) => normalized(left) === normalized(right);
const contains = (left:string, right:string) => normalized(left).includes(normalized(right)) || normalized(right).includes(normalized(left));
const overlap = (left:string[], right:string[]) => left.some((item) => right.some((other) => contains(item, other)));

export function shoppingSimilarity(candidate: ShoppingAttributes, garment: Garment) {
  const reasons:string[] = [];
  let score = 0;
  if (candidate.category === garment.category) { score += .25; reasons.push("same category"); }
  if (contains(candidate.subcategory, garment.subcategory)) { score += .15; reasons.push("same type"); }
  if (same(candidate.color, garment.color)) { score += .2; reasons.push("same color"); }
  if (contains(candidate.material, garment.material)) { score += .08; reasons.push("similar material"); }
  if (candidate.pattern && /solid/i.test(candidate.pattern) === /solid/i.test(garment.name)) score += .07;
  if (candidate.silhouette && contains(candidate.silhouette, garment.subcategory)) { score += .15; reasons.push("similar silhouette"); }
  const formality = Math.max(0, 1 - Math.abs(candidate.formality - garment.formality) / 4);
  const occasion = overlap(candidate.occasions, garment.occasions) ? 1 : 0;
  score += .05 * formality + .05 * occasion;
  return { score:Math.min(1, Number(score.toFixed(3))), reasons };
}

export function analyzeShoppingCandidate(input:{ candidate:ShoppingAttributes; garments:Garment[]; context:DailyContext; profile:WardrobeProfile; signals?:WearSignal[] }):ShoppingDecision {
  const owned = input.garments.filter((item) => item.inventoryType === "owned" && item.active);
  const closestMatches = owned.map((garment) => ({ garmentId:garment.id, ...shoppingSimilarity(input.candidate, garment) })).sort((a,b) => b.score-a.score).slice(0,3);
  const duplicateScore = closestMatches[0]?.score || 0;
  const candidateGarment:Garment = {
    id:"shopping-candidate", name:input.candidate.name, brand:"Shopping candidate", category:input.candidate.category,
    subcategory:input.candidate.subcategory, color:input.candidate.color, material:`${input.candidate.material} · inferred`,
    warmth:input.candidate.warmth, formality:input.candidate.formality, seasons:["Spring","Summer","Fall","Winter"],
    occasions:input.candidate.occasions, rainCompatible:input.candidate.rainCompatible, image:"", inventoryType:"owned",
    laundry:false, active:true, worn:0,
  };
  const generated = generateDailyDecision({ garments:[...owned,candidateGarment], context:input.context, profile:input.profile, signals:input.signals });
  const outfits = generated.recommendations.filter((item) => item.garmentIds.includes(candidateGarment.id) && item.score >= 70).slice(0,3);
  const ownedCategoryCount = owned.filter((item) => item.category === candidateGarment.category).length;
  const fillsGap = ownedCategoryCount < 2 || input.candidate.occasions.some((occasion) => !owned.some((item) => item.occasions.some((ownedOccasion) => contains(occasion, ownedOccasion))));
  const strongOutfitCount = outfits.length;
  const decision = duplicateScore >= .82 || strongOutfitCount === 0 ? "skip" : duplicateScore < .65 && strongOutfitCount >= 3 && fillsGap ? "buy" : "save";
  return {
    decision, duplicateScore, duplicateLabel:duplicateScore >= .82 ? "likely_duplicate" : duplicateScore >= .65 ? "similar" : "distinct",
    fillsGap, strongOutfitCount,
    rationale:decision === "buy" ? `It adds ${strongOutfitCount} strong outfits without duplicating your closet.` : decision === "skip" ? duplicateScore >= .82 ? "You already own a very similar piece." : "It does not complete a strong outfit with your current closet." : "Promising, but it overlaps enough to compare before buying.",
    closestMatches, outfits,
  };
}
