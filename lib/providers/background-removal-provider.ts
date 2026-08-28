import type { BackgroundRemovalProvider } from "./contracts";

export type { BackgroundRemovalProvider } from "./contracts";

class MockBackgroundRemovalProvider implements BackgroundRemovalProvider {
  async remove(imageUrl: string) { return { provider: "mock", imageUrl }; }
}

class RembgHttpProvider implements BackgroundRemovalProvider {
  async remove(imageUrl: string) {
    if (!process.env.REMBG_SERVICE_URL) throw new Error("BACKGROUND_REMOVAL_NOT_CONFIGURED");
    const response = await fetch(process.env.REMBG_SERVICE_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrl }) });
    if (!response.ok) throw new Error(`BACKGROUND_REMOVAL_${response.status}`);
    const data = await response.json() as { imageDataUrl?: string };
    return { provider: "rembg_http", imageDataUrl: data.imageDataUrl };
  }
}

export function getBackgroundRemovalProvider(): BackgroundRemovalProvider {
  return process.env.BACKGROUND_REMOVAL_PROVIDER === "rembg_http" ? new RembgHttpProvider() : new MockBackgroundRemovalProvider();
}
