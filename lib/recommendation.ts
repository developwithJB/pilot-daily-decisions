import type { Garment } from "./demo-data";

export type RecommendationInput = {
  weather: { departureFeelsLike:number; dayHigh:number; eveningFeelsLike:number; rainProbability:number };
  day: { formality:number; occasions:string[] };
  garments: Garment[];
};

export function viableGarments(input: RecommendationInput) {
  return input.garments.filter((garment) => {
    if (!garment.active || garment.laundry) return false;
    if (input.weather.rainProbability >= 50 && !garment.rainCompatible) return false;
    if (input.weather.dayHigh >= 75 && garment.warmth >= 5) return false;
    if (input.weather.departureFeelsLike <= 50 && garment.warmth <= 1 && garment.category === "Outerwear") return false;
    return Math.abs(garment.formality - input.day.formality) <= 2 || garment.category === "Outerwear";
  });
}

export function validateGarmentIds(ids: string[], supplied: Garment[]) {
  const allowed = new Set(supplied.map((garment) => garment.id));
  return ids.length > 0 && ids.every((id) => allowed.has(id));
}
