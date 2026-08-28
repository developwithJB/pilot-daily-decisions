"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { CalendarDays, Check, ChevronLeft, ChevronRight, CloudSun, ImagePlus, LockKeyhole, Shirt, Sparkles, Upload } from "lucide-react";
import { parseIcsSignals } from "../lib/calendar-ics";
import type { StarterWardrobeChoice } from "../lib/starter-wardrobes";

type Step = "weather" | "calendar" | "photos" | "closet" | "ready";
type SetupState = {
  weather: { mode: "city" | "location" | "manual"; city: string; temperature: string; rain: string; status: string };
  calendar: { mode: "google" | "ics" | "manual" | "skip"; summary: string; eventCount: number };
  photos: { consent: boolean; names: string[]; stored: boolean };
  wardrobe: StarterWardrobeChoice;
  completedAt?: string;
};

const steps: Array<{ id: Step; label: string }> = [
  { id: "weather", label: "Weather" },
  { id: "calendar", label: "Calendar" },
  { id: "photos", label: "Add yourself" },
  { id: "closet", label: "Build closet" },
  { id: "ready", label: "Ready" },
];
const initialState: SetupState = {
  weather: { mode: "city", city: "Chicago", temperature: "68", rain: "0", status: "Not checked" },
  calendar: { mode: "manual", summary: "", eventCount: 0 },
  photos: { consent: false, names: [], stored: false },
  wardrobe: "neutral",
};

function loadState(): SetupState {
  if (typeof window === "undefined") return initialState;
  try {
    return { ...initialState, ...JSON.parse(localStorage.getItem("pilot-onboarding-v1") || "{}") } as SetupState;
  } catch {
    return initialState;
  }
}

const processPhoto = async (file: File) => {
  const image = new Image();
  const objectUrl = URL.createObjectURL(file);
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("PHOTO_READ_FAILED"));
    image.src = objectUrl;
  });
  const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(objectUrl);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
  if (!blob) throw new Error("PHOTO_PROCESS_FAILED");
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" });
};

export default function ProfessionalOnboarding({ settings = false }: { settings?: boolean }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<SetupState>(initialState);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const loaded = useRef(false);
  const roadmap = process.env.NEXT_PUBLIC_ROADMAP_BUNDLE_ENABLED === "true";
  useEffect(() => { queueMicrotask(() => { setState(loadState()); loaded.current = true; }); }, []);
  useEffect(() => { if (loaded.current) localStorage.setItem("pilot-onboarding-v1", JSON.stringify(state)); }, [state]);
  const current = steps[stepIndex].id;
  const progress = useMemo(() => Math.round(((stepIndex + 1) / steps.length) * 100), [stepIndex]);

  const checkWeather = async (mode = state.weather.mode) => {
    setBusy(true); setMessage("");
    try {
      let query = new URLSearchParams();
      if (mode === "location") {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 }));
        query = new URLSearchParams({ lat: String(position.coords.latitude), lon: String(position.coords.longitude) });
      } else if (mode === "manual") {
        query = new URLSearchParams({ source: "manual", city: state.weather.city, temperature: state.weather.temperature, rain: state.weather.rain });
      } else query = new URLSearchParams({ city: state.weather.city });
      const response = await fetch(`/api/weather?${query}`);
      const result = await response.json() as { location?: string; condition?: string; currentTemperature?: number; message?: string };
      if (!response.ok) throw new Error(result.message || "Weather unavailable");
      const status = `${result.location}: ${result.currentTemperature}° · ${result.condition}`;
      setState((value) => ({ ...value, weather: { ...value.weather, mode, status } }));
      setMessage("Weather is ready.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Weather unavailable. Use manual conditions."); }
    finally { setBusy(false); }
  };

  const importIcs = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const signals = parseIcsSignals(await file.text());
      setState((value) => ({ ...value, calendar: { mode: "ics", summary: `${signals.length} broad schedule signals imported locally`, eventCount: signals.length } }));
      setMessage("Imported locally. Event descriptions, guests, and locations were not retained.");
    } catch { setMessage("That calendar file could not be read. Use an .ics export under 2 MB."); }
  };

  const addPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).slice(0, 3);
    if (!files.length) return;
    if (!state.photos.consent) { setMessage("Confirm consent before adding reference photos."); return; }
    setBusy(true); setMessage("");
    try {
      const processed = await Promise.all(files.map(processPhoto));
      let stored = false;
      if (roadmap) {
        for (const photo of processed) {
          const form = new FormData(); form.set("photo", photo);
          const response = await fetch("/api/reference-photos", { method: "POST", body: form });
          if (!response.ok) throw new Error("A photo could not be saved. Sign in and try again.");
        }
        stored = true;
      }
      setState((value) => ({ ...value, photos: { ...value.photos, names: processed.map((file) => file.name), stored } }));
      setMessage(stored ? "Encrypted private photos saved." : "Demo preview complete. Photo bytes were processed in this browser and not stored.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Photos could not be processed."); }
    finally { setBusy(false); event.target.value = ""; }
  };

  const next = () => setStepIndex((value) => Math.min(steps.length - 1, value + 1));
  const finish = () => {
    const completedAt = new Date().toISOString();
    const complete = { ...state, completedAt };
    setState(complete);
    localStorage.setItem("pilot-onboarding-v1", JSON.stringify(complete));
    window.location.assign("/");
  };

  return <main className="setup-shell">
    <header className="setup-header">
      <Link className="setup-brand" href="/">pilot</Link>
      <span>{settings ? "Connections & setup" : "Private, guided setup"}</span>
    </header>
    <section className="setup-card" aria-labelledby="setup-title">
      <div className="onboarding-progress" aria-label={`Step ${stepIndex + 1} of ${steps.length}`}>
        <div className="onboarding-progress-bar"><span style={{ width: `${progress}%` }} /></div>
        <ol>{steps.map((step, index) => <li className={index <= stepIndex ? "active" : ""} key={step.id}>{index < stepIndex ? <Check aria-hidden="true" /> : index + 1}<span>{step.label}</span></li>)}</ol>
      </div>

      {current === "weather" && <div className="setup-panel">
        <CloudSun aria-hidden="true" className="setup-icon" />
        <p className="eyebrow">1 · Weather</p><h1 id="setup-title">Dress for the day ahead</h1>
        <p>Use live Open-Meteo data with no API key, or enter conditions yourself.</p>
        <div className="setup-choice-row">
          <button className={state.weather.mode === "city" ? "selected" : ""} onClick={() => setState((value) => ({ ...value, weather: { ...value.weather, mode: "city" } }))}>Search city</button>
          <button className={state.weather.mode === "location" ? "selected" : ""} onClick={() => setState((value) => ({ ...value, weather: { ...value.weather, mode: "location" } }))}>Current location</button>
          <button className={state.weather.mode === "manual" ? "selected" : ""} onClick={() => setState((value) => ({ ...value, weather: { ...value.weather, mode: "manual" } }))}>Enter manually</button>
        </div>
        {state.weather.mode !== "location" && <label>City<input value={state.weather.city} onChange={(event) => setState((value) => ({ ...value, weather: { ...value.weather, city: event.target.value } }))} /></label>}
        {state.weather.mode === "manual" && <div className="setup-fields"><label>Temperature °F<input inputMode="numeric" value={state.weather.temperature} onChange={(event) => setState((value) => ({ ...value, weather: { ...value.weather, temperature: event.target.value } }))} /></label><label>Rain chance %<input inputMode="numeric" value={state.weather.rain} onChange={(event) => setState((value) => ({ ...value, weather: { ...value.weather, rain: event.target.value } }))} /></label></div>}
        <button className="setup-secondary" disabled={busy} onClick={() => checkWeather()}>{busy ? "Checking…" : "Check weather"}</button>
        <p className="setup-status" role="status">{message || state.weather.status}</p>
      </div>}

      {current === "calendar" && <div className="setup-panel">
        <CalendarDays aria-hidden="true" className="setup-icon" />
        <p className="eyebrow">2 · Calendar</p><h1 id="setup-title">Add only the context you need</h1>
        <p>pilot reduces schedule data to broad signals such as Office, Dinner, or Travel. It does not need descriptions, guests, or locations.</p>
        <div className="setup-stack">
          <a className="setup-primary" href="/api/calendar/connect">Connect Google Calendar (read only)</a>
          <label className="setup-upload"><Upload aria-hidden="true" /> Import an .ics file locally<input type="file" accept=".ics,text/calendar" onChange={importIcs} /></label>
          <label>Or describe the day<textarea placeholder="Office, client presentation, then dinner" value={state.calendar.summary} onChange={(event) => setState((value) => ({ ...value, calendar: { ...value.calendar, mode: "manual", summary: event.target.value } }))} /></label>
          <button className="setup-text-button" onClick={() => setState((value) => ({ ...value, calendar: { mode: "skip", summary: "Skipped for now", eventCount: 0 } }))}>Skip calendar</button>
        </div><p className="setup-status" role="status">{message || state.calendar.summary}</p>
      </div>}

      {current === "photos" && <div className="setup-panel">
        <ImagePlus aria-hidden="true" className="setup-icon" />
        <p className="eyebrow">3 · Add yourself</p><h1 id="setup-title">Optional reference photos</h1>
        <p>Use a well-lit, full-body front photo. Side and back views improve consistency. These support a styling preview—not body measurement or fit simulation.</p>
        <div className="privacy-note"><LockKeyhole aria-hidden="true" /><span>{roadmap ? "Photos are stripped of metadata, stored privately, and served only by short-lived signed URLs." : "Demo mode processes the files in your browser and does not upload or persist them."}</span></div>
        <label className="setup-consent"><input type="checkbox" checked={state.photos.consent} onChange={(event) => setState((value) => ({ ...value, photos: { ...value.photos, consent: event.target.checked } }))} /> I own these photos and consent to using them for private previews.</label>
        <label className="setup-upload"><ImagePlus aria-hidden="true" /> Add front, side, and back photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addPhotos} /></label>
        <p className="setup-status" role="status">{message || (state.photos.names.length ? `${state.photos.names.length} photo${state.photos.names.length === 1 ? "" : "s"} ready` : "You can skip this and use exact garment composition.")}</p>
      </div>}

      {current === "closet" && <div className="setup-panel">
        <Shirt aria-hidden="true" className="setup-icon" />
        <p className="eyebrow">4 · Build closet</p><h1 id="setup-title">Start with examples or your own clothes</h1>
        <p>Example wardrobes are labeled and never counted as owned items. Replace them with scans whenever you are ready.</p>
        <div className="setup-wardrobes">{([['menswear','Menswear examples'],['womenswear','Womenswear examples'],['neutral','Neutral examples'],['empty','Start empty']] as Array<[StarterWardrobeChoice,string]>).map(([id,label]) => <button key={id} className={state.wardrobe === id ? "selected" : ""} onClick={() => setState((value) => ({ ...value, wardrobe: id }))}><span>{label}</span><small>{id === "empty" ? "Add only your real garments" : "8 clearly labeled sample items"}</small></button>)}</div>
        <Link className="setup-secondary" href="/closet">Open bulk closet scanner</Link>
      </div>}

      {current === "ready" && <div className="setup-panel setup-ready">
        <Sparkles aria-hidden="true" className="setup-icon" />
        <p className="eyebrow">5 · Ready</p><h1 id="setup-title">Your daily decision system is ready</h1>
        <p>pilot combines trusted context, then gives you a deterministic recommendation you can inspect and correct.</p>
        <ul><li><Check /> {state.weather.status}</li><li><Check /> {state.calendar.summary || "Calendar skipped"}</li><li><Check /> {state.photos.names.length ? `${state.photos.names.length} reference photos prepared` : "Reference photos skipped"}</li><li><Check /> {state.wardrobe === "empty" ? "Empty personal closet" : `${state.wardrobe} example wardrobe selected`}</li></ul>
        <button className="setup-primary" onClick={finish}>Go to Today</button>
        <Link className="setup-secondary" href="/avatar">Explore the honest 3D preview</Link>
      </div>}

      {current !== "ready" && <footer className="setup-actions"><button className="setup-back" disabled={stepIndex === 0} onClick={() => setStepIndex((value) => Math.max(0, value - 1))}><ChevronLeft /> Back</button><button className="setup-primary" onClick={next}>{current === "photos" ? "Continue or skip" : "Continue"}<ChevronRight /></button></footer>}
    </section>
    <p className="setup-footnote">You stay in control. Disconnect providers and delete private media from Settings at any time.</p>
  </main>;
}
