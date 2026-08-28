import { PROVIDER_CONTRACT_VERSION, type Avatar3DAssetV1, type Avatar3DProvider, type ProviderResult } from "./contracts";

const nowMeta = (provider: string, mode: "demo" | "disabled") => ({
  contractVersion: PROVIDER_CONTRACT_VERSION,
  provider,
  mode,
  fetchedAt: new Date().toISOString(),
  confidence: mode === "demo" ? "high" as const : "low" as const,
});

export class DemoAvatar3DProvider implements Avatar3DProvider {
  readonly id = "procedural-demo";
  async createAvatar(): Promise<ProviderResult<Avatar3DAssetV1>> {
    return {
      data: { id: "demo-avatar-v1", format: "gltf", privateAssetPath: "/assets/avatar/pilot-demo-avatar.gltf", generatedFrom: "demo-fixture", status: "ready" },
      meta: nowMeta(this.id, "demo"),
      warnings: ["This is a generic 3D mannequin for interaction testing. It is not generated from your body or measurements."],
    };
  }
}

export class DisabledAvatar3DProvider implements Avatar3DProvider {
  readonly id = "disabled";
  async createAvatar(): Promise<ProviderResult<Avatar3DAssetV1>> {
    return {
      data: { id: "disabled", format: "gltf", privateAssetPath: "", generatedFrom: "reference-photos", status: "disabled" },
      meta: nowMeta(this.id, "disabled"),
      warnings: ["3D avatar generation is not configured. Set AVATAR_3D_ENABLED=true and implement a server-side provider adapter."],
    };
  }
}

export function getAvatar3DProvider(environment: Record<string, string | undefined> = process.env): Avatar3DProvider {
  return environment.DEMO_MODE === "true" || environment.NEXT_PUBLIC_DEMO_MODE === "true"
    ? new DemoAvatar3DProvider()
    : new DisabledAvatar3DProvider();
}
