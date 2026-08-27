import type { Garment } from "./demo-data";

export const OUTFIT_ENGINE_VERSION = "owned_closet_v1";

export type TemperatureFeedback = "too_cold" | "just_right" | "too_warm";
export type StyleFeedback = "loved" | "not_for_me";
export type RecommendationType = "best_overall" | "most_polished" | "most_comfortable";

export type DailyContext = {
  date: string;
  timezone: string;
  dayType: string;
  activities: string[];
  source: "manual" | "calendar" | "mixed";
  weather: {
    departureFeelsLike: number;
    dayHigh: number;
    eveningFeelsLike: number;
    rainProbability: number;
    walking?: boolean;
    observedAt?: string;
  };
  manualOverride?: boolean;
};

export type WearSignal = {
  garmentIds: string[];
  wornOn: string;
  style?: StyleFeedback;
  temperature?: TemperatureFeedback;
};

export type RecommendationFactors = {
  occasion: number;
  warmth: number;
  formality: number;
  rain: number;
  comfort: number;
  style: number;
  feedback: number;
  rotation: number;
};

export type OutfitRecommendation = {
  id: string;
  rank: number;
  type: RecommendationType;
  title: string;
  garmentIds: string[];
  score: number;
  factors: RecommendationFactors;
  reason: string;
  note: string;
  warmth: number;
  formality: number;
  walking: string;
};

export type DailyDecision = {
  contextHash: string;
  engineVersion: typeof OUTFIT_ENGINE_VERSION;
  recommendations: OutfitRecommendation[];
  missingCategories: string[];
  cta?: string;
};

export type WardrobeProfile = {
  preferredFormality: number;
  favoriteColors: string[];
  avoidRules: string[];
  styleVibe: string;
};

export type ShoppingAttributes = {
  name: string;
  category: Garment["category"];
  subcategory: string;
  color: string;
  material: string;
  pattern: string;
  silhouette: string;
  formality: number;
  warmth: number;
  occasions: string[];
  confidence: number;
  rainCompatible: boolean;
};

export type ShoppingDecision = {
  decision: "buy" | "save" | "skip";
  duplicateScore: number;
  duplicateLabel: "likely_duplicate" | "similar" | "distinct";
  fillsGap: boolean;
  strongOutfitCount: number;
  rationale: string;
  closestMatches: Array<{ garmentId: string; score: number; reasons: string[] }>;
  outfits: OutfitRecommendation[];
};
