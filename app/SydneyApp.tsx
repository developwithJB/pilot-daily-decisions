"use client";
/* eslint-disable @next/next/no-img-element */

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  Brain,
  CalendarDays,
  Check,
  ChevronRight,
  CloudRain,
  CloudSun,
  Columns3,
  Download,
  Droplets,
  FileUp,
  Grid2X2,
  Heart,
  History,
  Home,
  ImagePlus,
  Info,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  MoreHorizontal,
  Plus,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Share2,
  Shirt,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  UserRound,
  WandSparkles,
  Wind,
  X,
} from "lucide-react";
import {
  Category,
  demoHistory,
  Garment,
  Look,
  recommendations,
  starterCloset,
  weddingGuestLooks,
} from "../lib/demo-data";
import type { DailyContext, OutfitRecommendation } from "../lib/pilot-domain";
import { calculateOutfitLayout, resolveGarmentConflict } from "../lib/try-on";
import WardrobeScanner, { WardrobeLearning } from "./WardrobeScanner";

export type AppTab =
  "today" | "week" | "try-on" | "closet" | "history" | "model";
type Sheet =
  "plans" | "outfit" | "item" | "add" | "scan" | "feedback" | "shopping" | null;
type TryStep = 1 | 2 | 3 | 4 | 5;
type PreviewMode = "mirror" | "scene" | "spin";
type PreviewResult = {
  garments: Garment[];
  photoId: string;
  imagePath?: string;
  scenePath?: string;
  renderMode: "image" | "composition";
  requestHash: string;
  look: Look;
  exactPreset: boolean;
};
type CalendarEvent = {
  id: string;
  title: string;
  category?: string;
  start: string;
  end: string;
};
type CalendarState = {
  configured: boolean;
  connected: boolean;
  mode: "checking" | "demo" | "manual" | "live" | "expired";
  events: CalendarEvent[];
  message?: string;
};
type WeatherHour = { time: string; temperature: number };
type WeatherState = {
  source: "nws";
  location: string;
  currentTemperature: number;
  currentFeelsLike: number;
  dayHigh: number;
  eveningFeelsLike: number;
  rainProbability: number;
  windMph: number;
  condition: string;
  weatherFlags: string[];
  hours: WeatherHour[];
  updatedAt: string;
};
type WeatherStatus = "loading" | "live" | "unavailable";
type PilotProfile = {
  name: string;
  city: string;
  latitude: string;
  longitude: string;
  styleVibe: string;
  preferredFormality: number;
  favoriteColors: string;
  avoid: string;
  routine: string;
  otherApps: string;
  autopilotGoals: string;
};
type ReferencePhoto = {
  id: string;
  src: string;
  label: string;
  usable: boolean;
  note: string;
  isDefault: boolean;
};
type HistoryEntry = {
  id: string;
  date: string;
  context: string;
  temp: string;
  feedback: string;
  look: Look;
  unavailable?: string[];
};

const defaultPilotProfile: PilotProfile = {
  name: "Sydney",
  city: "Chicago",
  latitude: "41.8781",
  longitude: "-87.6298",
  styleVibe: "Polished feminine",
  preferredFormality: 3,
  favoriteColors: "ivory, blush, navy, warm neutrals",
  avoid: "uncomfortable shoes for long walking days",
  routine:
    "Office during the week, dinner or events after work, weddings and travel on weekends",
  otherApps: "Maps, Notes",
  autopilotGoals: "What to wear, what to pack, and when to leave",
};
const genericDemoReference: ReferencePhoto = {
  id: "generic-demo-reference",
  src: "/assets/onboarding/generic-reference.webp",
  label: "Demo reference",
  usable: true,
  note: "Fictional generated onboarding photo",
  isDefault: true,
};

const APP_TIME_ZONE = "America/Chicago";
const ROADMAP_ENABLED =
  process.env.NEXT_PUBLIC_ROADMAP_BUNDLE_ENABLED === "true";
const formatAppDate = (value: Date) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: APP_TIME_ZONE,
  }).format(value);
const appDateKey = (value: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).format(value);
const appHour = (value: Date) =>
  Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: APP_TIME_ZONE,
    }).format(value),
  );
const greetingFor = (value: Date) =>
  appHour(value) < 12
    ? "Good morning"
    : appHour(value) < 17
      ? "Good afternoon"
      : "Good evening";
const weatherContext = (weather: WeatherState | null) =>
  weather
    ? `${weather.currentTemperature}° · ${weather.condition}`
    : "Weather refreshing";

const navItems = [
  { id: "today" as AppTab, label: "Today", icon: Home },
  { id: "week" as AppTab, label: "Week", icon: CalendarDays },
  { id: "try-on" as AppTab, label: "Try On", icon: Sparkles, center: true },
  { id: "closet" as AppTab, label: "Closet", icon: Shirt },
  { id: "history" as AppTab, label: "History", icon: History },
];

const routeFor = (tab: AppTab) =>
  tab === "today" ? "/" : tab === "model" ? "/settings/model" : `/${tab}`;
const getLookGarments = (look: Look, closet: Garment[]) =>
  look.garmentIds
    .map((id) => closet.find((item) => item.id === id))
    .filter(Boolean) as Garment[];
const recommendationLook = (item: OutfitRecommendation): Look => ({
  id: item.id,
  label:
    item.type === "best_overall"
      ? "Best overall"
      : item.type === "most_polished"
        ? "Most polished"
        : "Most comfortable",
  title: item.title,
  reason: item.reason,
  note: item.note,
  garmentIds: item.garmentIds,
  warmth: item.warmth,
  formality: item.formality,
  walking: item.walking,
});

export default function SydneyApp({
  initialTab = "today",
}: {
  initialTab?: AppTab;
}) {
  const [tab, setTab] = useState<AppTab>(initialTab);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [closet, setCloset] = useState<Garment[]>(starterCloset);
  const [selectedLook, setSelectedLook] = useState(recommendations[0]);
  const [selectedItem, setSelectedItem] = useState<Garment | null>(null);
  const [selectedGarments, setSelectedGarments] = useState(() =>
    getLookGarments(recommendations[0], starterCloset),
  );
  const [calendar, setCalendar] = useState<CalendarState>({
    configured: false,
    connected: false,
    mode: ROADMAP_ENABLED ? "checking" : "manual",
    events: [],
  });
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<WeatherStatus>("loading");
  const [now, setNow] = useState(() => new Date());
  const [profile, setProfile] = useState<PilotProfile>(defaultPilotProfile);
  const [dayType, setDayType] = useState("Office → Dinner");
  const [filter, setFilter] = useState("All");
  const [closetView, setClosetView] = useState<"grid" | "rail">("grid");
  const [historyView, setHistoryView] = useState<"worn" | "tried">("worn");
  const [historyItems, setHistoryItems] = useState<HistoryEntry[]>(
    ROADMAP_ENABLED ? [] : demoHistory,
  );
  const [demoHistoryReady, setDemoHistoryReady] = useState(false);
  const [tryStep, setTryStep] = useState<TryStep>(2);
  const [tryStatus, setTryStatus] = useState<
    "idle" | "validating" | "processing" | "complete"
  >("idle");
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(
    null,
  );
  const [resultMode, setResultMode] = useState<PreviewMode>("spin");
  const [compare, setCompare] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(
    ROADMAP_ENABLED ? "" : genericDemoReference.id,
  );
  const [photos, setPhotos] = useState<ReferencePhoto[]>(
    ROADMAP_ENABLED ? [] : [genericDemoReference],
  );
  const [authState, setAuthState] = useState<
    "demo" | "loading" | "required" | "ready"
  >(ROADMAP_ENABLED ? "loading" : "demo");
  const [weekDays, setWeekDays] = useState<
    Array<{
      date: string;
      context: DailyContext;
      decision: { recommendations: Look[] };
    }>
  >([]);
  const [serverLooks, setServerLooks] = useState<Look[]>([]);
  const [location, setLocation] = useState("Chicago");
  const [event, setEvent] = useState("Office → Dinner");
  const [toast, setToast] = useState<string | null>(null);
  const [addStep, setAddStep] = useState(1);
  const [uploadImage, setUploadImage] = useState<string | null>(null);
  const [consent, setConsent] = useState(true);
  const previewInFlight = useRef(false);
  const wearInFlight = useRef(false);
  const sheetDialogRef = useRef<HTMLElement>(null);
  const sheetCloseRef = useRef<HTMLButtonElement>(null);
  const [wardrobeLearning, setWardrobeLearning] = useState<WardrobeLearning>({
    totalScans: 0,
    photosScanned: 0,
    itemsConfirmed: 0,
    itemsRejected: 0,
    itemsMerged: 0,
    categoryCounts: {},
    colorCounts: {},
  });

  useEffect(() => {
    if (!ROADMAP_ENABLED) return;
    let cancelled = false;
    const load = async () => {
      const response = await fetch(
        `/api/bootstrap?date=${appDateKey(new Date())}`,
        { cache: "no-store" },
      );
      if (response.status === 401) {
        if (!cancelled) setAuthState("required");
        return;
      }
      if (!response.ok) {
        if (!cancelled) {
          setAuthState("required");
          setToast("The private launch is not configured yet");
        }
        return;
      }
      const data = (await response.json()) as {
        profile?: {
          name?: string;
          home_location?: string;
          style_preferences?: Record<string, unknown>;
        };
        closet: Garment[];
        photos: ReferencePhoto[];
        history: Array<{
          id: string;
          worn_on: string;
          context_snapshot?: Record<string, unknown>;
          outfit_snapshot_json?: {
            garmentIds?: string[];
            garments?: Array<{
              id: string;
              name?: string;
              category?: string;
              color?: string;
            }>;
          };
          feedback?: Array<{
            style_feedback?: string;
            temperature_feedback?: string;
          }>;
        }>;
        calendar: { configured: boolean; connected: boolean };
        decision?: { recommendations: OutfitRecommendation[] };
      };
      if (cancelled) return;
      const style = data.profile?.style_preferences || {};
      const nextProfile = {
        ...defaultPilotProfile,
        name: data.profile?.name || defaultPilotProfile.name,
        city: data.profile?.home_location || defaultPilotProfile.city,
        styleVibe: String(style.styleVibe || defaultPilotProfile.styleVibe),
        preferredFormality: Number(style.preferredFormality || 3),
        favoriteColors: Array.isArray(style.favoriteColors)
          ? style.favoriteColors.join(", ")
          : defaultPilotProfile.favoriteColors,
        avoid: Array.isArray(style.avoidRules)
          ? style.avoidRules.join(", ")
          : defaultPilotProfile.avoid,
        routine: String(style.routine || ""),
        otherApps: String(style.otherApps || ""),
        autopilotGoals: String(style.autopilotGoals || ""),
        latitude: String(style.latitude || defaultPilotProfile.latitude),
        longitude: String(style.longitude || defaultPilotProfile.longitude),
      };
      const loadedCloset = data.closet || [];
      const loadedLooks = (data.decision?.recommendations || []).map(
        recommendationLook,
      );
      setProfile(nextProfile);
      setLocation(nextProfile.city);
      setCloset(loadedCloset);
      setServerLooks(loadedLooks);
      if (loadedLooks[0]) {
        setSelectedLook(loadedLooks[0]);
        setSelectedGarments(getLookGarments(loadedLooks[0], loadedCloset));
      } else setSelectedGarments([]);
      setPhotos(
        (data.photos || []).map((photo) => ({
          ...photo,
          label: photo.label || "Private reference",
          note: photo.note || "Stored privately",
          usable: photo.usable !== false,
          isDefault: Boolean(photo.isDefault),
        })),
      );
      const mapped = (data.history || []).map((entry) => {
        const ids = entry.outfit_snapshot_json?.garmentIds || [];
        const garments = loadedCloset.filter((item) => ids.includes(item.id));
        const snapshotGarments = entry.outfit_snapshot_json?.garments || [];
        const unavailable = ids
          .filter((id) => !garments.some((item) => item.id === id))
          .map(
            (id) =>
              snapshotGarments.find((item) => item.id === id)?.name ||
              "Unavailable piece",
          );
        const look: Look = {
          id: `history-${entry.id}`,
          label: "Worn",
          title: "Saved outfit",
          reason: "Rebuilt from your private wear history.",
          note: "Your exact recorded pieces.",
          garmentIds: ids,
          warmth: garments.length
            ? Math.round(
                garments.reduce((sum, item) => sum + item.warmth, 0) /
                  garments.length,
              )
            : 0,
          formality: garments.length
            ? Math.round(
                garments.reduce((sum, item) => sum + item.formality, 0) /
                  garments.length,
              )
            : 0,
          walking: "Recorded look",
        };
        const savedFeedback = entry.feedback?.[0];
        const styleLabel = savedFeedback?.style_feedback
          ? savedFeedback.style_feedback === "loved"
            ? "Loved it"
            : "Not for me"
          : "";
        const temperatureLabel = savedFeedback?.temperature_feedback
          ? savedFeedback.temperature_feedback === "too_cold"
            ? "Too cold"
            : savedFeedback.temperature_feedback === "too_warm"
              ? "Too warm"
              : "Just right"
          : "";
        return {
          id: entry.id,
          date: entry.worn_on,
          context: String(entry.context_snapshot?.dayType || "Your day"),
          temp: String(entry.context_snapshot?.weather || "Saved context"),
          feedback:
            [styleLabel, temperatureLabel].filter(Boolean).join(" · ") ||
            "How did it feel?",
          look,
          unavailable,
        };
      });
      setHistoryItems(mapped);
      setCalendar((current) => ({
        ...current,
        configured: data.calendar.configured,
        connected: data.calendar.connected,
        mode: data.calendar.connected ? "live" : "manual",
      }));
      setAuthState("ready");
      const oldProfile = localStorage.getItem("pilot-profile-v1"),
        oldCloset = localStorage.getItem("sydney-style-v2");
      if (
        (oldProfile || oldCloset) &&
        !localStorage.getItem("pilot-supabase-migrated")
      ) {
        const payload = {
          profile: oldProfile ? JSON.parse(oldProfile) : undefined,
          closet: oldCloset ? JSON.parse(oldCloset).closet : undefined,
        };
        const digest = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(JSON.stringify(payload)),
        );
        const payloadHash = Array.from(new Uint8Array(digest))
          .map((value) => value.toString(16).padStart(2, "0"))
          .join("");
        const migration = await fetch("/api/migrations/local", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...payload, payloadHash }),
        });
        if (migration.ok)
          localStorage.setItem("pilot-supabase-migrated", "true");
      }
    };
    void load().catch(() => {
      if (!cancelled) setAuthState("required");
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (ROADMAP_ENABLED) return;
    try {
      const stored = sessionStorage.getItem("pilot-demo-history");
      if (stored) setHistoryItems(JSON.parse(stored) as HistoryEntry[]);
    } finally {
      setDemoHistoryReady(true);
    }
  }, []);
  useEffect(() => {
    if (ROADMAP_ENABLED || !demoHistoryReady) return;
    sessionStorage.setItem("pilot-demo-history", JSON.stringify(historyItems));
  }, [demoHistoryReady, historyItems]);
  useEffect(() => {
    if (tab === "try-on") window.scrollTo({ top: 0, behavior: "auto" });
  }, [resultMode, tab, tryStep]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let cancelled = false;
    const refreshWeather = async () => {
      try {
        const params = new URLSearchParams({
          lat: profile.latitude,
          lon: profile.longitude,
        });
        const response = await fetch(`/api/weather?${params}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("WEATHER_UNAVAILABLE");
        const data = (await response.json()) as WeatherState;
        if (!cancelled) {
          setWeather(data);
          setWeatherStatus("live");
        }
      } catch {
        if (!cancelled) {
          setWeather(null);
          setWeatherStatus("unavailable");
        }
      }
    };
    void refreshWeather();
    const timer = window.setInterval(refreshWeather, 15 * 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [profile.latitude, profile.longitude]);
  useEffect(() => {
    if (!ROADMAP_ENABLED) return;
    const status = new URLSearchParams(window.location.search).get("calendar");
    if (status) {
      const messages: Record<string, string> = {
        connected: "Google Calendar connected · read only",
        denied: "Calendar connection was cancelled",
        error: "Google Calendar could not connect — please try again",
        setup: "Google OAuth credentials are needed for live Calendar access",
      };
      if (messages[status]) queueMicrotask(() => setToast(messages[status]));
      window.history.replaceState({}, "", window.location.pathname);
    }
    void (async () => {
      try {
        const response = await fetch("/api/calendar?v=2", {
          cache: "no-store",
        });
        if (!response.ok) {
          setCalendar({
            configured: true,
            connected: true,
            mode: "expired",
            events: [],
            message: "Calendar needs to reconnect",
          });
          return;
        }
        const data = (await response.json()) as Omit<
          CalendarState,
          "events"
        > & {
          events?: CalendarEvent[];
        };
        setCalendar({
          ...data,
          events: (data.events || []).map((item) => ({
            ...item,
            title: item.title || item.category || "Busy",
          })),
        });
      } catch {
        setCalendar({
          configured: false,
          connected: false,
          mode: "manual",
          events: [],
          message: "Calendar is temporarily unavailable",
        });
      }
    })();
  }, []);
  useEffect(() => {
    const onPop = () => {
      const path = window.location.pathname;
      setSheet(null);
      setTab(
        path === "/"
          ? "today"
          : path === "/settings/model"
            ? "model"
            : (path.slice(1) as AppTab),
      );
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    if (!sheet) return;
    const returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusTimer = window.setTimeout(() => sheetCloseRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSheet(null);
        return;
      }
      if (event.key !== "Tab" || !sheetDialogRef.current) return;
      const focusable = Array.from(
        sheetDialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      returnFocus?.focus();
    };
  }, [sheet]);

  const navigate = (next: AppTab) => {
    const route = routeFor(next);
    setTab(next);
    setSheet(null);
    if (window.location.pathname !== route)
      window.history.pushState({}, "", route);
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const updatePilotProfile = (next: PilotProfile) => {
    setProfile(next);
    setLocation(next.city);
    if (ROADMAP_ENABLED)
      void fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...next,
          avoidRules: next.avoid
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      }).then((response) => {
        if (!response.ok) setToast("Profile could not be saved");
      });
  };
  const shareApp = async () => {
    const url = window.location.origin;
    const shareData = {
      title: "pilot: life’s daily decisions on autopilot",
      text: "A private preview of pilot — weather, plans, and your closet translated into one less daily decision.",
      url,
    };
    try {
      if (navigator.share) {
        setToast("Opening your share sheet…");
        await navigator.share(shareData);
        setToast("Shared securely");
      } else {
        await navigator.clipboard.writeText(url);
        setToast("Private link copied");
      }
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") {
        await navigator.clipboard.writeText(url);
        setToast("Private link copied");
      }
    }
  };
  const startTryOn = (look = selectedLook) => {
    const exactGarments = getLookGarments(look, closet);
    setSelectedLook(look);
    setSelectedGarments(exactGarments);
    setCompare(false);
    setSaved(false);
    setResultMode("spin");
    if (!ROADMAP_ENABLED) {
      const signature = exactGarments
        .map((item) => item.id)
        .sort()
        .join("|");
      setPreviewResult({
        garments: exactGarments,
        photoId: selectedPhoto,
        renderMode: "composition",
        requestHash: `demo-${signature || "outfit"}`,
        look,
        exactPreset: true,
      });
      setTryStatus("complete");
      setTryStep(5);
      setToast("360° exact-piece preview ready");
    } else {
      setPreviewResult(null);
      setTryStep(3);
      setTryStatus("idle");
    }
    navigate("try-on");
  };
  const remixLook = (look = selectedLook) => {
    setSelectedLook(look);
    setSelectedGarments(getLookGarments(look, closet));
    setPreviewResult(null);
    setCompare(false);
    setSaved(false);
    setTryStep(2);
    setResultMode("spin");
    setTryStatus("idle");
    navigate("try-on");
  };
  const markWorn = async (look = selectedLook) => {
    if (wearInFlight.current) return;
    wearInFlight.current = true;
    const today = `Today, ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: APP_TIME_ZONE }).format(now)}`;
    const optimisticId = `pending-${Date.now()}`;
    setHistoryItems((items) => [
      {
        id: optimisticId,
        date: today,
        context: event,
        temp: weatherContext(weather),
        feedback: "How did it feel?",
        look,
      },
      ...items.filter((item) => item.date !== today),
    ]);
    try {
      if (ROADMAP_ENABLED) {
        const response = await fetch("/api/history", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            garmentIds: look.garmentIds,
            context: { dayType: event, weather: weatherContext(weather) },
          }),
        });
        if (!response.ok) throw new Error("HISTORY_SAVE_FAILED");
        const data = (await response.json()) as { item: { id: string } };
        setHistoryItems((items) =>
          items.map((item) =>
            item.id === optimisticId
              ? {
                  ...item,
                  id: data.item.id,
                  look: { ...item.look, id: `history-${data.item.id}` },
                }
              : item,
          ),
        );
      }
      setToast("Added to Worn · Your style memory is updated");
    } catch {
      if (ROADMAP_ENABLED) {
        setHistoryItems((items) =>
          items.filter((item) => item.id !== optimisticId),
        );
      }
      setToast("This outfit could not be added — try again");
    } finally {
      wearInFlight.current = false;
    }
  };
  const updateItem = async (id: string, changes: Partial<Garment>) => {
    const previous = closet.find((item) => item.id === id);
    setCloset((items) =>
      items.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
    setSelectedItem((item) =>
      item?.id === id ? { ...item, ...changes } : item,
    );
    if (!ROADMAP_ENABLED) return true;
    try {
      const response = await fetch("/api/wardrobe/items", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, ...changes }),
      });
      if (!response.ok) throw new Error("WARDROBE_UPDATE_FAILED");
      return true;
    } catch {
      if (previous) {
        setCloset((items) =>
          items.map((item) => (item.id === id ? previous : item)),
        );
        setSelectedItem((item) => (item?.id === id ? previous : item));
      }
      setToast("This closet change could not be saved — try again");
      return false;
    }
  };
  const removeItem = async (item: Garment) => {
    if (!ROADMAP_ENABLED) {
      await updateItem(item.id, { active: false });
      setSheet(null);
      setToast("Item removed");
      return;
    }
    try {
      const response = await fetch(
        `/api/wardrobe/items?id=${encodeURIComponent(item.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("WARDROBE_DELETE_FAILED");
      setCloset((items) => items.filter((entry) => entry.id !== item.id));
      setSheet(null);
      setToast("Item removed");
    } catch {
      setToast("This item could not be removed — try again");
    }
  };
  const createPreview = async () => {
    if (
      previewInFlight.current ||
      tryStatus === "validating" ||
      tryStatus === "processing"
    )
      return;
    previewInFlight.current = true;
    const signature = [...selectedGarments]
      .map((item) => item.id)
      .sort()
      .join("|");
    const matchedLook = (
      ROADMAP_ENABLED ? dailyLooks : [...recommendations, ...weddingGuestLooks]
    ).find((look) => [...look.garmentIds].sort().join("|") === signature);
    const resultLook: Look = matchedLook || {
      id: `custom-${signature}`,
      label: "Built by you",
      title: "Your custom look",
      reason:
        "Every piece in this result comes from the selection you just reviewed.",
      note: "Swap one slot at a time to compare clearly.",
      garmentIds: selectedGarments.map((item) => item.id),
      warmth: Math.round(
        selectedGarments.reduce((sum, item) => sum + item.warmth, 0) /
          Math.max(1, selectedGarments.length),
      ),
      formality: Math.round(
        selectedGarments.reduce((sum, item) => sum + item.formality, 0) /
          Math.max(1, selectedGarments.length),
      ),
      walking: "Your exact mix",
    };
    setTryStatus("validating");
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 300));
      setTryStatus("processing");
      if (!ROADMAP_ENABLED) {
        await new Promise((resolve) => window.setTimeout(resolve, 450));
        setPreviewResult({
          garments: [...selectedGarments],
          photoId: selectedPhoto,
          renderMode: "composition",
          requestHash: `demo-${signature || "outfit"}`,
          look: resultLook,
          exactPreset: Boolean(matchedLook),
        });
        setTryStatus("complete");
        setResultMode("spin");
        setCompare(false);
        setTryStep(5);
        setToast("Your exact outfit preview is ready");
        return;
      }
      const response = await fetch("/api/try-on/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          garmentIds: selectedGarments.map((item) => item.id),
          referencePhotoId: selectedPhoto || undefined,
          mode: "mirror",
        }),
      });
      if (!response.ok) {
        const error = (await response.json().catch(() => null)) as {
          error?: { code?: string };
        } | null;
        throw new Error(
          response.status === 429
            ? "PREVIEW_LIMIT"
            : error?.error?.code || "PREVIEW_FAILED",
        );
      }
      const data = (await response.json()) as {
        requestHash: string;
        imagePath?: string;
        scenePath?: string;
        renderMode?: "image" | "composition";
      };
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      setPreviewResult({
        garments: [...selectedGarments],
        photoId: selectedPhoto,
        imagePath: data.imagePath,
        scenePath: data.scenePath,
        renderMode:
          data.renderMode || (data.imagePath ? "image" : "composition"),
        requestHash: data.requestHash,
        look: resultLook,
        exactPreset: Boolean(matchedLook),
      });
      setTryStatus("complete");
      setResultMode("spin");
      setCompare(false);
      setTryStep(5);
      setToast(
        data.imagePath
          ? "Your exact private preview is ready"
          : "Your exact custom composition is ready",
      );
    } catch (error) {
      setTryStatus("idle");
      setToast(
        error instanceof Error && error.message === "PREVIEW_LIMIT"
          ? "Daily preview limit reached — your selections are saved"
          : "Preview could not be created — your selections are still here",
      );
    } finally {
      previewInFlight.current = false;
    }
  };
  const handleGarmentUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setUploadImage(reader.result);
        setAddStep(2);
      }
    };
    reader.readAsDataURL(file);
  };
  const saveGarment = async () => {
    const garment: Garment = {
      ...starterCloset[0],
      id: `owned-${Date.now()}`,
      name: "Cream textured cardigan",
      image: uploadImage || starterCloset[0].image,
      inventoryType: "owned",
      brand: "My Closet",
      worn: 0,
    };
    if (ROADMAP_ENABLED) {
      try {
        const response = await fetch("/api/wardrobe/items", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...garment,
            imageData: uploadImage,
            source: "manual",
          }),
        });
        if (!response.ok) throw new Error("WARDROBE_CREATE_FAILED");
        const data = (await response.json()) as {
          item: Record<string, unknown>;
        };
        garment.id = String(data.item.id);
      } catch {
        setToast("This item could not be added");
        return;
      }
    }
    setCloset((items) => [garment, ...items]);
    setToast("Added to My Closet");
    setAddStep(1);
    setUploadImage(null);
    setSheet(null);
  };

  const filteredCloset = useMemo(
    () =>
      closet.filter(
        (item) =>
          item.active &&
          (filter === "All" ||
            (filter === "Available" && !item.laundry) ||
            (filter === "Laundry" && item.laundry) ||
            (filter === "Samples" && item.inventoryType === "sample") ||
            (filter === "Mine" && item.inventoryType === "owned") ||
            item.category === filter),
      ),
    [closet, filter],
  );
  const dailyLooks = ROADMAP_ENABLED ? serverLooks : recommendations;
  const decisionDate = appDateKey(now);
  useEffect(() => {
    if (!ROADMAP_ENABLED || authState !== "ready") return;
    const context: Partial<DailyContext> = {
      timezone: APP_TIME_ZONE,
      dayType,
      activities: dayType.split("→").map((item) => item.trim()),
      source: calendar.connected ? "calendar" : "manual",
      weather: {
        departureFeelsLike: weather?.currentFeelsLike || 68,
        dayHigh: weather?.dayHigh || 72,
        eveningFeelsLike: weather?.eveningFeelsLike || 64,
        rainProbability: weather?.rainProbability || 0,
        walking: /walk|errand|travel/i.test(dayType),
        observedAt: weather?.updatedAt,
      },
    };
    void fetch("/api/recommendations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: decisionDate, manualContext: context }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("RECOMMENDATION_FAILED");
        return (await response.json()) as {
          decision: { recommendations: OutfitRecommendation[] };
        };
      })
      .then((data) =>
        setServerLooks(data.decision.recommendations.map(recommendationLook)),
      )
      .catch(() => setToast("Today’s decision could not be refreshed"));
  }, [authState, calendar.connected, dayType, decisionDate, weather]);
  useEffect(() => {
    if (!ROADMAP_ENABLED || tab !== "week") return;
    void fetch(`/api/week?start=${appDateKey(now)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("WEEK_FAILED");
        return (await response.json()) as { days: typeof weekDays };
      })
      .then((data) => setWeekDays(data.days || []))
      .catch(() => setToast("The seven-day plan could not be refreshed"));
  }, [now, tab]);

  if (authState === "required") return <InviteLogin />;
  if (authState === "loading")
    return (
      <main className="app-shell">
        <div className="page-wrap">
          <p className="eyebrow brand-eyebrow">
            <b className="pilot-mark">pilot:</b>
            <span>Private wardrobe</span>
          </p>
          <h1>Loading your closet…</h1>
        </div>
      </main>
    );

  return (
    <main className="app-shell">
      <div
        className="app-content"
        inert={sheet ? true : undefined}
        aria-hidden={sheet ? true : undefined}
      >
        {tab === "today" && (
          <TodayScreen
            closet={closet}
            looks={dailyLooks}
            learning={wardrobeLearning}
            calendar={calendar}
            weather={weather}
            weatherStatus={weatherStatus}
            now={now}
            profile={profile}
            dayType={dayType}
            onProfile={() => navigate("model")}
            onShare={shareApp}
            onPlans={() => setSheet("plans")}
            onShopping={() => setSheet("shopping")}
            onDetails={(look) => {
              setSelectedLook(look);
              setSheet("outfit");
            }}
            onTry={startTryOn}
            onRemix={remixLook}
            onWear={markWorn}
          />
        )}
        {tab === "week" && (
          <WeekScreen
            closet={closet}
            days={weekDays}
            onProfile={() => navigate("model")}
            onTry={startTryOn}
            onPlan={() => {
              void fetch(`/api/week?start=${appDateKey(now)}`, {
                cache: "no-store",
              })
                .then(
                  (response) =>
                    response.json() as Promise<{ days: typeof weekDays }>,
                )
                .then((data) => setWeekDays(data.days || []));
            }}
          />
        )}
        {tab === "try-on" && (
          <TryOnScreen
            step={tryStep}
            setStep={setTryStep}
            closet={closet}
            selectedLook={selectedLook}
            setSelectedLook={setSelectedLook}
            selectedGarments={selectedGarments}
            setSelectedGarments={setSelectedGarments}
            previewResult={previewResult}
            selectedPhoto={selectedPhoto}
            setSelectedPhoto={setSelectedPhoto}
            photos={photos}
            location={location}
            setLocation={setLocation}
            event={event}
            setEvent={setEvent}
            weather={weather}
            status={tryStatus}
            createPreview={createPreview}
            mode={resultMode}
            setMode={setResultMode}
            compare={compare}
            setCompare={setCompare}
            saved={saved}
            setSaved={setSaved}
            onProfile={() => navigate("model")}
            onWear={markWorn}
            onHistory={() => {
              setHistoryView("worn");
              navigate("history");
            }}
            toast={setToast}
          />
        )}
        {tab === "closet" && (
          <ClosetScreen
            items={filteredCloset}
            total={closet.filter((item) => item.active).length}
            learning={wardrobeLearning}
            filter={filter}
            setFilter={setFilter}
            view={closetView}
            setView={setClosetView}
            onScan={() => setSheet("scan")}
            onAdd={() => setSheet("add")}
            onShopping={() => setSheet("shopping")}
            onItem={(item) => {
              setSelectedItem(item);
              setSheet("item");
            }}
            onProfile={() => navigate("model")}
          />
        )}
        {tab === "history" && (
          <HistoryScreen
            view={historyView}
            setView={setHistoryView}
            items={historyItems}
            closet={closet}
            onProfile={() => navigate("model")}
            onTry={(look) => {
              const exact = getLookGarments(look, closet);
              setSelectedLook(look);
              setSelectedGarments(exact);
              const matches =
                previewResult &&
                [...previewResult.look.garmentIds].sort().join("|") ===
                  [...look.garmentIds].sort().join("|");
              if (matches) {
                setTryStep(5);
                setResultMode("spin");
              } else {
                setPreviewResult(null);
                setTryStep(4);
                setToast("Review the saved pieces to create a fresh preview");
              }
              navigate("try-on");
            }}
            onWear={(look) => void markWorn(look)}
            onFeedback={(look) => {
              setSelectedLook(look);
              setSheet("feedback");
            }}
          />
        )}
        {tab === "model" && (
          <ModelScreen
            profile={profile}
            setProfile={updatePilotProfile}
            calendar={calendar}
            weather={weather}
            closet={closet}
            setCloset={setCloset}
            dayType={dayType}
            setDayType={setDayType}
            photos={photos}
            setPhotos={setPhotos}
            selected={selectedPhoto}
            setSelected={setSelectedPhoto}
            consent={consent}
            setConsent={setConsent}
            onBack={() => navigate("today")}
            toast={setToast}
          />
        )}
        {tab !== "model" && <BottomNav tab={tab} navigate={navigate} />}
      </div>

      {sheet && (
        <div className="sheet-scrim">
          <div
            className="sheet-backdrop"
            onClick={() => setSheet(null)}
            aria-hidden="true"
          />
          <section
            ref={sheetDialogRef}
            className="bottom-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={
              {
                plans: "Plans and Calendar",
                outfit: "Outfit details",
                item: "Closet item details",
                add: "Add one closet item",
                scan: "Scan closet photos",
                feedback: "Outfit feedback",
                shopping: "Shopping decision",
              }[sheet]
            }
          >
            <div className="sheet-handle" />
            <button
              ref={sheetCloseRef}
              className="sheet-close"
              onClick={() => setSheet(null)}
              aria-label="Close"
            >
              <X />
            </button>
            {sheet === "plans" && (
              <PlansSheet
                calendar={calendar}
                dayType={dayType}
                setDayType={setDayType}
                onDone={() => {
                  if (ROADMAP_ENABLED) {
                    const normalized =
                      dayType === "Date night"
                        ? ["Date"]
                        : dayType.split("→").map((item) => item.trim());
                    void fetch("/api/calendar", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        date: appDateKey(now),
                        dayType,
                        activities: normalized,
                      }),
                    }).then((response) => {
                      if (!response.ok)
                        setToast("This day override could not be saved");
                    });
                  }
                  setEvent(dayType);
                  setSheet(null);
                }}
              />
            )}
            {sheet === "outfit" && (
              <OutfitSheet
                look={selectedLook}
                garments={getLookGarments(selectedLook, closet)}
                onTry={() => {
                  setSheet(null);
                  startTryOn(selectedLook);
                }}
                onWear={() => {
                  markWorn(selectedLook);
                  setSheet(null);
                }}
                toast={setToast}
              />
            )}
            {sheet === "item" && selectedItem && (
              <ItemSheet
                item={selectedItem}
                onLaundry={() => {
                  updateItem(selectedItem.id, {
                    laundry: !selectedItem.laundry,
                  });
                  setToast(
                    selectedItem.laundry
                      ? "Marked available"
                      : "Moved to laundry",
                  );
                }}
                onDelete={() => void removeItem(selectedItem)}
              />
            )}
            {sheet === "scan" && (
              <WardrobeScanner
                closet={closet}
                initialLearning={wardrobeLearning}
                onComplete={(items, learning) => {
                  setWardrobeLearning(learning);
                  setCloset((current) => {
                    const next = new Map(
                      current.map((item) => [item.id, item]),
                    );
                    items.forEach((item) => next.set(item.id, item));
                    return Array.from(next.values());
                  });
                  setToast(
                    `${items.length} ${items.length === 1 ? "piece" : "pieces"} added · pilot is learning you`,
                  );
                }}
                onDone={() => setSheet(null)}
              />
            )}
            {sheet === "add" && (
              <AddSheet
                step={addStep}
                image={uploadImage}
                onPhoto={handleGarmentUpload}
                setStep={setAddStep}
                onSave={saveGarment}
              />
            )}
            {sheet === "shopping" && (
              <ShoppingSheet onDone={() => setSheet(null)} toast={setToast} />
            )}
            {sheet === "feedback" && (
              <FeedbackSheet
                onFeedback={async (value) => {
                  const historyId = selectedLook.id.startsWith("history-")
                    ? selectedLook.id.slice(8)
                    : "";
                  if (ROADMAP_ENABLED && historyId) {
                    try {
                      const response = await fetch(
                        `/api/history/${historyId}/feedback`,
                        {
                          method: "PATCH",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify(value),
                        },
                      );
                      if (!response.ok) throw new Error("FEEDBACK_SAVE_FAILED");
                    } catch {
                      setToast("Feedback could not be saved — try again");
                      return;
                    }
                  }
                  const styleLabel =
                    value.style === "loved" ? "Loved it" : "Not for me";
                  const temperatureLabel =
                    value.temperature === "too_cold"
                      ? "Too cold"
                      : value.temperature === "too_warm"
                        ? "Too warm"
                        : "Just right";
                  setHistoryItems((items) =>
                    items.map((entry) =>
                      entry.look.id === selectedLook.id
                        ? {
                            ...entry,
                            feedback: `${styleLabel} · ${temperatureLabel}`,
                          }
                        : entry,
                    ),
                  );
                  setSheet(null);
                  setToast("Feedback saved");
                }}
              />
            )}
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <span>
            <Check />
          </span>
          {toast}
        </div>
      )}
    </main>
  );
}

function BottomNav({
  tab,
  navigate,
}: {
  tab: AppTab;
  navigate: (tab: AppTab) => void;
}) {
  return (
    <nav className="tabbar" aria-label="Primary navigation">
      {navItems.map(({ id, label, icon: Icon, center }) => (
        <button
          key={id}
          className={`${tab === id ? "active" : ""} ${center ? "center" : ""}`}
          onClick={() => navigate(id)}
          aria-current={tab === id ? "page" : undefined}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function ScreenHeader({
  eyebrow,
  title,
  onProfile,
  onShare,
}: {
  eyebrow: string;
  title: string;
  onProfile: () => void;
  onShare?: () => void;
}) {
  return (
    <header className="screen-header">
      <div>
        <p className="eyebrow brand-eyebrow">
          <b className="pilot-mark">pilot:</b>
          <span>{eyebrow}</span>
        </p>
        <h1>{title}</h1>
      </div>
      <div className="header-actions">
        {onShare && (
          <button
            className="share-button"
            onClick={onShare}
            aria-label="Share pilot"
          >
            <Share2 />
            <span>Share</span>
          </button>
        )}
        <button
          className="avatar"
          onClick={onProfile}
          aria-label="Open your pilot setup"
        >
          <UserRound />
        </button>
      </div>
    </header>
  );
}

function OutfitComposition({
  garments,
  size = "card",
  selected,
  onItem,
}: {
  garments: Garment[];
  size?: "thumb" | "card" | "hero" | "room";
  selected?: string[];
  onItem?: (item: Garment) => void;
}) {
  const layout = calculateOutfitLayout(garments);
  return (
    <div
      className={`composition composition-${size}`}
      aria-label={`Outfit with ${garments.map((item) => item.name).join(", ")}`}
    >
      {layout.map(({ garment, anchorX, anchorY, scale, rotation, layer }) => {
        const Tag = onItem ? "button" : "div";
        return (
          <Tag
            type={onItem ? "button" : undefined}
            key={garment.id}
            className={`composition-piece ${selected?.includes(garment.id) ? "selected" : ""}`}
            style={{
              left: `${anchorX}%`,
              top: `${anchorY}%`,
              width: `${scale * 100}%`,
              zIndex: layer,
              transform: `rotate(${rotation}deg)`,
            }}
            onClick={() => onItem?.(garment)}
            aria-label={onItem ? `Select ${garment.name}` : undefined}
          >
            <img src={garment.image} alt="" />
          </Tag>
        );
      })}
    </div>
  );
}

function ExactOutfitSpin({ garments }: { garments: Garment[] }) {
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const drag = useRef<{ x: number; angle: number } | null>(null);
  const remaining = useRef(360);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    remaining.current = 360;
    const timer = window.setTimeout(() => setSpinning(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!spinning) return;
    let frame = 0;
    let previous: number | null = null;
    const rotate = (timestamp: number) => {
      if (previous === null) previous = timestamp;
      const delta = Math.min((timestamp - previous) * 0.03, remaining.current);
      previous = timestamp;
      remaining.current -= delta;
      setAngle((value) => (value + delta) % 360);
      if (remaining.current <= 0) {
        setSpinning(false);
        return;
      }
      frame = window.requestAnimationFrame(rotate);
    };
    frame = window.requestAnimationFrame(rotate);
    return () => window.cancelAnimationFrame(frame);
  }, [spinning]);

  const startSpin = () => {
    remaining.current = 360;
    setSpinning(true);
  };
  const normalizedAngle = Math.round(angle) % 360;

  return (
    <div className="outfit-spin-shell">
      <div
        className="outfit-spin-stage"
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, angle };
          event.currentTarget.setPointerCapture(event.pointerId);
          setSpinning(false);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          setAngle(
            (drag.current.angle + (event.clientX - drag.current.x) * 0.8 + 3600) %
              360,
          );
        }}
        onPointerUp={(event) => {
          drag.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        aria-label="Draggable 360 degree exact outfit preview"
      >
        <div
          className="outfit-spin-card"
          style={{ transform: `rotateY(${angle}deg)` }}
        >
          <div className="outfit-spin-face outfit-spin-front">
            <div className="outfit-spin-heading">
              <span>Exact outfit</span>
              <b>Front board</b>
            </div>
            <OutfitComposition garments={garments} size="room" />
            <small>Drag anywhere to rotate</small>
          </div>
          <div className="outfit-spin-face outfit-spin-back">
            <div className="outfit-spin-heading">
              <span>Verified selection</span>
              <b>{garments.length} exact pieces</b>
            </div>
            <div className="spin-piece-list">
              {garments.map((item) => (
                <div key={item.id}>
                  <img src={item.image} alt="" />
                  <span>
                    <small>{item.category}</small>
                    <b>{item.name}</b>
                  </span>
                  <Check />
                </div>
              ))}
            </div>
            <small>No garment backs are invented.</small>
          </div>
        </div>
      </div>
      <div className="spin-controls">
        <button
          onClick={() => {
            if (spinning) setSpinning(false);
            else startSpin();
          }}
          aria-label={
            spinning ? "Pause 360 degree spin" : "Play full 360 degree spin"
          }
        >
          {spinning ? <Pause /> : <Play />}
          {spinning ? "Pause" : "Full spin"}
        </button>
        <label>
          <span>{normalizedAngle}°</span>
          <input
            type="range"
            min="0"
            max="360"
            value={normalizedAngle}
            aria-label="Outfit rotation angle"
            onChange={(event) => {
              setSpinning(false);
              setAngle(Number(event.target.value) % 360);
            }}
          />
        </label>
        <button
          onClick={() => {
            setSpinning(false);
            setAngle(0);
          }}
        >
          <RotateCcw /> Front
        </button>
      </div>
    </div>
  );
}

function TodayScreen({
  closet,
  looks,
  calendar,
  weather,
  weatherStatus,
  now,
  profile,
  dayType,
  onProfile,
  onShare,
  onPlans,
  onShopping,
  onDetails,
  onTry,
  onRemix,
  onWear,
}: {
  closet: Garment[];
  looks: Look[];
  learning: WardrobeLearning;
  calendar: CalendarState;
  weather: WeatherState | null;
  weatherStatus: WeatherStatus;
  now: Date;
  profile: PilotProfile;
  dayType: string;
  onProfile: () => void;
  onShare: () => void;
  onPlans: () => void;
  onShopping: () => void;
  onDetails: (look: Look) => void;
  onTry: (look: Look) => void;
  onRemix: (look: Look) => void;
  onWear: (look: Look) => void;
}) {
  const todayKey = appDateKey(now);
  const liveEvents = calendar.events
    .filter(
      (item) =>
        item.start &&
        (item.start.includes("T")
          ? appDateKey(new Date(item.start))
          : item.start) === todayKey,
    )
    .slice(0, 3);
  const timeFor = (value: string) =>
    value.includes("T")
      ? new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: APP_TIME_ZONE,
        })
          .format(new Date(value))
          .replace(":00", "")
      : "All day";
  const rankedLooks = looks;
  const temperatures = weather?.hours.map((item) => item.temperature) || [];
  const temperatureSwing = weather
    ? Math.max(weather.dayHigh, ...temperatures) -
      Math.min(
        weather.currentTemperature,
        weather.eveningFeelsLike,
        ...temperatures,
      )
    : 0;
  const WeatherIcon =
    weather?.rainProbability && weather.rainProbability >= 40
      ? CloudRain
      : weather?.condition.toLowerCase().includes("sun")
        ? Sun
        : CloudSun;
  const weatherDetail = weather
    ? weather.rainProbability >= 40
      ? `${weather.rainProbability}% chance of rain · ${weather.windMph} mph wind`
      : `${temperatureSwing}° range today · ${weather.eveningFeelsLike < weather.dayHigh - 3 ? "Cooler this evening" : `${weather.windMph} mph wind`}`
    : weatherStatus === "loading"
      ? "Refreshing the Chicago forecast"
      : "No demo forecast substituted";
  const calendarLabel =
    calendar.mode === "checking"
      ? "Checking Calendar"
      : calendar.connected
        ? "Google Calendar · Live"
        : calendar.configured
          ? "Calendar ready to connect"
          : "Manual day";
  const outfitContext = weather
    ? `Picked for ${weather.currentTemperature}°, ${dayType}, and your ${profile.styleVibe.toLowerCase()} style.`
    : `Picked for ${dayType} and your ${profile.styleVibe.toLowerCase()} style while weather refreshes.`;
  const cardWeather = weather
    ? `${weather.currentTemperature}° now · high ${weather.dayHigh}° · ${weather.rainProbability}% rain`
    : "Live weather is refreshing";

  const readyCount = closet.filter(
    (item) =>
      item.active &&
      !item.laundry &&
      (ROADMAP_ENABLED ? item.inventoryType === "owned" : true),
  ).length;
  return (
    <div className="today-page page-wrap">
      <section className="today-context">
        <ScreenHeader
          eyebrow={`${greetingFor(now)}, ${profile.name}`}
          title="Today’s look"
          onProfile={onProfile}
          onShare={onShare}
        />
        <p className="date">
          {formatAppDate(now)} · {weather?.location || profile.city}
        </p>
        <button className="brain-brief" onClick={onProfile}>
          <span className="brain-icon">
            <Brain />
          </span>
          <span>
            <b>Your second brain is working</b>
            <small>Weather + Calendar + closet + location + preferences</small>
          </span>
          <span className="brain-action">
            {profile.name === defaultPilotProfile.name
              ? "Make pilot mine"
              : "Tune my pilot"}
            <ChevronRight />
          </span>
        </button>
        <div className={`weather-block ${weather ? "live" : "pending"}`}>
          <strong>
            {weather ? weather.currentTemperature : "--"}
            {weather && <span>°</span>}
          </strong>
          <div>
            <p>
              {weather
                ? `Feels like ${weather.currentFeelsLike}° · Updated live`
                : weatherStatus === "loading"
                  ? "Updating live weather…"
                  : "Live weather unavailable"}
            </p>
            <b>
              <WeatherIcon />{" "}
              {weather ? weather.condition : "Check again shortly"}
            </b>
          </div>
        </div>
        <p className="weather-alert">
          <Wind />
          <span>
            <b>{weather ? weatherDetail.split(" · ")[0] : weatherDetail}</b>
            {weather && weatherDetail.includes(" · ")
              ? ` · ${weatherDetail.split(" · ").slice(1).join(" · ")}`
              : ""}
          </span>
        </p>
        <div className="hourly">
          {weather?.hours.length
            ? weather.hours.map((hour, index) => (
                <div
                  className={index === 0 ? "active" : ""}
                  key={`${hour.time}-${index}`}
                >
                  <span>{index === 0 ? "Now" : hour.time}</span>
                  <b>{hour.temperature}°</b>
                </div>
              ))
            : Array.from({ length: 4 }, (_, index) => (
                <div className={index === 0 ? "active" : ""} key={index}>
                  <span>{index === 0 ? "Now" : "Later"}</span>
                  <b>—</b>
                </div>
              ))}
        </div>
        <section className="day-plan">
          <div className="section-heading">
            <div>
              <h2>Your day</h2>
              <span
                className={`calendar-status ${calendar.connected ? "live" : ""}`}
              >
                <i />
                {calendarLabel}
              </span>
            </div>
            <button onClick={onPlans}>Edit</button>
          </div>
          {calendar.connected && liveEvents.length > 0 && (
            <div className="timeline">
              {liveEvents.map((item) => (
                <p key={item.id}>
                  <time>{timeFor(item.start)}</time>
                  {item.title}
                </p>
              ))}
            </div>
          )}
          {calendar.connected &&
            calendar.mode !== "checking" &&
            liveEvents.length === 0 && (
              <p className="calendar-empty">
                No more events on today’s calendar.
              </p>
            )}
          {!calendar.connected && calendar.mode !== "checking" && (
            <button className="calendar-nudge" onClick={onPlans}>
              <CalendarDays />
              <span>
                <b>Add today’s real plans</b>
                <small>
                  {calendar.configured
                    ? "Connect Google Calendar · read only"
                    : "Set the day manually or configure Calendar"}
                </small>
              </span>
              <ChevronRight />
            </button>
          )}
          <button
            className="day-type"
            onClick={onPlans}
            aria-label={`Change today's plan: ${dayType}`}
          >
            <span>Dressing for</span>
            <b>{dayType}</b>
            <ChevronRight />
          </button>
        </section>
        <button
          className="secondary-action today-shopping-quick"
          onClick={onShopping}
        >
          <Sparkles /> Should I buy this?
        </button>
        <p className="ready-note">
          <Check /> {readyCount}{" "}
          {ROADMAP_ENABLED
            ? "owned pieces available"
            : "closet pieces ready for the demo"}
        </p>
      </section>
      <section className="today-looks">
        <div className="looks-heading">
          <p className="eyebrow">Your wardrobe, decided</p>
          <h2>{rankedLooks.length ? "Best match" : "Complete your closet"}</h2>
          <span>
            {rankedLooks.length
              ? outfitContext
              : "Add a dress and shoes, or a top, bottom, and shoes."}
          </span>
        </div>
        {rankedLooks.length ? (
          <div className="outfit-rail">
            {rankedLooks.map((look, index) => (
              <OutfitCard
                key={look.id}
                look={look}
                garments={getLookGarments(look, closet)}
                contextNote={cardWeather}
                featured={index === 0}
                onDetails={() => onDetails(look)}
                onTry={() => onTry(look)}
                onRemix={() => onRemix(look)}
                onWear={() => onWear(look)}
              />
            ))}
          </div>
        ) : (
          <button className="primary-action" onClick={onProfile}>
            <Plus /> Add the missing pieces
          </button>
        )}
      </section>
    </div>
  );
}

function OutfitCard({
  look,
  garments,
  contextNote,
  featured,
  onDetails,
  onTry,
  onRemix,
  onWear,
}: {
  look: Look;
  garments: Garment[];
  contextNote?: string;
  featured?: boolean;
  onDetails: () => void;
  onTry: () => void;
  onRemix: () => void;
  onWear: () => void;
}) {
  return (
    <article className={`outfit-card ${featured ? "featured" : ""}`}>
      <div className="outfit-visual">
        <OutfitComposition
          garments={garments}
          size={featured ? "hero" : "card"}
          onItem={onRemix}
        />
        <span className="look-badge">{look.label}</span>
        <button className="play-hint" onClick={onTry}>
          <Sparkles /> Try it on · 360°
        </button>
        <button
          className="more"
          onClick={onDetails}
          aria-label={`Details for ${look.title}`}
        >
          <MoreHorizontal />
        </button>
      </div>
      <div className="outfit-copy">
        <h3>{look.title}</h3>
        <p>{look.reason}</p>
        <div className="outfit-meta">
          <span>
            <Wind /> {contextNote || look.note}
          </span>
          <span>
            <Layers3 /> {garments.length} pieces · warmth {look.warmth}/5
          </span>
        </div>
        <div className="card-actions">
          <button className="secondary-action" onClick={onRemix}>
            <Sparkles /> Customize
          </button>
          <button className="primary-action" onClick={onWear}>
            Wear today
          </button>
        </div>
      </div>
    </article>
  );
}

function WeekScreen({
  closet,
  days,
  onProfile,
  onTry,
  onPlan,
}: {
  closet: Garment[];
  days: Array<{
    date: string;
    context: DailyContext;
    decision: { recommendations: Look[] };
  }>;
  onProfile: () => void;
  onTry: (look: Look) => void;
  onPlan: () => void;
}) {
  return (
    <div className="standard-page page-wrap">
      <ScreenHeader
        eyebrow={
          days.length
            ? `${days[0].date} → ${days.at(-1)?.date}`
            : "Rolling seven days"
        }
        title="This Week"
        onProfile={onProfile}
      />
      <div className="page-lede">
        <p>Your week, already dressed.</p>
        <span>
          <CloudSun /> Live context
        </span>
      </div>
      {days.length ? (
        <div className="week-list">
          {days.map((day) => {
            const raw = day.decision.recommendations[0];
            const look = raw
              ? {
                  ...raw,
                  label: raw.label || "Best overall",
                  title: raw.title || "Your best match",
                }
              : undefined;
            const date = new Date(`${day.date}T12:00:00Z`);
            return (
              <article className="week-day" key={day.date}>
                <div className="week-date">
                  <b>
                    {new Intl.DateTimeFormat("en-US", { weekday: "short" })
                      .format(date)
                      .toUpperCase()}
                  </b>
                  <span>{date.getUTCDate()}</span>
                </div>
                <div className="week-context">
                  <strong>{day.context.dayType}</strong>
                  <span>
                    <CloudSun /> {day.context.weather.dayHigh}° /{" "}
                    {day.context.weather.eveningFeelsLike}°
                  </span>
                </div>
                {look ? (
                  <>
                    <OutfitComposition
                      garments={getLookGarments(look, closet)}
                      size="thumb"
                    />
                    <button className="week-try" onClick={() => onTry(look)}>
                      Preview
                    </button>
                  </>
                ) : (
                  <button className="plan-look" onClick={onPlan}>
                    <WandSparkles />
                    Add pieces
                  </button>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <section className="setup-section">
          <h2>Plan from your real closet</h2>
          <p>
            Weather, Calendar context, and rotation create seven owned-outfit
            decisions.
          </p>
          <button className="primary-action" onClick={onPlan}>
            <CalendarDays /> Plan my week
          </button>
        </section>
      )}
      <p className="quiet-note">Previews are created only when you ask.</p>
    </div>
  );
}

function ClosetScreen({
  items,
  total,
  learning,
  filter,
  setFilter,
  view,
  setView,
  onScan,
  onAdd,
  onShopping,
  onItem,
  onProfile,
}: {
  items: Garment[];
  total: number;
  learning: WardrobeLearning;
  filter: string;
  setFilter: (value: string) => void;
  view: "grid" | "rail";
  setView: (value: "grid" | "rail") => void;
  onScan: () => void;
  onAdd: () => void;
  onShopping: () => void;
  onItem: (item: Garment) => void;
  onProfile: () => void;
}) {
  const filters = [
    "All",
    "Tops",
    "Bottoms",
    "Dresses",
    "Outerwear",
    "Shoes",
    "Available",
    "Laundry",
    "Samples",
    "Mine",
  ];
  const learningLabel = learning.totalScans
    ? `${learning.itemsConfirmed} closet signals across ${learning.totalScans} ${learning.totalScans === 1 ? "scan" : "scans"}`
    : "Your first scan starts pilot’s style memory";
  return (
    <div className="standard-page page-wrap">
      <ScreenHeader
        eyebrow={`${total} pieces ready`}
        title="Your Closet"
        onProfile={onProfile}
      />
      <section className="closet-scan-card">
        <span>
          <Sparkles />
        </span>
        <div>
          <p className="eyebrow">Fastest way to add a lot</p>
          <h2>Scan outfit &amp; shopping photos</h2>
          <p>
            Pick photos or screenshots. Review the pieces, then save only what
            you own.
          </p>
        </div>
        <small>
          <Brain /> {learningLabel}
        </small>
        <button onClick={onScan}>
          Scan photos <ChevronRight />
        </button>
      </section>
      <div className="closet-toolbar">
        <button className="secondary-action compact" onClick={onAdd}>
          <Plus /> Add one item
        </button>
        <button className="secondary-action compact" onClick={onShopping}>
          <Sparkles /> Should I buy this?
        </button>
        <div className="view-toggle">
          <button
            className={view === "grid" ? "active" : ""}
            onClick={() => setView("grid")}
            aria-label="Grid view"
          >
            <Grid2X2 />
          </button>
          <button
            className={view === "rail" ? "active" : ""}
            onClick={() => setView("rail")}
            aria-label="Rail view"
          >
            <Columns3 />
          </button>
        </div>
      </div>
      <div className="filter-row">
        {filters.map((item) => (
          <button
            className={filter === item ? "active" : ""}
            key={item}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className={`closet-grid ${view}`}>
        {items.map((item) => (
          <button
            className="garment-card"
            key={item.id}
            onClick={() => onItem(item)}
          >
            <div className="garment-visual">
              <img src={item.image} alt={`${item.color} ${item.subcategory}`} />
              {item.laundry && <span>In laundry</span>}
              <i>
                {item.inventoryType === "sample"
                  ? "Starter"
                  : item.learnedFrom === "scan"
                    ? "Learned"
                    : "Mine"}
              </i>
            </div>
            <strong>{item.name}</strong>
            <small>{item.category}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function TryOnScreen({
  step,
  setStep,
  closet,
  selectedLook,
  setSelectedLook,
  selectedGarments,
  setSelectedGarments,
  previewResult,
  selectedPhoto,
  setSelectedPhoto,
  photos,
  location,
  setLocation,
  event,
  setEvent,
  weather,
  status,
  createPreview,
  mode,
  setMode,
  compare,
  setCompare,
  saved,
  setSaved,
  onProfile,
  onWear,
  onHistory,
  toast,
}: {
  step: TryStep;
  setStep: (step: TryStep) => void;
  closet: Garment[];
  selectedLook: Look;
  setSelectedLook: (look: Look) => void;
  selectedGarments: Garment[];
  setSelectedGarments: (items: Garment[]) => void;
  previewResult: PreviewResult | null;
  selectedPhoto: string;
  setSelectedPhoto: (id: string) => void;
  photos: ReferencePhoto[];
  location: string;
  setLocation: (value: string) => void;
  event: string;
  setEvent: (value: string) => void;
  weather: WeatherState | null;
  status: string;
  createPreview: () => Promise<void>;
  mode: PreviewMode;
  setMode: (mode: PreviewMode) => void;
  compare: boolean;
  setCompare: (value: boolean) => void;
  saved: boolean;
  setSaved: (value: boolean) => void;
  onProfile: () => void;
  onWear: (look: Look) => void;
  onHistory: () => void;
  toast: (value: string) => void;
}) {
  const photo = photos.find((item) => item.id === selectedPhoto) || photos[0];
  const [activePiece, setActivePiece] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>("Tops");
  const [outfitHistory, setOutfitHistory] = useState<Garment[][]>([]);
  const categories: Category[] = [
    "Tops",
    "Bottoms",
    "Dresses",
    "Outerwear",
    "Shoes",
  ];
  const liveWeather = weatherContext(weather);
  const allPresets = ROADMAP_ENABLED
    ? selectedGarments.length
      ? [selectedLook]
      : []
    : [...recommendations, ...weddingGuestLooks];
  const signatureFor = (items: Garment[]) =>
    items
      .map((item) => item.id)
      .sort()
      .join("|");
  const selectedFor = (category: Category) =>
    selectedGarments.find((item) => item.category === category);
  const availableForCategory = closet.filter(
    (item) => item.active && !item.laundry && item.category === activeCategory,
  );
  const hasDress = Boolean(selectedFor("Dresses"));
  const hasSeparates = Boolean(selectedFor("Tops") && selectedFor("Bottoms"));
  const isComplete =
    (hasDress || hasSeparates) && Boolean(selectedFor("Shoes"));
  const activePreset = allPresets.find(
    (look) =>
      [...look.garmentIds].sort().join("|") === signatureFor(selectedGarments),
  );
  const applyGarments = (next: Garment[]) => {
    setOutfitHistory((items) => [...items.slice(-5), selectedGarments]);
    setSelectedGarments(next);
  };
  const undoGarments = () => {
    const previous = outfitHistory.at(-1);
    if (!previous) return;
    setSelectedGarments(previous);
    setOutfitHistory((items) => items.slice(0, -1));
    setActivePiece(null);
  };
  const surpriseMe = () => {
    if (!allPresets.length) {
      toast("Add a complete owned outfit first");
      return;
    }
    const current = allPresets.findIndex(
      (look) =>
        signatureFor(getLookGarments(look, closet)) ===
        signatureFor(selectedGarments),
    );
    const next =
      allPresets[(current + 1 + allPresets.length) % allPresets.length];
    applyGarments(getLookGarments(next, closet));
    setSelectedLook(next);
    setActivePiece(null);
    toast(`${next.label} is on the board`);
  };
  const resetLook = () => {
    applyGarments(getLookGarments(selectedLook, closet));
    setActivePiece(null);
  };
  if (step === 5 && previewResult) {
    const resultPhoto =
      photos.find((item) => item.id === previewResult.photoId) || photo;
    const resultImage =
      mode === "scene" ? previewResult.scenePath : previewResult.imagePath;
    return (
      <div className="result-page">
        <header className="result-top">
          <button onClick={() => setStep(4)} aria-label="Back to review">
            <ArrowLeft />
          </button>
          <div>
            <span>Outfit preview</span>
            <small>
              <LockKeyhole /> Private · exact selection
            </small>
          </div>
          <button
            className={saved ? "saved" : ""}
            onClick={() => {
              setSaved(!saved);
              toast(saved ? "Removed from saved looks" : "Look saved");
            }}
            aria-label="Save result"
          >
            <Save />
          </button>
        </header>
        <div
          className={`result-media ${mode === "spin" || !resultImage ? "composition-result" : ""}`}
        >
          <div className="result-view-switch" aria-label="Preview view">
            <button
              className={mode === "spin" ? "active" : ""}
              onClick={() => setMode("spin")}
            >
              360° spin
            </button>
            <button
              className={mode === "mirror" ? "active" : ""}
              onClick={() => setMode("mirror")}
            >
              Front
            </button>
            {previewResult.scenePath && (
              <button
                className={mode === "scene" ? "active" : ""}
                onClick={() => setMode("scene")}
              >
                Scene
              </button>
            )}
          </div>
          {mode === "spin" ? (
            <ExactOutfitSpin garments={previewResult.garments} />
          ) : compare && resultPhoto?.src ? (
            <img
              className="result-person-image"
              src={resultPhoto.src}
              alt="Private reference before the selected outfit"
            />
          ) : resultImage ? (
            <img
              className="result-person-image"
              src={resultImage}
              alt={`${previewResult.look.title} private preview`}
            />
          ) : (
            <div className="custom-result-visual">
              {resultPhoto?.src && (
                <div className="custom-reference">
                  <img
                    src={resultPhoto.src}
                    alt="Private reference used for this selection"
                  />
                  <span>
                    <LockKeyhole />
                    Private reference
                  </span>
                </div>
              )}
              <div className="custom-outfit-board">
                <p>Your exact outfit board</p>
                <OutfitComposition
                  garments={previewResult.garments}
                  size="room"
                />
                <span>
                  Live generation is off. No garment has been substituted.
                </span>
              </div>
            </div>
          )}
          <span className="demo-stamp">Exact pieces · honest 360° board</span>
          {mode !== "spin" && resultPhoto?.src && (
            <button
              className="compare-toggle"
              onClick={() => setCompare(!compare)}
            >
              {compare ? "Show selection" : "Before"}
            </button>
          )}
        </div>
        <section className="result-panel">
          <p className="eyebrow">
            {location} · {event} · {liveWeather}
          </p>
          <h1>{previewResult.look.title}</h1>
          <p className="fallback-explainer">
            Rotate the exact outfit through 360°. The reverse verifies every
            selected piece; this is an outfit board, not a simulated body view.
          </p>
          <div className="result-actions">
            <button
              className="primary-action"
              onClick={() => onWear(previewResult.look)}
            >
              Wear today
            </button>
            <button className="secondary-action" onClick={() => setStep(2)}>
              Change a piece
            </button>
          </div>
          <div className="result-piece-list">
            {previewResult.garments.map((item) => (
              <div key={item.id}>
                <img src={item.image} alt="" />
                <span>
                  <small>{item.category}</small>
                  <b>{item.name}</b>
                </span>
                <Check />
              </div>
            ))}
          </div>
          <p className="disclaimer">
            Only the {previewResult.garments.length} pieces you selected are
            used.
          </p>
          <div className="result-secondary">
            <button onClick={() => setStep(3)}>Reference photo</button>
            <button onClick={() => setStep(4)}>Review exact mix</button>
            <button onClick={onHistory}>Open History</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="try-page page-wrap">
      <ScreenHeader
        eyebrow="Private fitting room"
        title="Dressing Room"
        onProfile={onProfile}
      />
      <div className="stepper" aria-label={`Step ${step} of 4`}>
        {[1, 2, 3, 4].map((n) => (
          <button
            className={step === n ? "active" : step > n ? "done" : ""}
            key={n}
            onClick={() => n <= step && setStep(n as TryStep)}
          >
            <span>{step > n ? <Check /> : n}</span>
            {["Your day", "Your look", "Your photo", "Review"][n - 1]}
          </button>
        ))}
      </div>
      {step === 1 && (
        <section className="try-step">
          <p className="eyebrow">Step 1</p>
          <h2>Where are you headed?</h2>
          <div className="context-summary">
            <MapPin />
            <div>
              <b>{location}</b>
              <span>
                {event} · {liveWeather}
              </span>
              <small>
                {weather
                  ? `High ${weather.dayHigh}° · ${weather.rainProbability}% rain`
                  : "Live forecast will refresh automatically"}
              </small>
            </div>
          </div>
          <label className="field-label">
            Location
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </label>
          <div className="preset-row">
            {[
              "Chicago",
              "Office",
              "Dinner",
              "Rooftop",
              "Travel",
              "Outdoors",
            ].map((item) => (
              <button
                className={location === item ? "active" : ""}
                key={item}
                onClick={() => setLocation(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <label className="field-label">
            Event
            <input value={event} onChange={(e) => setEvent(e.target.value)} />
          </label>
          <div className="preset-row">
            {[
              "Office → Dinner",
              "Office",
              "Casual",
              "Date",
              "Wedding Guest",
              "Party",
            ].map((item) => (
              <button
                className={event === item ? "active" : ""}
                key={item}
                onClick={() => setEvent(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <p className="privacy-note">
            <LockKeyhole /> Exact private addresses are normalized before any
            provider request.
          </p>
          <button
            className="primary-action sticky-action"
            onClick={() => setStep(2)}
          >
            Choose your look <ChevronRight />
          </button>
        </section>
      )}
      {step === 2 && (
        <section className="try-step">
          <p className="eyebrow">Step 2 · Build it piece by piece</p>
          <h2>Make the look yours</h2>
          <p className="step-lede">
            Choose a slot, then replace only that piece. What you review is
            exactly what the result uses.
          </p>
          <button
            className="quick-spin-action"
            disabled={
              !isComplete || (status !== "idle" && status !== "complete")
            }
            onClick={createPreview}
          >
            {status !== "idle" && status !== "complete" ? (
              <LoaderCircle />
            ) : (
              <RefreshCw />
            )}
            {status !== "idle" && status !== "complete"
              ? "Building your exact preview…"
              : "Preview this outfit in 360°"}
          </button>
          <div className="room-board interactive-board">
            <OutfitComposition
              garments={selectedGarments}
              size="room"
              selected={activePiece ? [activePiece] : []}
            />
            <span className="board-tip">
              {activePiece
                ? `${selectedGarments.find((item) => item.id === activePiece)?.name} · tap a replacement below`
                : "Choose a slot below to change one exact piece"}
            </span>
          </div>
          <div className="selection-truth">
            <Check />
            <span>
              <b>{selectedGarments.length} exact pieces selected</b>
              <small>
                {activePreset
                  ? activePreset.title
                  : "Custom mix · no stale preview will be reused"}
              </small>
            </span>
          </div>
          <div className="play-toolbar">
            <button onClick={surpriseMe}>
              <RefreshCw /> Surprise me
            </button>
            <button disabled={!outfitHistory.length} onClick={undoGarments}>
              <RotateCcw /> Undo
            </button>
            <button onClick={resetLook}>Reset</button>
          </div>
          <div className="look-stats">
            <span>
              Warmth{" "}
              <b>
                {Math.round(
                  selectedGarments.reduce((sum, item) => sum + item.warmth, 0) /
                    Math.max(1, selectedGarments.length),
                )}
                /5
              </b>
            </span>
            <span>
              Formality{" "}
              <b>
                {Math.round(
                  selectedGarments.reduce(
                    (sum, item) => sum + item.formality,
                    0,
                  ) / Math.max(1, selectedGarments.length),
                )}
                /5
              </b>
            </span>
          </div>
          <h3 className="rail-title">Choose a slot</h3>
          <div className="outfit-slots">
            {categories.map((category) => {
              const item = selectedFor(category);
              const optional = category === "Outerwear";
              const unavailable =
                hasDress && (category === "Tops" || category === "Bottoms");
              return (
                <article
                  className={`${activeCategory === category ? "active" : ""} ${unavailable ? "muted" : ""}`}
                  key={category}
                >
                  <button
                    className="slot-main"
                    onClick={() => {
                      setActiveCategory(category);
                      setActivePiece(item?.id || null);
                    }}
                  >
                    <span className="slot-image">
                      {item ? <img src={item.image} alt="" /> : <Plus />}
                    </span>
                    <span>
                      <small>
                        {category}
                        {optional ? " · optional" : ""}
                      </small>
                      <b>
                        {item?.name ||
                          (unavailable ? "Replaces dress" : "Choose a piece")}
                      </b>
                    </span>
                    <ChevronRight />
                  </button>
                  {item && optional && (
                    <button
                      className="slot-remove"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => {
                        applyGarments(
                          selectedGarments.filter(
                            (chosen) => chosen.id !== item.id,
                          ),
                        );
                        setActivePiece(null);
                      }}
                    >
                      <X />
                    </button>
                  )}
                </article>
              );
            })}
          </div>
          <div className="rail-heading">
            <h3 className="rail-title">
              {selectedFor(activeCategory)
                ? `Replace ${activeCategory.toLowerCase()}`
                : `Add ${activeCategory.toLowerCase()}`}
            </h3>
            <span>{availableForCategory.length} available</span>
          </div>
          <div className="garment-picker focused-picker">
            {availableForCategory.map((item) => (
              <button
                className={
                  selectedGarments.some((chosen) => chosen.id === item.id)
                    ? "active"
                    : ""
                }
                key={item.id}
                onClick={() => {
                  applyGarments(resolveGarmentConflict(selectedGarments, item));
                  setActivePiece(item.id);
                }}
              >
                <img src={item.image} alt="" />
                <span>{item.name}</span>
                <small>{item.subcategory}</small>
                {selectedGarments.some((chosen) => chosen.id === item.id) && (
                  <i>
                    <Check /> On
                  </i>
                )}
              </button>
            ))}
          </div>
          <h3 className="rail-title">Everyday starting points</h3>
          <div className="mini-recommendations">
            {recommendations.map((look) => {
              const lookGarments = getLookGarments(look, closet);
              return (
                <button
                  className={
                    signatureFor(lookGarments) ===
                    signatureFor(selectedGarments)
                      ? "active"
                      : ""
                  }
                  key={look.id}
                  onClick={() => {
                    applyGarments(lookGarments);
                    setSelectedLook(look);
                    setActivePiece(null);
                  }}
                >
                  <OutfitComposition garments={lookGarments} size="thumb" />
                  <span>{look.label}</span>
                </button>
              );
            })}
          </div>
          <div className="collection-heading">
            <div>
              <p className="eyebrow">Expanded collection</p>
              <h3 className="rail-title">Feminine occasion ideas</h3>
            </div>
            <span>5 looks · 8 shoe options</span>
          </div>
          <div className="wedding-look-rail">
            {weddingGuestLooks.map((look) => {
              const lookGarments = getLookGarments(look, closet);
              return (
                <button
                  className={
                    signatureFor(lookGarments) ===
                    signatureFor(selectedGarments)
                      ? "active"
                      : ""
                  }
                  key={look.id}
                  onClick={() => {
                    applyGarments(lookGarments);
                    setSelectedLook(look);
                    setActivePiece(null);
                    setActiveCategory("Shoes");
                  }}
                >
                  <OutfitComposition garments={lookGarments} size="card" />
                  <span>
                    <small>{look.label}</small>
                    <b>{look.title}</b>
                    <em>{look.walking}</em>
                  </span>
                </button>
              );
            })}
          </div>
          {!isComplete && (
            <p className="completion-note">
              <Info /> Add{" "}
              {hasDress || hasSeparates
                ? "shoes"
                : "a dress, or a top and bottom"}{" "}
              to continue.
            </p>
          )}
          <button
            className="primary-action sticky-action"
            disabled={!isComplete}
            onClick={() => setStep(3)}
          >
            Review these {selectedGarments.length} pieces <ChevronRight />
          </button>
        </section>
      )}
      {step === 3 && (
        <section className="try-step">
          <p className="eyebrow">Step 3 · Optional</p>
          <h2>Choose a private reference</h2>
          <p className="step-lede">
            The launch returns an exact outfit board whether or not you add a
            photo.
          </p>
          {photos.length ? (
            <div className="photo-grid">
              {photos.map((item) => (
                <button
                  className={selectedPhoto === item.id ? "active" : ""}
                  key={item.id}
                  onClick={() => setSelectedPhoto(item.id)}
                >
                  <img src={item.src} alt={`${item.label} reference`} />
                  <span>{item.label}</span>
                  <small>{item.note}</small>
                  {selectedPhoto === item.id && (
                    <i>
                      <Check />
                      Selected
                    </i>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="privacy-note">
              <LockKeyhole /> No reference photos saved. You can continue with
              the exact outfit board.
            </p>
          )}
          <button className="secondary-action" onClick={onProfile}>
            <Upload />
            Manage private photos
          </button>
          <button
            className="primary-action sticky-action"
            onClick={() => setStep(4)}
          >
            Review preview <ChevronRight />
          </button>
        </section>
      )}
      {step === 4 && (
        <section className="try-step">
          <p className="eyebrow">Step 4 · Exact selection</p>
          <h2>Review every piece</h2>
          <p className="step-lede">
            This snapshot is locked. Later edits cannot silently change this
            result.
          </p>
          <div className="review-grid">
            {photo?.src && (
              <div className="review-photo">
                <img src={photo.src} alt="Selected private reference" />
                <span>
                  <LockKeyhole />
                  Private
                </span>
              </div>
            )}
            <OutfitComposition garments={selectedGarments} size="room" />
          </div>
          <div className="review-item-list">
            {selectedGarments.map((item) => (
              <div key={item.id}>
                <img src={item.image} alt="" />
                <span>
                  <small>{item.category}</small>
                  <b>{item.name}</b>
                </span>
                <button
                  onClick={() => {
                    setActiveCategory(item.category);
                    setActivePiece(item.id);
                    setStep(2);
                  }}
                >
                  Change
                </button>
              </div>
            ))}
          </div>
          <div className="review-context">
            <div>
              <span>Where</span>
              <b>{location}</b>
            </div>
            <div>
              <span>For</span>
              <b>{event}</b>
            </div>
            <div>
              <span>Weather</span>
              <b>{liveWeather}</b>
            </div>
            <div>
              <span>Output</span>
              <b>Exact outfit board</b>
            </div>
          </div>
          <p className="privacy-note">
            <Info />
            Only your selected closet pieces and optional private reference are
            used.
          </p>
          {status !== "idle" && status !== "complete" && (
            <div className="generation-state">
              <LoaderCircle />
              <div>
                <b>
                  {status === "validating"
                    ? "Locking your exact pieces"
                    : "Creating your private board"}
                </b>
              </div>
            </div>
          )}
          <button
            className="primary-action sticky-action"
            disabled={status !== "idle" && status !== "complete"}
            onClick={createPreview}
          >
            <Sparkles />
            Create from these {selectedGarments.length} pieces
          </button>
        </section>
      )}
    </div>
  );
}

function HistoryScreen({
  view,
  setView,
  items,
  closet,
  onProfile,
  onTry,
  onWear,
  onFeedback,
}: {
  view: "worn" | "tried";
  setView: (view: "worn" | "tried") => void;
  items: HistoryEntry[];
  closet: Garment[];
  onProfile: () => void;
  onTry: (look: Look) => void;
  onWear: (look: Look) => void;
  onFeedback: (look: Look) => void;
}) {
  return (
    <div className="standard-page page-wrap">
      <ScreenHeader
        eyebrow="Your style memory"
        title="History"
        onProfile={onProfile}
      />
      <div className="segmented">
        <button
          className={view === "worn" ? "active" : ""}
          aria-pressed={view === "worn"}
          onClick={() => setView("worn")}
        >
          Worn
        </button>
        <button
          className={view === "tried" ? "active" : ""}
          aria-pressed={view === "tried"}
          onClick={() => setView("tried")}
        >
          Tried On
        </button>
      </div>
      {view === "worn" ? (
        <div className="history-feed">
          {items.map((entry) => (
            <article className="history-card" key={entry.id}>
              <div className="history-card-top">
                <div>
                  <span>{entry.date}</span>
                  <b>{entry.context}</b>
                </div>
                <button
                  aria-label={`Update feedback for ${entry.look.title}`}
                  onClick={() => onFeedback(entry.look)}
                >
                  <ChevronRight />
                </button>
              </div>
              <OutfitComposition
                garments={getLookGarments(entry.look, closet)}
                size="card"
              />
              {Boolean(entry.unavailable?.length) && (
                <p className="unavailable-note" role="status">
                  {entry.unavailable?.join(", ")} no longer available. The saved
                  outfit remains in your history.
                </p>
              )}
              <div className="history-copy">
                <h2>{entry.look.title}</h2>
                <p>
                  <CloudSun /> {entry.temp}
                </p>
                <button onClick={() => onFeedback(entry.look)}>
                  {entry.feedback.includes("?") ? (
                    "Add feedback"
                  ) : (
                    <>
                      <Check /> {entry.feedback} · change
                    </>
                  )}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <article className="tried-card">
          <div>
            <p className="eyebrow">Exact outfit boards</p>
            <h2>
              {items.length
                ? "Reopen your saved pieces"
                : "No previews saved yet"}
            </h2>
            <p>
              History reconstructs owned garment snapshots without substituting
              another look.
            </p>
            {items[0] && (
              <div className="card-actions">
                <button
                  className="secondary-action"
                  disabled={Boolean(items[0].unavailable?.length)}
                  onClick={() => onTry(items[0].look)}
                >
                  {items[0].unavailable?.length
                    ? "Pieces unavailable"
                    : "Open preview"}
                </button>
                <button
                  className="primary-action"
                  disabled={Boolean(items[0].unavailable?.length)}
                  onClick={() => onWear(items[0].look)}
                >
                  Wear today
                </button>
              </div>
            )}
          </div>
        </article>
      )}
    </div>
  );
}

function ModelScreen({
  profile,
  setProfile,
  calendar,
  weather,
  closet,
  setCloset,
  dayType,
  setDayType,
  photos,
  setPhotos,
  selected,
  setSelected,
  consent,
  setConsent,
  onBack,
  toast,
}: {
  profile: PilotProfile;
  setProfile: (profile: PilotProfile) => void;
  calendar: CalendarState;
  weather: WeatherState | null;
  closet: Garment[];
  setCloset: (items: Garment[]) => void;
  dayType: string;
  setDayType: (value: string) => void;
  photos: ReferencePhoto[];
  setPhotos: (photos: ReferencePhoto[]) => void;
  selected: string;
  setSelected: (id: string) => void;
  consent: boolean;
  setConsent: (value: boolean) => void;
  onBack: () => void;
  toast: (value: string) => void;
}) {
  const [pendingDeletion, setPendingDeletion] = useState<{
    requestId: string;
    target: string;
  } | null>(null);
  const activeCloset = closet.filter((item) => item.active);
  const signalCount = [
    Boolean(weather),
    calendar.connected,
    activeCloset.length > 0,
    Boolean(profile.latitude && profile.longitude),
    Boolean(profile.styleVibe),
    Boolean(profile.routine),
  ].filter(Boolean).length;
  const updateProfile = <K extends keyof PilotProfile>(
    key: K,
    value: PilotProfile[K],
  ) => setProfile({ ...profile, [key]: value });
  const remove = async (id: string) => {
    if (ROADMAP_ENABLED) {
      try {
        const response = await fetch(
          `/api/reference-photos?id=${encodeURIComponent(id)}`,
          { method: "DELETE" },
        );
        const data = (await response.json().catch(() => null)) as {
          ok?: boolean;
          status?: string;
          deletionId?: string;
        } | null;
        if (!response.ok || data?.status === "pending" || data?.ok === false) {
          if (data?.deletionId)
            setPendingDeletion({ requestId: data.deletionId, target: id });
          throw new Error("DELETION_PENDING");
        }
      } catch {
        toast("Photo deletion is pending — try again");
        return;
      }
    }
    const next = id === "all" ? [] : photos.filter((item) => item.id !== id);
    setPhotos(next);
    setSelected(next[0]?.id || "");
    toast(
      id === "all"
        ? "All reference photos and previews deleted"
        : "Reference photo deleted",
    );
  };
  const retryPendingDeletion = async () => {
    if (!pendingDeletion) return;
    try {
      const response = await fetch(
        `/api/deletions/${pendingDeletion.requestId}`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error("DELETION_PENDING");
      const next =
        pendingDeletion.target === "all"
          ? []
          : photos.filter((item) => item.id !== pendingDeletion.target);
      setPhotos(next);
      setSelected(next[0]?.id || "");
      setPendingDeletion(null);
      toast("Private deletion completed");
    } catch {
      toast("Deletion is still pending — retry in a moment");
    }
  };
  const uploadReference = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !consent) return;
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas
        .getContext("2d")
        ?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value ? resolve(value) : reject(new Error("ENCODE_FAILED")),
          "image/webp",
          0.9,
        ),
      );
      const form = new FormData();
      form.set(
        "photo",
        new File([blob], "reference.webp", { type: "image/webp" }),
      );
      const response = await fetch("/api/reference-photos", {
        method: "POST",
        body: form,
      });
      if (!response.ok) throw new Error("UPLOAD_FAILED");
      const refreshed = await fetch("/api/reference-photos", {
        cache: "no-store",
      });
      const data = (await refreshed.json()) as { photos: ReferencePhoto[] };
      setPhotos(
        data.photos.map((photo) => ({
          ...photo,
          label: photo.label || "Private reference",
          note: photo.note || "Stored privately",
          usable: true,
          isDefault: Boolean(photo.isDefault),
        })),
      );
      if (data.photos[0]) setSelected(data.photos[0].id);
      toast("Reference photo stored privately");
    } catch {
      toast("Use a clear JPEG, PNG, or WebP photo under 12 MB");
    }
    event.target.value = "";
  };
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast("Location is not available in this browser");
      return;
    }
    toast("Asking for location permission…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setProfile({
          ...profile,
          city: "Current location",
          latitude: position.coords.latitude.toFixed(4),
          longitude: position.coords.longitude.toFixed(4),
        });
        toast("Current location added to your pilot");
      },
      () => toast("Location permission was not granted"),
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  };
  const exportPilotPack = () => {
    const pack = {
      version: 1,
      exportedAt: new Date().toISOString(),
      profile,
      dayType,
      closet,
    };
    const blob = new Blob([JSON.stringify(pack, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${profile.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "my"}-pilot-pack.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    toast("Pilot Pack downloaded");
  };
  const importPilotPack = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as {
        version?: number;
        profile?: Partial<PilotProfile>;
        dayType?: string;
        closet?: Garment[];
      };
      if (
        parsed.version !== 1 ||
        !parsed.profile ||
        typeof parsed.profile.name !== "string"
      )
        throw new Error("INVALID_PACK");
      const importedProfile = {
        ...defaultPilotProfile,
        ...parsed.profile,
        preferredFormality: Math.max(
          1,
          Math.min(5, Number(parsed.profile.preferredFormality) || 3),
        ),
      };
      const importedCloset = Array.isArray(parsed.closet)
        ? parsed.closet.filter(
            (item) =>
              item &&
              typeof item.id === "string" &&
              typeof item.name === "string" &&
              typeof item.image === "string" &&
              (item.image.startsWith("/assets/") ||
                item.image.startsWith("data:image/")),
          )
        : [];
      setProfile(importedProfile);
      if (importedCloset.length) setCloset(importedCloset);
      if (typeof parsed.dayType === "string") setDayType(parsed.dayType);
      toast(`Welcome, ${importedProfile.name}. Your pilot is loaded.`);
    } catch {
      toast("That file is not a valid Pilot Pack");
    }
    event.target.value = "";
  };

  return (
    <div className="model-page pilot-setup page-wrap">
      <header className="model-header">
        <button onClick={onBack} aria-label="Back to Today">
          <ArrowLeft />
        </button>
        <div>
          <p className="eyebrow brand-eyebrow">
            <b className="pilot-mark">pilot:</b>
            <span>Your portable second brain</span>
          </p>
          <h1>Make pilot yours</h1>
        </div>
      </header>

      <section className="setup-hero">
        <Brain />
        <div>
          <p className="eyebrow">Your life in · one clear answer out</p>
          <h2>Dress from your real closet.</h2>
          <p>
            Add your plans, preferences, and routines so every recommendation
            feels like you.
          </p>
        </div>
      </section>

      <section className="setup-progress">
        <div>
          <span>{signalCount}/6 signals ready</span>
          <b>{Math.round((signalCount / 6) * 100)}%</b>
        </div>
        <i>
          <span style={{ width: `${(signalCount / 6) * 100}%` }} />
        </i>
      </section>

      <button
        className="primary-action setup-quick-done"
        onClick={() => {
          toast("Your pilot is tuned");
          onBack();
        }}
      >
        <Sparkles /> Save &amp; see today’s look
      </button>

      <section className="brain-sources" aria-label="Your second brain inputs">
        <article className={weather ? "ready" : "needs-attention"}>
          <CloudSun />
          <span>
            <b>Weather</b>
            <small>
              {weather
                ? `${weather.currentTemperature}° · ${weather.condition}`
                : "Refreshing"}
            </small>
          </span>
          <Check />
        </article>
        <article className={calendar.connected ? "ready" : "needs-attention"}>
          <CalendarDays />
          <span>
            <b>Google Calendar</b>
            <small>
              {calendar.connected
                ? "Connected · read only"
                : calendar.configured
                  ? "Ready to connect"
                  : "Setup needed"}
            </small>
          </span>
          {calendar.connected ? <Check /> : <Info />}
        </article>
        <article className={activeCloset.length ? "ready" : "needs-attention"}>
          <Shirt />
          <span>
            <b>Physical closet</b>
            <small>{activeCloset.length} pieces available</small>
          </span>
          <Check />
        </article>
        <article className={profile.latitude ? "ready" : "needs-attention"}>
          <MapPin />
          <span>
            <b>Physical location</b>
            <small>{profile.city}</small>
          </span>
          <Check />
        </article>
        <article className={profile.styleVibe ? "ready" : "needs-attention"}>
          <Heart />
          <span>
            <b>Likes & preferences</b>
            <small>{profile.styleVibe}</small>
          </span>
          <Check />
        </article>
        <article className={profile.routine ? "ready" : "needs-attention"}>
          <History />
          <span>
            <b>Routines</b>
            <small>
              {profile.routine
                ? "Pattern memory added"
                : "Tell pilot your rhythm"}
            </small>
          </span>
          <Check />
        </article>
      </section>

      <section className="setup-section">
        <p className="eyebrow">1 · Identity & place</p>
        <h2>Start with your real life</h2>
        <div className="setup-grid">
          <label className="field-label">
            Your name
            <input
              value={profile.name}
              onChange={(event) => updateProfile("name", event.target.value)}
            />
          </label>
          <label className="field-label">
            Home base
            <input
              value={profile.city}
              onChange={(event) => updateProfile("city", event.target.value)}
            />
          </label>
        </div>
        <button
          className="secondary-action setup-location"
          onClick={useCurrentLocation}
        >
          <MapPin /> Use my current location
        </button>
      </section>

      <section className="setup-section">
        <p className="eyebrow">2 · Taste & preferences</p>
        <h2>Teach pilot what “me” means</h2>
        <div className="setup-grid">
          <label className="field-label">
            Style direction
            <select
              value={profile.styleVibe}
              onChange={(event) =>
                updateProfile("styleVibe", event.target.value)
              }
            >
              <option>Polished feminine</option>
              <option>Minimal and tailored</option>
              <option>Creative and expressive</option>
              <option>Relaxed and practical</option>
              <option>Classic and timeless</option>
            </select>
          </label>
          <label className="field-label">
            Preferred formality · {profile.preferredFormality}/5
            <input
              type="range"
              min="1"
              max="5"
              value={profile.preferredFormality}
              onChange={(event) =>
                updateProfile("preferredFormality", Number(event.target.value))
              }
            />
          </label>
        </div>
        <label className="field-label">
          Colors I reach for
          <input
            value={profile.favoriteColors}
            onChange={(event) =>
              updateProfile("favoriteColors", event.target.value)
            }
          />
        </label>
        <label className="field-label">
          Things to avoid
          <input
            value={profile.avoid}
            onChange={(event) => updateProfile("avoid", event.target.value)}
          />
        </label>
      </section>

      <section className="setup-section">
        <p className="eyebrow">3 · Apps & routines</p>
        <h2>Connect the rest of your brain</h2>
        <label className="field-label">
          My usual rhythm
          <textarea
            rows={3}
            value={profile.routine}
            onChange={(event) => updateProfile("routine", event.target.value)}
          />
        </label>
        <label className="field-label">
          Other apps I rely on
          <input
            value={profile.otherApps}
            onChange={(event) => updateProfile("otherApps", event.target.value)}
            placeholder="Maps, Notes, Todoist, Strava…"
          />
        </label>
        <label className="field-label">
          Decisions I want on autopilot
          <textarea
            rows={2}
            value={profile.autopilotGoals}
            onChange={(event) =>
              updateProfile("autopilotGoals", event.target.value)
            }
          />
        </label>
        <div
          className={`calendar-connect-card ${calendar.connected ? "connected" : ""}`}
        >
          <span className="calendar-mark">
            <CalendarDays />
          </span>
          <div>
            <b>Google Calendar</b>
            <small>
              {calendar.connected
                ? "Live events are part of your daily context"
                : calendar.configured
                  ? "Authorize read-only event context"
                  : "OAuth credentials must be configured for this deployment"}
            </small>
          </div>
          {calendar.connected ? (
            <span className="connected-pill">
              <Check /> Live
            </span>
          ) : calendar.configured ? (
            <button
              onClick={() => window.location.assign("/api/calendar/connect")}
            >
              Connect <ChevronRight />
            </button>
          ) : (
            <span className="connected-pill">Setup</span>
          )}
        </div>
      </section>

      <section className="setup-section pilot-pack">
        <p className="eyebrow">4 · Lift & shift</p>
        <h2>Take your pilot with you</h2>
        <p>
          Export one private Pilot Pack containing your profile, closet
          metadata, routines, and preferences. Import it on another device or
          use it as the starting point for another person.
        </p>
        <div>
          <button className="secondary-action" onClick={exportPilotPack}>
            <Download /> Export my Pilot Pack
          </button>
          <label className="secondary-action">
            <input
              type="file"
              accept="application/json,.json"
              onChange={importPilotPack}
            />
            <FileUp /> Import a Pilot Pack
          </label>
        </div>
      </section>

      <button
        className="primary-action setup-done"
        onClick={() => {
          toast("Your pilot is tuned");
          onBack();
        }}
      >
        <Sparkles /> Save &amp; see today’s look
      </button>

      <section className="private-model-section">
        <p className="eyebrow">Private visual model</p>
        <h2>Your photos belong to you</h2>
        <section className="model-intro">
          <LockKeyhole />
          <div>
            <h2>Private by design</h2>
            <p>
              Reference photos use private storage and five-minute signed
              access.
            </p>
          </div>
        </section>
        <label className="consent-row">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            I am the person shown or have permission for private outfit
            previews.
          </span>
        </label>
        <div className="capture-guide">
          <h2>Best results</h2>
          <div>
            <span>1</span>
            <p>
              <b>Full body</b>
              <small>Head and shoes in frame</small>
            </p>
          </div>
          <div>
            <span>2</span>
            <p>
              <b>Simple pose</b>
              <small>Arms relaxed</small>
            </p>
          </div>
          <div>
            <span>3</span>
            <p>
              <b>Even light</b>
              <small>Clear garment edges</small>
            </p>
          </div>
        </div>
        <label className={`upload-model ${!consent ? "disabled" : ""}`}>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={!consent}
            onChange={uploadReference}
          />
          <ImagePlus />
          <b>Add reference photo</b>
          <span>Re-encoded before private storage</span>
        </label>
        <div className="model-photo-list">
          {photos.map((photo) => (
            <article key={photo.id}>
              <img src={photo.src} alt={`${photo.label} reference`} />
              <div>
                <b>{photo.label}</b>
                <p>{photo.note}</p>
                <span className="usable">Stored privately</span>
                <div>
                  <button
                    onClick={() => {
                      setSelected(photo.id);
                      toast("Default reference updated");
                    }}
                  >
                    {selected === photo.id ? (
                      <>
                        <Check />
                        Default
                      </>
                    ) : (
                      "Make default"
                    )}
                  </button>
                  <button onClick={() => void remove(photo.id)}>
                    <Trash2 />
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        {photos.length > 0 && (
          <button className="danger-action" onClick={() => void remove("all")}>
            <Trash2 />
            Delete all photos and try-ons
          </button>
        )}
        {pendingDeletion && (
          <button
            className="secondary-action"
            onClick={() => void retryPendingDeletion()}
          >
            <RefreshCw /> Retry pending deletion
          </button>
        )}
        <p className="model-footnote">
          The app does not infer measurements, age, ethnicity, health,
          attractiveness, or other sensitive traits.
        </p>
      </section>
    </div>
  );
}

function PlansSheet({
  calendar,
  dayType,
  setDayType,
  onDone,
}: {
  calendar: CalendarState;
  dayType: string;
  setDayType: (value: string) => void;
  onDone: () => void;
}) {
  return (
    <div className="sheet-content calendar-sheet">
      <p className="eyebrow brand-eyebrow">
        <b className="pilot-mark">pilot:</b>
        <span>One less decision</span>
      </p>
      <h2>Plan once. Dress on autopilot.</h2>
      <p className="sheet-lede">
        pilot reads only the context needed to dress well — time, event title,
        and general place — then combines it with weather and your closet.
      </p>
      <div
        className={`calendar-connect-card ${calendar.connected && calendar.mode !== "expired" ? "connected" : ""}`}
      >
        <span className="calendar-mark">
          <CalendarDays />
        </span>
        <div>
          <b>Google Calendar</b>
          <small>
            {calendar.mode === "expired"
              ? "Connection expired · reconnect"
              : calendar.connected
                ? "Connected · read only"
                : calendar.configured
                  ? "Ready to connect · read only"
                  : "Calendar credentials need to be configured"}
          </small>
        </div>
        {calendar.mode === "expired" ? (
          <button
            onClick={() => window.location.assign("/api/calendar/connect")}
          >
            Reconnect <ChevronRight />
          </button>
        ) : calendar.connected ? (
          <span className="connected-pill">
            <Check /> Live
          </span>
        ) : calendar.configured ? (
          <button
            onClick={() => window.location.assign("/api/calendar/connect")}
          >
            Connect <ChevronRight />
          </button>
        ) : (
          <span className="connected-pill">Setup needed</span>
        )}
      </div>
      <p className="calendar-privacy">
        <LockKeyhole /> No event descriptions, guest lists, or private addresses
        are sent to the styling layer.
      </p>
      <div className="calendar-flow" aria-label="How pilot makes the decision">
        <span>
          <b>1</b> Plans
        </span>
        <ChevronRight />
        <span>
          <b>2</b> Weather
        </span>
        <ChevronRight />
        <span>
          <b>3</b> Decision
        </span>
      </div>
      <p className="choice-label">Or set the day yourself</p>
      <div className="choice-grid">
        {[
          "Office → Dinner",
          "Office",
          "WFH",
          "Casual",
          "Date night",
          "Event",
        ].map((item) => (
          <button
            className={dayType === item ? "active" : ""}
            key={item}
            onClick={() => setDayType(item)}
          >
            {item}
            {dayType === item && <Check />}
          </button>
        ))}
      </div>
      <button className="primary-action" onClick={onDone}>
        Put today on autopilot
      </button>
    </div>
  );
}

function OutfitSheet({
  look,
  garments,
  onTry,
  onWear,
  toast,
}: {
  look: Look;
  garments: Garment[];
  onTry: () => void;
  onWear: () => void;
  toast: (value: string) => void;
}) {
  return (
    <div className="sheet-content">
      <p className="eyebrow">{look.label}</p>
      <h2>Why this works</h2>
      <OutfitComposition garments={garments} size="room" />
      <p className="sheet-lede">
        {look.reason} {look.note}
      </p>
      <div className="score-row">
        <span>
          Weather fit <b>Strong</b>
        </span>
        <span>
          Warmth <b>{look.warmth}/5</b>
        </span>
        <span>
          Formality <b>{look.formality}/5</b>
        </span>
        <span>
          Walking <b>{look.walking}</b>
        </span>
      </div>
      <div className="card-actions">
        <button className="secondary-action" onClick={onTry}>
          <Sparkles /> Try it on
        </button>
        <button className="primary-action" onClick={onWear}>
          Wear today
        </button>
      </div>
      <div className="reason-list">
        {[
          "Change a piece",
          "Too warm",
          "Too cold",
          "Not my style",
          "Item unavailable",
          "In laundry",
        ].map((item) => (
          <button
            key={item}
            onClick={() =>
              toast(`${item} noted — the rest of the look stays stable`)
            }
          >
            {item}
            <ChevronRight />
          </button>
        ))}
      </div>
    </div>
  );
}

function ItemSheet({
  item,
  onLaundry,
  onDelete,
}: {
  item: Garment;
  onLaundry: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="sheet-content item-detail">
      <div className="detail-image">
        <img src={item.image} alt={`${item.color} ${item.subcategory}`} />
        <span>
          {item.inventoryType === "sample" ? "Starter Closet" : "My Closet"}
        </span>
      </div>
      <p className="eyebrow">{item.brand}</p>
      <h2>{item.name}</h2>
      <div className="property-row">
        <span>{item.color}</span>
        <span>{item.subcategory}</span>
        <span>Warmth {item.warmth}/5</span>
      </div>
      <p className="sheet-lede">
        {item.material}
        <br />
        {item.occasions.join(" · ")}
      </p>
      <button
        className={item.laundry ? "primary-action" : "secondary-action"}
        onClick={onLaundry}
      >
        {item.laundry ? (
          <>
            <Check /> Mark available
          </>
        ) : (
          <>
            <Droplets /> Move to laundry
          </>
        )}
      </button>
      <button className="danger-action" onClick={onDelete}>
        <Trash2 /> Remove item
      </button>
    </div>
  );
}

function AddSheet({
  step,
  image,
  onPhoto,
  setStep,
  onSave,
}: {
  step: number;
  image: string | null;
  onPhoto: (event: ChangeEvent<HTMLInputElement>) => void;
  setStep: (step: number) => void;
  onSave: () => void;
}) {
  if (step === 1)
    return (
      <div className="sheet-content">
        <p className="eyebrow">Add to My Closet</p>
        <h2>Start with a clear photo</h2>
        <p className="sheet-lede">
          Lay the item flat or hang it against a simple background.
        </p>
        <label className="upload-zone">
          <input type="file" accept="image/*" onChange={onPhoto} />
          <ImagePlus />
          <b>Take or upload photo</b>
          <span>JPG, PNG or HEIC</span>
        </label>
        <button className="secondary-action" onClick={() => setStep(2)}>
          Use sample photo
        </button>
      </div>
    );
  if (step === 2)
    return (
      <div className="sheet-content">
        <p className="eyebrow">Preparing your item</p>
        <h2>Removing the background</h2>
        <div className="analysis-preview">
          <img src={image || starterCloset[0].image} alt="Garment preview" />
          <div>
            <span>
              <Check /> Crop and rotation ready
            </span>
            <span>
              <Check /> Background removed
            </span>
            <span>
              <LoaderCircle /> Analyzing details
            </span>
          </div>
        </div>
        <button className="primary-action" onClick={() => setStep(3)}>
          Review cutout
        </button>
      </div>
    );
  return (
    <div className="sheet-content">
      <p className="eyebrow">Original · Cutout · Dimensional</p>
      <h2>Confirm your item</h2>
      <div className="analysis-preview dimensional">
        <img
          src={image || starterCloset[0].image}
          alt="Confirmed garment cutout"
        />
      </div>
      <label className="field-label">
        Name
        <input defaultValue="Cream textured cardigan" />
      </label>
      <label className="field-label">
        Category
        <select defaultValue="Tops">
          <option>Tops</option>
          <option>Bottoms</option>
          <option>Dresses</option>
          <option>Outerwear</option>
          <option>Shoes</option>
        </select>
      </label>
      <p className="privacy-note">
        <Info /> Material is inferred until you confirm it.
      </p>
      <button className="primary-action" onClick={onSave}>
        Save to My Closet
      </button>
    </div>
  );
}

function FeedbackSheet({
  onFeedback,
}: {
  onFeedback: (value: {
    style: "loved" | "not_for_me";
    temperature: "too_cold" | "just_right" | "too_warm";
  }) => void | Promise<void>;
}) {
  const [style, setStyle] = useState<"loved" | "not_for_me" | undefined>();
  const [temperature, setTemperature] = useState<
    "too_cold" | "just_right" | "too_warm" | undefined
  >();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const save = async () => {
    if (!style || !temperature || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await onFeedback({ style, temperature });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <div className="sheet-content">
      <p className="eyebrow">A quick check-in</p>
      <h2>How did it feel?</h2>
      <p className="choice-label">Style</p>
      <div className="feedback-row">
        <button
          className={style === "loved" ? "active" : ""}
          aria-pressed={style === "loved"}
          onClick={() => setStyle("loved")}
        >
          <Heart />
          Loved it
        </button>
        <button
          className={style === "not_for_me" ? "active" : ""}
          aria-pressed={style === "not_for_me"}
          onClick={() => setStyle("not_for_me")}
        >
          Not for me
        </button>
      </div>
      <p className="choice-label">Temperature</p>
      <div className="feedback-row">
        <button
          className={temperature === "too_cold" ? "active" : ""}
          aria-pressed={temperature === "too_cold"}
          onClick={() => setTemperature("too_cold")}
        >
          Too cold
        </button>
        <button
          className={temperature === "just_right" ? "active" : ""}
          aria-pressed={temperature === "just_right"}
          onClick={() => setTemperature("just_right")}
        >
          Just right
        </button>
        <button
          className={temperature === "too_warm" ? "active" : ""}
          aria-pressed={temperature === "too_warm"}
          onClick={() => setTemperature("too_warm")}
        >
          Too warm
        </button>
      </div>
      <button
        className="primary-action"
        disabled={!style || !temperature || saving}
        onClick={() => void save()}
      >
        {saving ? "Saving…" : "Save feedback"}
      </button>
    </div>
  );
}

function InviteLogin() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as {
        message?: string;
        error?: { message?: string };
      };
      setMessage(
        data.message || data.error?.message || "Sign-in could not be started.",
      );
    } catch {
      setMessage("Sign-in could not be started. Check your connection.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="app-shell">
      <div className="model-page pilot-setup page-wrap">
        <section className="setup-hero">
          <Brain />
          <div>
            <p className="eyebrow brand-eyebrow">
              <b className="pilot-mark">pilot:</b>
              <span>Invite-only wardrobe</span>
            </p>
            <h1>Dress from what you own.</h1>
            <p>
              One private outfit decision from your closet, plans, and weather.
            </p>
          </div>
        </section>
        <form className="setup-section" onSubmit={submit}>
          <label className="field-label">
            Invited email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <button className="primary-action" disabled={loading}>
            {loading ? <LoaderCircle /> : <LockKeyhole />}
            {loading ? "Sending…" : "Email me a private link"}
          </button>
          {message && (
            <p role="status" className="privacy-note">
              {message}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}

function ShoppingSheet({
  onDone,
  toast,
}: {
  onDone: () => void;
  toast: (value: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const actionInFlight = useRef(false);
  const [result, setResult] = useState<{
    id: string;
    decision: string;
    rationale: string;
    duplicateScore: number;
    strongOutfitCount: number;
  } | null>(null);
  const analyze = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas
        .getContext("2d")
        ?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value ? resolve(value) : reject(new Error("ENCODE_FAILED")),
          "image/webp",
          0.9,
        ),
      );
      const form = new FormData();
      form.set(
        "screenshot",
        new File([blob], "shopping.webp", { type: "image/webp" }),
      );
      if (!ROADMAP_ENABLED) {
        await new Promise((resolve) => window.setTimeout(resolve, 450));
        setResult({
          id: "demo-shopping-analysis",
          decision: "buy",
          rationale:
            "It adds a new option and works with at least three outfits already in this closet.",
          duplicateScore: 0.34,
          strongOutfitCount: 3,
        });
        return;
      }
      const response = await fetch("/api/shopping/analyses", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(20_000),
      });
      const data = (await response.json()) as {
        analysis?: {
          id: string;
          decision: string;
          rationale: string;
          duplicateScore: number;
          strongOutfitCount: number;
        };
        error?: { message: string };
      };
      if (!response.ok)
        throw new Error(
          data.error?.message || "This screenshot could not be analyzed",
        );
      setResult(data.analysis || null);
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Use a JPEG, PNG, or WebP screenshot under 10 MB",
      );
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  };
  const act = async (action: "save" | "bought") => {
    if (!result || actionInFlight.current) return;
    actionInFlight.current = true;
    setLoading(true);
    try {
      if (!ROADMAP_ENABLED) {
        await new Promise((resolve) => window.setTimeout(resolve, 250));
        toast(
          action === "save"
            ? "Saved for this demo"
            : "Added to the demo closet",
        );
        onDone();
        return;
      }
      const response = await fetch(`/api/shopping/analyses/${result.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) throw new Error("SHOPPING_ACTION_FAILED");
      toast(action === "save" ? "Saved for later" : "Added to My Closet");
      onDone();
    } catch {
      toast(
        action === "save"
          ? "This item could not be saved"
          : "This purchase could not be added",
      );
    } finally {
      actionInFlight.current = false;
      setLoading(false);
    }
  };
  return (
    <div className="sheet-content">
      <p className="eyebrow">Shopping decision</p>
      <h2>{result ? result.decision.toUpperCase() : "Should I buy this?"}</h2>
      {result ? (
        <>
          <p className="sheet-lede">{result.rationale}</p>
          <div className="score-row">
            <span>
              Duplicate risk <b>{Math.round(result.duplicateScore * 100)}%</b>
            </span>
            <span>
              Strong outfits <b>{result.strongOutfitCount}</b>
            </span>
          </div>
          <div className="card-actions">
            <button
              className="secondary-action"
              disabled={loading}
              onClick={() => void act("save")}
            >
              Save
            </button>
            <button
              className="primary-action"
              disabled={loading}
              onClick={() => void act("bought")}
            >
              I bought it
            </button>
          </div>
          <button className="secondary-action" onClick={onDone}>
            Done
          </button>
        </>
      ) : (
        <>
          <p className="sheet-lede">
            Upload one product screenshot. Pilot compares it with your owned
            closet.
          </p>
          <label className="upload-zone">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={analyze}
              disabled={loading}
            />
            {loading ? <LoaderCircle /> : <ImagePlus />}
            <b>
              {loading ? "Comparing with your closet…" : "Choose screenshot"}
            </b>
            <span>Buy, Save, or Skip</span>
          </label>
        </>
      )}
    </div>
  );
}
