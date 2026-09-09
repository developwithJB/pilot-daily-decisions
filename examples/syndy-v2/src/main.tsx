/// <reference types="vite/client" />
/* This standalone Vite example does not use Next image or routing components. */
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Expand,
  Footprints,
  ImagePlus,
  Layers,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  Scan,
  Shirt,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { KeyedModel } from "./KeyedModel";
import "./style.css";
import { DailyContext } from "./DailyContext";

const outfits = [
  {
    id: "tailored",
    name: "Everyday, elevated",
    occasion: "Office to wherever",
    description:
      "Soft layers. Sharp lines. The original layered look, all the way around.",
    pieces: [
      ["stone-fluid-trench", "Stone fluid trench", "Outer layer"],
      ["oatmeal-merino-crew", "Oatmeal merino crew", "Knitwear"],
      ["charcoal-tailored-trouser", "Charcoal tailored trouser", "Bottoms"],
      ["cognac-penny-loafer", "Cognac penny loafer", "Shoes"],
    ],
  },
  {
    id: "evening",
    name: "A little after dark",
    occasion: "Dinner & celebrations",
    description:
      "Cobalt draping and a flash of gold. See the dress, the movement, and every angle of the heels.",
    pieces: [
      ["cobalt-draped-midi", "Cobalt draped midi", "Dress"],
      ["gold-ankle-strap-heel", "Gold ankle-strap heel", "Shoes"],
    ],
  },
];
const environments = [
  { id: "studio", name: "The studio", light: "Soft daylight" },
  { id: "riverwalk", name: "Chicago riverwalk", light: "City daylight" },
  { id: "rooftop", name: "Golden-hour rooftop", light: "Warm evening" },
];
const stored = () => {
  try {
    const v = JSON.parse(localStorage.getItem("syndy-v2-look") || "null");
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
};
function App() {
  const [outfitId, setOutfitId] = useState(() =>
    outfits.some((o) => o.id === stored()?.outfit)
      ? stored().outfit
      : "tailored",
  );
  const [scene, setScene] = useState(() =>
    environments.some((e) => e.id === stored()?.scene)
      ? stored().scene
      : "studio",
  );
  const [custom, setCustom] = useState<{ url: string; name: string } | null>(
    null,
  );
  const [angle, setAngle] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [focus, setFocus] = useState<"body" | "detail" | "shoes">("body");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [about, setAbout] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const drag = useRef<{ x: number; angle: number } | null>(null);
  const outfit = outfits.find((o) => o.id === outfitId)!;
  const environment = environments.find((e) => e.id === scene);
  const background =
    scene === "custom" && custom
      ? custom.url
      : `/assets/${environment?.id || "studio"}.png`;
  const sceneName = scene === "custom" ? custom?.name : environment?.name;
  useEffect(
    () => () => {
      if (custom) URL.revokeObjectURL(custom.url);
    },
    [custom],
  );
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExpanded(false);
        setAbout(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  const rotate = (a: number) => {
    if (!ready || !video.current || !Number.isFinite(video.current.duration))
      return;
    const next = ((a % 360) + 360) % 360;
    video.current.pause();
    setPlaying(false);
    video.current.currentTime =
      (next / 360) * Math.max(0, video.current.duration - 0.05);
    setAngle(next);
  };
  const changeOutfit = (id: string) => {
    if (id === outfitId) return;
    video.current?.pause();
    setPlaying(false);
    setReady(false);
    setAngle(0);
    setError("");
    setOutfitId(id);
  };
  const togglePlay = async () => {
    if (!video.current || !ready) return;
    if (playing) {
      video.current.pause();
      setPlaying(false);
    } else {
      try {
        await video.current.play();
        setPlaying(true);
      } catch {
        setError("Playback was blocked. Try pressing Play again.");
      }
    }
  };
  const upload = (file?: File) => {
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 15 * 1024 * 1024
    ) {
      setNotice("Choose a JPG, PNG, or WebP image under 15 MB.");
      return;
    }
    const url = URL.createObjectURL(file);
    const check = new Image();
    check.onload = () => {
      setCustom({ url, name: file.name.replace(/\.[^.]+$/, "") });
      setScene("custom");
      setNotice("Your environment is ready. It stays in this browser session.");
    };
    check.onerror = () => {
      URL.revokeObjectURL(url);
      setNotice("That image could not be opened. Try another file.");
    };
    check.src = url;
  };
  const save = () => {
    try {
      localStorage.setItem(
        "syndy-v2-look",
        JSON.stringify({
          outfit: outfitId,
          scene: scene === "custom" ? "studio" : scene,
        }),
      );
      setNotice(
        scene === "custom"
          ? "Outfit saved. Custom backgrounds last for this session."
          : "Look saved on this device.",
      );
    } catch {
      setNotice("Your browser could not save this look.");
    }
  };
  const download = async () => {
    if (!canvas.current || !stage.current) return;
    try {
      const box = stage.current.getBoundingClientRect(),
        model = canvas.current.getBoundingClientRect();
      const output = document.createElement("canvas");
      output.width = Math.round(box.width * 2);
      output.height = Math.round(box.height * 2);
      const ctx = output.getContext("2d")!;
      const bg = new Image();
      bg.src = background;
      await bg.decode();
      const s = Math.max(output.width / bg.width, output.height / bg.height);
      ctx.drawImage(
        bg,
        (output.width - bg.width * s) / 2,
        (output.height - bg.height * s) / 2,
        bg.width * s,
        bg.height * s,
      );
      ctx.drawImage(
        canvas.current,
        (model.left - box.left) * 2,
        (model.top - box.top) * 2,
        model.width * 2,
        model.height * 2,
      );
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.fillRect(20, output.height - 65, output.width - 40, 45);
      ctx.fillStyle = "#242820";
      ctx.font = "20px sans-serif";
      ctx.fillText(
        `SYNDY · ${outfit.name} · AI visual preview`,
        35,
        output.height - 36,
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        output.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error();
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `syndy-${outfitId}-${Math.round(angle)}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Your outfit snapshot is downloaded.");
    } catch {
      setNotice(
        "The snapshot could not be exported. Wait for the preview and try again.",
      );
    }
  };
  return (
    <div className="app-shell">
      <aside className="rail">
        <a className="brand" href="/" aria-label="Syndy studio home">
          p<span>:</span>
        </a>
        <div className="rail-items">
          <button
            className="rail-active"
            title="Fitting studio"
            aria-label="Fitting studio"
            onClick={() =>
              stage.current?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <Scan />
            <span>Studio</span>
          </button>
          <button
            title="Your looks"
            aria-label="Your looks"
            onClick={() =>
              document
                .getElementById("wardrobe")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <Shirt />
            <span>Looks</span>
          </button>
          <button
            title="About your avatar"
            aria-label="About your avatar"
            onClick={() => setAbout(true)}
          >
            <UserRound />
            <span>Avatar</span>
          </button>
        </div>
        <span className="rail-version">V2</span>
      </aside>
      <main>
        <header className="topbar">
          <div className="wordmark">
            pilot<span>:</span> <span className="divider">/</span>{" "}
            <span className="product">SYNDY STUDIO</span>
            <span className="version">V2</span>
          </div>
          <div className="profile">
            <span className="online-dot" />
            Local preview <span className="profile-initial">S</span>
          </div>
        </header>
        <div className="page-heading">
          <div>
            <p className="eyebrow">YOUR DIGITAL SELF. EVERY ANGLE.</p>
            <h1>Make it yours.</h1>
            <p>Your outfits. Your shoes. Wherever life takes you.</p>
          </div>
          <button className="save-button" onClick={save}>
            <Check size={16} /> Save this look
          </button>
        </div>
        <DailyContext onChoose={changeOutfit} />
        <div className="workspace">
          <section
            className={`studio ${expanded ? "expanded" : ""}`}
            aria-label="Interactive fitting studio"
          >
            <div
              className={`stage focus-${focus}`}
              ref={stage}
              style={{ backgroundImage: `url("${background}")` }}
            >
              <div className="stage-top">
                <span className="scene-pill">
                  <MapPin size={13} />
                  {sceneName}
                </span>
                <button
                  className="round-button"
                  onClick={() => setExpanded(!expanded)}
                  aria-label={
                    expanded ? "Close expanded preview" : "Expand preview"
                  }
                >
                  {expanded ? <X size={17} /> : <Expand size={17} />}
                </button>
              </div>
              <div className="avatar-label">
                <span className="online-dot" />
                <div>
                  <strong>Sample model</strong>
                  <small>Fictional avatar · V2</small>
                </div>
              </div>
              <div
                className="model-interaction"
                role="slider"
                aria-label="Drag to rotate the model, or use arrow keys"
                aria-valuemin={0}
                aria-valuemax={359}
                aria-valuenow={Math.round(angle)}
                aria-valuetext={`Approximately ${Math.round(angle)} degrees`}
                aria-disabled={!ready}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    rotate(angle + (e.key === "ArrowRight" ? 15 : -15));
                  }
                }}
                onPointerDown={(e) => {
                  if (!ready) return;
                  drag.current = { x: e.clientX, angle };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (drag.current)
                    rotate(
                      drag.current.angle + (e.clientX - drag.current.x) * 0.8,
                    );
                }}
                onPointerUp={() => {
                  drag.current = null;
                }}
                onPointerCancel={() => {
                  drag.current = null;
                }}
                onLostPointerCapture={() => {
                  drag.current = null;
                }}
              >
                <div className="model-position">
                  <KeyedModel
                    videoRef={video}
                    canvasRef={canvas}
                    poster={`/assets/${outfitId}.png`}
                    onError={setError}
                  />
                </div>
              </div>
              <video
                key={outfitId}
                ref={video}
                src={`/assets/${outfitId}.mp4`}
                muted
                playsInline
                loop
                preload="auto"
                className="source-video"
                aria-hidden="true"
                onLoadedData={() => {
                  setReady(true);
                  setError("");
                }}
                onTimeUpdate={() => {
                  if (video.current && !video.current.paused)
                    setAngle(
                      (video.current.currentTime / video.current.duration) *
                        360,
                    );
                }}
                onError={() => {
                  setReady(false);
                  setPlaying(false);
                  setError(
                    "Rotation could not load. The front-view image is still available.",
                  );
                }}
              />
              <div className="focus-tools" aria-label="Inspect outfit">
                <button
                  aria-pressed={focus === "body"}
                  onClick={() => setFocus("body")}
                  title="Full body"
                >
                  <UserRound />
                  <span>Full body</span>
                </button>
                <button
                  aria-pressed={focus === "detail"}
                  onClick={() => setFocus("detail")}
                  title="Fabric detail"
                >
                  <Layers />
                  <span>Detail</span>
                </button>
                <button
                  aria-pressed={focus === "shoes"}
                  onClick={() => setFocus("shoes")}
                  title="Shoe close-up"
                >
                  <Footprints />
                  <span>Shoes</span>
                </button>
              </div>
              <div className="stage-caption">
                <span>
                  <RotateCcw size={13} />
                  {ready
                    ? "Drag to explore every angle"
                    : "Preparing your rotating preview…"}
                </span>
                <span>AI VISUAL PREVIEW</span>
              </div>
            </div>
            <div className="rotation-bar">
              <button
                className="play-button"
                disabled={!ready}
                onClick={togglePlay}
                aria-label={playing ? "Pause rotation" : "Play rotation"}
              >
                {playing ? <Pause size={17} /> : <Play size={17} />}
              </button>
              <button
                className="angle-arrow"
                disabled={!ready}
                onClick={() => rotate(angle - 45)}
                aria-label="Rotate left"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="rotation-track">
                <label htmlFor="rotation">
                  360° view <span>Approx. {Math.round(angle)}°</span>
                </label>
                <input
                  id="rotation"
                  aria-label="Rotation angle"
                  type="range"
                  min="0"
                  max="359"
                  step="1"
                  value={angle}
                  disabled={!ready}
                  onChange={(e) => rotate(Number(e.target.value))}
                />
                <div className="angle-labels">
                  {[
                    ["Front", 0],
                    ["Right", 90],
                    ["Back", 180],
                    ["Left", 270],
                  ].map(([name, a]) => (
                    <button
                      key={name}
                      disabled={!ready}
                      onClick={() => rotate(Number(a))}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
              <button
                className="angle-arrow"
                disabled={!ready}
                onClick={() => rotate(angle + 45)}
                aria-label="Rotate right"
              >
                <ArrowRight size={16} />
              </button>
              <button
                className="export-button"
                onClick={download}
                aria-label="Download outfit snapshot"
              >
                <ArrowDownToLine size={18} />
              </button>
            </div>
            {error && (
              <div className="error" role="alert">
                {error}
                <button
                  onClick={() => {
                    setError("");
                    video.current?.load();
                  }}
                >
                  Retry
                </button>
              </div>
            )}
            <div className="environment-heading">
              <div>
                <p className="eyebrow">SET THE SCENE</p>
                <h2>A change of scenery.</h2>
              </div>
              <span>Same you. A new perspective.</span>
            </div>
            <div className="environments">
              {environments.map((e) => (
                <button
                  key={e.id}
                  className={`environment ${scene === e.id ? "selected" : ""}`}
                  aria-pressed={scene === e.id}
                  onClick={() => setScene(e.id)}
                >
                  <img src={`/assets/${e.id}.png`} alt="" />
                  <span className="environment-copy">
                    <strong>{e.name}</strong>
                    <small>{e.light}</small>
                  </span>
                  {scene === e.id && (
                    <span className="environment-check">
                      <Check size={13} />
                    </span>
                  )}
                </button>
              ))}
              <button
                className={`environment upload-scene ${scene === "custom" ? "selected" : ""}`}
                onClick={() =>
                  custom ? setScene("custom") : input.current?.click()
                }
                aria-pressed={scene === "custom"}
              >
                {custom ? (
                  <img src={custom.url} alt="" />
                ) : (
                  <ImagePlus size={24} />
                )}
                <span className="environment-copy">
                  <strong>
                    {custom ? "Your environment" : "Somewhere else?"}
                  </strong>
                  <small>{custom ? "Uploaded by you" : "Upload a scene"}</small>
                </span>
              </button>
            </div>
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              aria-label="Upload environment image"
              onChange={(e) => {
                upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {custom && (
              <button
                className="text-button"
                onClick={() => input.current?.click()}
              >
                Replace your environment image
              </button>
            )}
            <p className="preview-note">
              Generated rotation with composited environments. Lighting stays
              fixed; angles and garment details are approximate. This preview
              does not measure fit.
            </p>
          </section>
          <aside className="wardrobe" id="wardrobe">
            <div className="wardrobe-top">
              <div>
                <p className="eyebrow">THE LOOK</p>
                <h2>Good on you.</h2>
              </div>
              <Shirt size={20} />
            </div>
            <div className="look-switch" aria-label="Choose outfit">
              {outfits.map((o, i) => (
                <button
                  key={o.id}
                  aria-pressed={outfitId === o.id}
                  onClick={() => changeOutfit(o.id)}
                >
                  <span className={`look-dot look-${o.id}`} />
                  {i === 0 ? "Everyday" : "Evening"}
                  {outfitId === o.id && <Check size={13} />}
                </button>
              ))}
            </div>
            <div className="look-description">
              <span>{outfit.occasion}</span>
              <h3>{outfit.name}</h3>
              <p>{outfit.description}</p>
            </div>
            <div className="pieces-heading">
              <span>IN THIS OUTFIT</span>
              <span>{outfit.pieces.length} pieces</span>
            </div>
            <div className="garment-list">
              {outfit.pieces.map(([id, name, category]) => (
                <button
                  key={id}
                  className="garment"
                  onClick={() => {
                    setFocus(category === "Shoes" ? "shoes" : "detail");
                    if (window.innerWidth < 800)
                      stage.current?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <span className="garment-image">
                    <img src={`/assets/${id}.png`} alt={name} />
                  </span>
                  <span>
                    <small>{category}</small>
                    <strong>{name}</strong>
                    <em>
                      {category === "Shoes"
                        ? "Inspect the shoes"
                        : "Inspect details"}{" "}
                      <ArrowRight size={11} />
                    </em>
                  </span>
                </button>
              ))}
            </div>
            <div className="stylist-note">
              <Sparkles size={18} />
              <div>
                <strong>The details make the difference.</strong>
                <p>
                  {outfitId === "tailored"
                    ? "Turn to see the trench silhouette. Switch to Shoes for a closer look at the loafers."
                    : "See how the drape falls from the back. Zoom in to explore the gold heels."}
                </p>
              </div>
            </div>
            <button className="snapshot" onClick={download}>
              <ArrowDownToLine size={16} /> Download this angle
            </button>
            <div className="made-with">
              <span className="online-dot" />
              GPT Image 2.5 + Higgsfield
              <button
                onClick={() => setAbout(!about)}
                aria-expanded={about}
                aria-label="Generation details"
              >
                <ChevronDown size={15} />
              </button>
            </div>
            {about && (
              <div className="about">
                <strong>A reproducible open-source sample.</strong>
                <p>
                  The bundled sample models are fictional. GPT Image 2.5 creates
                  the stills. Seedance 2.5 on Higgsfield generates the turntable
                  footage. The viewer removes the green backdrop in your
                  browser, so any uploaded scene can become the setting.
                </p>
                <p>
                  This is a generated 360° video preview, not a 3D body scan.
                  Two outfits are pre-rendered; changing individual garments
                  requires a new render.
                </p>
                <button className="text-button" onClick={() => setAbout(false)}>
                  Close details
                </button>
              </div>
            )}
          </aside>
        </div>
        <footer>
          <span>SYNDY STUDIO</span>
          <span>A little more you. A lot more possibility.</span>
          <span>LOCAL EDITION / 02</span>
        </footer>
      </main>
      <div
        className={`toast ${notice ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {notice}
      </div>
    </div>
  );
}
const root = createRoot(document.getElementById("root")!);
root.render(<App />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
