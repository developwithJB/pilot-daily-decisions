import Avatar3DViewer from "../Avatar3DViewer";
import Link from "next/link";

export default function AvatarPage() {
  return <main className="avatar-page">
    <header><Link href="/">pilot</Link><span>Experimental 3D preview</span></header>
    <section className="avatar-intro">
      <p className="eyebrow">Optional · provider-gated</p>
      <h1>A real 3D viewer with honest limits</h1>
      <p>This interactive scene can load GLTF, GLB, or VRM-compatible assets through a server-side provider. The included mannequin proves rotation and view controls without pretending to reproduce your body.</p>
    </section>
    <Avatar3DViewer />
    <aside className="avatar-disclosure"><strong>What this is:</strong> a visual styling aid for silhouette and color. <strong>What it is not:</strong> body measurement, garment physics, tailoring advice, or a guarantee of fit. Production avatar generation remains off until a reviewed provider and retention policy are configured.</aside>
    <nav><Link href="/onboarding">Return to guided setup</Link><Link href="/try-on">Use exact garment composition</Link></nav>
  </main>;
}
