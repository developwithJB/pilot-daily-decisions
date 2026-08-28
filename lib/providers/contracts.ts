import type { Garment } from "../demo-data";

export const PROVIDER_CONTRACT_VERSION = "2026-08-27" as const;

export type ProviderMode = "demo" | "manual" | "live" | "disabled";
export type ProviderConfidence = "low" | "medium" | "high";

export type ProviderMetadata = {
  contractVersion: typeof PROVIDER_CONTRACT_VERSION;
  provider: string;
  mode: ProviderMode;
  fetchedAt: string;
  freshUntil?: string;
  confidence: ProviderConfidence;
};

export type ProviderResult<T> = {
  data: T;
  meta: ProviderMetadata;
  warnings: string[];
};

export type WeatherContextV1 = {
  location: string;
  timezone: string;
  currentTemperature: number;
  currentFeelsLike: number;
  dayHigh: number;
  eveningFeelsLike: number;
  rainProbability: number;
  windMph: number;
  humidity: number;
  condition: string;
  weatherFlags: string[];
  hours: Array<{ time: string; temperature: number }>;
};

export type WeatherRequest = {
  latitude?: number;
  longitude?: number;
  city?: string;
  manual?: Partial<WeatherContextV1>;
};

export interface WeatherProvider {
  readonly id: string;
  getForecast(input: WeatherRequest): Promise<ProviderResult<WeatherContextV1>>;
}

export type CalendarSignalV1 = {
  id: string;
  category: string;
  start: string;
  end: string;
  placeType: "home" | "office" | "outdoors" | "travel" | "other";
};

export interface CalendarProvider {
  readonly id: string;
  listSignals(input: { from: Date; to: Date }): Promise<ProviderResult<CalendarSignalV1[]>>;
}

export type MediaProvenance = {
  ownerId: string;
  source: "upload" | "camera" | "generated";
  createdAt: string;
  consentVersion?: string;
};

export interface BackgroundRemovalProvider {
  remove(imageUrl: string): Promise<{ provider: string; imageUrl?: string; imageDataUrl?: string }>;
}

export interface GarmentExtractionProvider {
  extract(input: { privateImageUrl: string; ownerId: string }): Promise<ProviderResult<Array<{ label: string; confidence: number }>>>;
}

export type TryOnProviderOutput = {
  provider: string;
  model: string;
  renderMode?: "image" | "composition";
  imageDataUrl?: string;
  imagePath?: string;
};

export type MirrorTryOnInput = { personImageUrl: string; garmentImageUrls: string[]; garments: Garment[]; event: string; weather: string };
export type SceneTryOnInput = { mirrorImageUrl: string; scene: string; lookId?: string };
export type GarmentRenderInput = { imageUrl: string; garmentName: string };

export interface TryOnProvider {
  generateMirror(input: MirrorTryOnInput): Promise<TryOnProviderOutput>;
  generateScene(input: SceneTryOnInput): Promise<TryOnProviderOutput>;
  renderGarment(input: GarmentRenderInput): Promise<TryOnProviderOutput>;
}

export type Avatar3DAssetV1 = {
  id: string;
  format: "gltf" | "glb" | "vrm";
  privateAssetPath: string;
  generatedFrom: "demo-fixture" | "reference-photos";
  status: "queued" | "processing" | "ready" | "failed" | "disabled";
};

export interface Avatar3DProvider {
  readonly id: string;
  createAvatar(input: { ownerId: string; referencePhotoPaths: string[] }): Promise<ProviderResult<Avatar3DAssetV1>>;
}

export interface GarmentFittingProvider {
  readonly id: string;
  fit(input: { ownerId: string; avatarAssetPath: string; garmentAssetPaths: string[] }): Promise<ProviderResult<{ fittedAssetPath: string; format: "gltf" | "glb" | "vrm" }>>;
}
