import { buildMirrorPrompt, buildScenePrompt } from "../try-on";
import type { GarmentRenderInput, MirrorTryOnInput, SceneTryOnInput, TryOnProvider, TryOnProviderOutput } from "./contracts";

export type TryOnOutput = TryOnProviderOutput;
export type { GarmentRenderInput, MirrorTryOnInput, SceneTryOnInput, TryOnProvider } from "./contracts";

class MockTryOnProvider implements TryOnProvider {
  async generateMirror(input: MirrorTryOnInput): Promise<TryOnOutput> { void input; return { provider:"mock",model:"exact-composition-preview",renderMode:"composition" }; }
  async generateScene(input: SceneTryOnInput): Promise<TryOnOutput> { void input; return { provider:"mock",model:"exact-composition-preview",renderMode:"composition" }; }
  async renderGarment(input: GarmentRenderInput): Promise<TryOnOutput> { return { provider: "mock", model: "original-cutout", imagePath: input.imageUrl }; }
}

class OpenAITryOnProvider implements TryOnProvider {
  private readonly model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  private readonly quality = process.env.OPENAI_IMAGE_QUALITY || "medium";

  private async edit(prompt: string, urls: string[]): Promise<TryOnOutput> {
    if (!process.env.OPENAI_API_KEY) throw new Error("TRY_ON_NOT_CONFIGURED");
    const form = new FormData();
    form.set("model", this.model);
    form.set("prompt", prompt);
    form.set("size", "1024x1536");
    form.set("quality", this.quality);
    form.set("input_fidelity", "high");
    form.set("output_format", "png");
    for (const [index, url] of urls.entries()) {
      const response = await fetch(url, { redirect: "error" });
      if (!response.ok) throw new Error("REFERENCE_IMAGE_UNAVAILABLE");
      form.append("image[]", await response.blob(), `reference-${index + 1}.png`);
    }
    const response = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form });
    if (!response.ok) throw new Error(`IMAGE_PROVIDER_${response.status}`);
    const data = await response.json() as { data?: Array<{ b64_json?: string }> };
    const image = data.data?.[0]?.b64_json;
    if (!image) throw new Error("IMAGE_PROVIDER_EMPTY");
    return { provider: "openai", model: this.model, imageDataUrl: `data:image/png;base64,${image}` };
  }

  generateMirror(input: MirrorTryOnInput) {
    return this.edit(buildMirrorPrompt(input.garments, { event: input.event, weather: input.weather }), [input.personImageUrl, ...input.garmentImageUrls]);
  }
  generateScene(input: SceneTryOnInput) { return this.edit(buildScenePrompt(input.scene), [input.mirrorImageUrl]); }
  renderGarment(input: GarmentRenderInput) { return this.edit(`Create a faithful dimensional product render of ${input.garmentName}. Preserve exact color, material, silhouette, pattern, and visible details. Isolate the garment on transparent background. No model, hanger, logo, text, or watermark.`, [input.imageUrl]); }
}

export function getTryOnProvider(): TryOnProvider {
  return process.env.LIVE_TRY_ON_ENABLED === "true" && process.env.TRY_ON_PROVIDER === "openai" ? new OpenAITryOnProvider() : new MockTryOnProvider();
}
