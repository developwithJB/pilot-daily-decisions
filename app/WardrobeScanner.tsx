"use client";
/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  ImagePlus,
  Info,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Category, Garment } from "../lib/demo-data";

const ROADMAP_ENABLED =
  process.env.NEXT_PUBLIC_ROADMAP_BUNDLE_ENABLED === "true";

export type WardrobeLearning = {
  totalScans: number;
  photosScanned: number;
  itemsConfirmed: number;
  itemsRejected: number;
  itemsMerged: number;
  categoryCounts: Record<string, number>;
  colorCounts: Record<string, number>;
  updatedAt?: string;
};

type PreparedPhoto = {
  id: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
  dominantColor: string;
  status: "ready" | "scanning" | "done" | "error";
};
type Detection = {
  id: string;
  photoId: string;
  name: string;
  category: Category;
  subcategory: string;
  color: string;
  material: string;
  warmth: number;
  formality: number;
  seasons: string[];
  occasions: string[];
  confidence: number;
  thumbnail: string;
  fingerprint: string;
  keep: boolean;
  possibleDuplicate?: string;
  analysisMode: "ai" | "guided";
  bbox: Bbox;
  cropZoom: number;
  cropX: number;
  cropY: number;
};
type Bbox = { x: number; y: number; width: number; height: number };
type Stage =
  "pick" | "preparing" | "scanning" | "review" | "saving" | "complete";
type ScanResult = {
  analysisMode: "ai" | "guided";
  detections: Array<
    Omit<
      Detection,
      | "id"
      | "photoId"
      | "thumbnail"
      | "fingerprint"
      | "keep"
      | "possibleDuplicate"
      | "analysisMode"
    > & { bbox: Bbox }
  >;
};

const emptyLearning: WardrobeLearning = {
  totalScans: 0,
  photosScanned: 0,
  itemsConfirmed: 0,
  itemsRejected: 0,
  itemsMerged: 0,
  categoryCounts: {},
  colorCounts: {},
};
const categories: Category[] = [
  "Tops",
  "Bottoms",
  "Dresses",
  "Outerwear",
  "Shoes",
];
const palette = [
  ["Black", 34, 34, 33],
  ["White", 239, 237, 230],
  ["Ivory", 226, 217, 196],
  ["Beige", 190, 169, 139],
  ["Brown", 111, 76, 54],
  ["Gray", 130, 132, 129],
  ["Navy", 42, 54, 77],
  ["Blue", 74, 114, 154],
  ["Green", 76, 104, 73],
  ["Red", 153, 61, 57],
  ["Pink", 200, 132, 143],
  ["Purple", 112, 77, 121],
  ["Yellow", 205, 169, 74],
  ["Orange", 190, 107, 55],
] as const;

function blobFromCanvas(
  canvas: HTMLCanvasElement,
  type = "image/webp",
  quality = 0.82,
) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("IMAGE_EXPORT_FAILED")),
      type,
      quality,
    ),
  );
}

function dataUrlFromBlob(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("IMAGE_READ_FAILED"));
    reader.onerror = () =>
      reject(reader.error || new Error("IMAGE_READ_FAILED"));
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("IMAGE_DECODE_FAILED"));
    image.src = src;
  });
}

function colorName(context: CanvasRenderingContext2D) {
  const { data } = context.getImageData(
    0,
    0,
    context.canvas.width,
    context.canvas.height,
  );
  let r = 0,
    g = 0,
    b = 0,
    weight = 0;
  for (let index = 0; index < data.length; index += 4) {
    const brightness = (data[index] + data[index + 1] + data[index + 2]) / 3;
    if (data[index + 3] < 200 || brightness > 248) continue;
    const sampleWeight = brightness < 18 ? 0.2 : 1;
    r += data[index] * sampleWeight;
    g += data[index + 1] * sampleWeight;
    b += data[index + 2] * sampleWeight;
    weight += sampleWeight;
  }
  if (!weight) return "Neutral";
  r /= weight;
  g /= weight;
  b /= weight;
  return palette.reduce(
    (best, sample) => {
      const distance =
        (sample[1] - r) ** 2 + (sample[2] - g) ** 2 + (sample[3] - b) ** 2;
      return distance < best.distance ? { name: sample[0], distance } : best;
    },
    { name: "Neutral", distance: Number.POSITIVE_INFINITY },
  ).name;
}

async function preparePhoto(file: File, index: number): Promise<PreparedPhoto> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const maxEdge = 1600;
    const scale = Math.min(
      1,
      maxEdge / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("CANVAS_UNAVAILABLE");
    context.fillStyle = "#f4f1e9";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const sample = document.createElement("canvas");
    sample.width = 24;
    sample.height = 24;
    const sampleContext = sample.getContext("2d", { willReadFrequently: true });
    if (!sampleContext) throw new Error("CANVAS_UNAVAILABLE");
    sampleContext.drawImage(canvas, 0, 0, 24, 24);
    let blob: Blob;
    try {
      blob = await blobFromCanvas(canvas);
    } catch {
      blob = await blobFromCanvas(canvas, "image/jpeg", 0.84);
    }
    return {
      id: `photo-${Date.now()}-${index}`,
      name: file.name || `Photo ${index + 1}`,
      dataUrl: await dataUrlFromBlob(blob),
      width,
      height,
      dominantColor: colorName(sampleContext),
      status: "ready",
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function cropDetection(
  photo: PreparedPhoto,
  bbox: Bbox,
  zoom = 1,
  offsetX = 0,
  offsetY = 0,
) {
  const image = await loadImage(photo.dataUrl);
  const x = Math.max(
    0,
    Math.min(image.naturalWidth - 1, bbox.x * image.naturalWidth),
  );
  const y = Math.max(
    0,
    Math.min(image.naturalHeight - 1, bbox.y * image.naturalHeight),
  );
  const width = Math.max(
    1,
    Math.min(image.naturalWidth - x, bbox.width * image.naturalWidth),
  );
  const height = Math.max(
    1,
    Math.min(image.naturalHeight - y, bbox.height * image.naturalHeight),
  );
  const padding = Math.max(width, height) * 0.08;
  const side = (Math.max(width, height) + padding * 2) / Math.max(1, zoom);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("CANVAS_UNAVAILABLE");
  context.fillStyle = "#f4f1e9";
  context.fillRect(0, 0, 512, 512);
  const centerX = x + width / 2 + offsetX * width * 0.24;
  const centerY = y + height / 2 + offsetY * height * 0.24;
  const sourceX = Math.max(
    0,
    Math.min(image.naturalWidth - side, centerX - side / 2),
  );
  const sourceY = Math.max(
    0,
    Math.min(image.naturalHeight - side, centerY - side / 2),
  );
  const sourceSide = Math.min(
    side,
    image.naturalWidth - sourceX,
    image.naturalHeight - sourceY,
  );
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSide,
    sourceSide,
    0,
    0,
    512,
    512,
  );
  return dataUrlFromBlob(await blobFromCanvas(canvas, "image/webp", 0.8));
}

function signalText(learning: WardrobeLearning) {
  const topCategory = Object.entries(learning.categoryCounts).sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0];
  const topColors = Object.entries(learning.colorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([color]) => color);
  if (!learning.totalScans)
    return "This first scan starts your personal style memory.";
  if (topCategory && topColors.length)
    return `You add ${topCategory.toLowerCase()} most often, especially ${topColors.join(" and ").toLowerCase()}.`;
  return `${learning.itemsConfirmed} confirmed closet signals are now part of your style memory.`;
}

export default function WardrobeScanner({
  closet,
  initialLearning = emptyLearning,
  onComplete,
  onDone,
}: {
  closet: Garment[];
  initialLearning?: WardrobeLearning;
  onComplete: (items: Garment[], learning: WardrobeLearning) => void;
  onDone: () => void;
}) {
  const [stage, setStage] = useState<Stage>("pick");
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [learning, setLearning] = useState(initialLearning);
  const [activeCrop, setActiveCrop] = useState<string | null>(null);
  const kept = detections.filter((item) => item.keep);
  const mode = detections.some((item) => item.analysisMode === "guided")
    ? "guided"
    : "ai";
  const topSignals = useMemo(() => signalText(learning), [learning]);

  const choosePhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []).slice(0, 12);
    event.target.value = "";
    if (!selected.length) return;
    const valid = selected.filter(
      (file) =>
        file.size <= 25_000_000 &&
        (file.type.startsWith("image/") ||
          /\.(heic|heif|jpe?g|png|webp)$/i.test(file.name)),
    );
    if (!valid.length) {
      setError("Choose HEIC, JPG, PNG, or WebP photos under 25 MB each.");
      return;
    }
    setError(
      valid.length < selected.length
        ? "A photo that was too large or unsupported was skipped."
        : null,
    );
    setStage("preparing");
    setProgress(0);
    const prepared: PreparedPhoto[] = [];
    for (let index = 0; index < valid.length; index++) {
      try {
        prepared.push(await preparePhoto(valid[index], index));
      } catch {
        /* iOS can expose an undecodable cloud placeholder */
      }
      setProgress(Math.round(((index + 1) / valid.length) * 100));
    }
    if (!prepared.length) {
      setStage("pick");
      setError(
        "These photos could not be prepared. Download them to your iPhone first, then try again.",
      );
      return;
    }
    setPhotos(prepared);
    setStage("scanning");
    setProgress(0);
    const found: Detection[] = [];
    for (let index = 0; index < prepared.length; index++) {
      const photo = prepared[index];
      setPhotos((items) =>
        items.map((item) =>
          item.id === photo.id ? { ...item, status: "scanning" } : item,
        ),
      );
      try {
        let result: ScanResult;
        if (!ROADMAP_ENABLED) {
          await new Promise((resolve) => window.setTimeout(resolve, 350));
          result = {
            analysisMode: "guided",
            detections: [
              {
                name: `${photo.dominantColor} closet piece`,
                category: "Tops",
                subcategory: "Top",
                color: photo.dominantColor,
                material: "Material to confirm",
                warmth: 2,
                formality: 3,
                seasons: ["Spring", "Summer", "Fall"],
                occasions: ["Office", "Casual", "Dinner"],
                confidence: 72,
                bbox: { x: 0.08, y: 0.08, width: 0.84, height: 0.84 },
                cropZoom: 1,
                cropX: 0,
                cropY: 0,
              },
            ],
          };
        } else {
          const response = await fetch("/api/wardrobe/scan", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              image: photo.dataUrl,
              photoIndex: index,
              dominantColor: photo.dominantColor,
            }),
            signal: AbortSignal.timeout(20_000),
          });
          if (!response.ok) throw new Error("SCAN_FAILED");
          result = (await response.json()) as ScanResult;
        }
        for (
          let itemIndex = 0;
          itemIndex < result.detections.length;
          itemIndex++
        ) {
          const item = result.detections[itemIndex];
          const fingerprint =
            `${item.category}|${item.subcategory}|${item.color}`
              .toLowerCase()
              .replace(/[^a-z0-9|]+/g, "-");
          const duplicate =
            closet.find(
              (known) =>
                `${known.category}|${known.subcategory}|${known.color}`
                  .toLowerCase()
                  .replace(/[^a-z0-9|]+/g, "-") === fingerprint,
            ) || found.find((known) => known.fingerprint === fingerprint);
          found.push({
            ...item,
            id: `detection-${photo.id}-${itemIndex}`,
            photoId: photo.id,
            thumbnail: await cropDetection(photo, item.bbox),
            fingerprint,
            keep: true,
            possibleDuplicate: duplicate?.name,
            analysisMode: result.analysisMode,
            bbox: item.bbox,
            cropZoom: 1,
            cropX: 0,
            cropY: 0,
          });
        }
        setPhotos((items) =>
          items.map((entry) =>
            entry.id === photo.id ? { ...entry, status: "done" } : entry,
          ),
        );
      } catch {
        setPhotos((items) =>
          items.map((entry) =>
            entry.id === photo.id ? { ...entry, status: "error" } : entry,
          ),
        );
      }
      setProgress(Math.round(((index + 1) / prepared.length) * 100));
    }
    if (!found.length) {
      setStage("pick");
      setError(
        "pilot could not find a clear wardrobe piece. Try a closer photo with the full item visible.",
      );
      return;
    }
    setDetections(found);
    setStage("review");
  };

  const update = (id: string, changes: Partial<Detection>) =>
    setDetections((items) =>
      items.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  const adjustCrop = async (
    id: string,
    changes: Pick<Partial<Detection>, "cropZoom" | "cropX" | "cropY">,
  ) => {
    const item = detections.find((entry) => entry.id === id);
    const photo = photos.find((entry) => entry.id === item?.photoId);
    if (!item || !photo) return;
    const next = { ...item, ...changes };
    update(id, changes);
    try {
      update(id, {
        thumbnail: await cropDetection(
          photo,
          next.bbox,
          next.cropZoom,
          next.cropX,
          next.cropY,
        ),
      });
    } catch {
      setError("That crop could not be updated. Your last crop is still safe.");
    }
  };
  const save = async () => {
    if (!kept.length) {
      setError("Keep at least one piece before saving.");
      return;
    }
    setError(null);
    setStage("saving");
    try {
      if (!ROADMAP_ENABLED) {
        await new Promise((resolve) => window.setTimeout(resolve, 350));
        const items: Garment[] = kept.map((item, index) => ({
          id: `demo-scan-${Date.now()}-${index}`,
          name: item.name,
          brand: "My Closet",
          category: item.category,
          subcategory: item.subcategory,
          color: item.color,
          material: item.material,
          warmth: item.warmth,
          formality: item.formality,
          seasons: item.seasons,
          occasions: item.occasions,
          rainCompatible: false,
          image: item.thumbnail,
          inventoryType: "owned",
          laundry: false,
          active: true,
          worn: 0,
          learnedFrom: "scan",
          confidence: item.confidence,
          scanCount: 1,
        }));
        const nextLearning: WardrobeLearning = {
          ...learning,
          totalScans: learning.totalScans + 1,
          photosScanned: learning.photosScanned + photos.length,
          itemsConfirmed: learning.itemsConfirmed + items.length,
          categoryCounts: items.reduce(
            (counts, item) => ({
              ...counts,
              [item.category]: (counts[item.category] || 0) + 1,
            }),
            { ...learning.categoryCounts },
          ),
          colorCounts: items.reduce(
            (counts, item) => ({
              ...counts,
              [item.color]: (counts[item.color] || 0) + 1,
            }),
            { ...learning.colorCounts },
          ),
          updatedAt: new Date().toISOString(),
        };
        setLearning(nextLearning);
        onComplete(items, nextLearning);
        setPhotos([]);
        setStage("complete");
        return;
      }
      const response = await fetch("/api/wardrobe/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          photoCount: photos.length,
          detectedCount: detections.length,
          analysisMode: mode,
          items: kept.map(
            ({
              name,
              category,
              subcategory,
              color,
              material,
              warmth,
              formality,
              seasons,
              occasions,
              confidence,
              thumbnail,
              fingerprint,
            }) => ({
              name,
              category,
              subcategory,
              color,
              material,
              warmth,
              formality,
              seasons,
              occasions,
              confidence,
              thumbnail,
              fingerprint,
            }),
          ),
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error("SAVE_FAILED");
      const result = (await response.json()) as {
        items: Garment[];
        learning: WardrobeLearning;
        mergedCount: number;
      };
      setLearning(result.learning);
      onComplete(result.items, result.learning);
      setPhotos([]);
      setStage("complete");
    } catch {
      setStage("review");
      setError(
        "Your pieces could not be saved. Nothing was lost—please try again.",
      );
    }
  };

  if (stage === "complete")
    return (
      <div className="sheet-content scan-complete">
        <span className="complete-orbit">
          <Check />
        </span>
        <p className="eyebrow">Style memory updated</p>
        <h2>pilot learned something new.</h2>
        <p>{topSignals}</p>
        <div className="learning-stats">
          <span>
            <b>{learning.itemsConfirmed}</b>closet signals
          </span>
          <span>
            <b>{learning.photosScanned}</b>photos scanned
          </span>
          <span>
            <b>{learning.totalScans}</b>learning loops
          </span>
        </div>
        <button
          className="primary-action"
          onClick={() => {
            setStage("pick");
            setDetections([]);
            setProgress(0);
          }}
        >
          Scan more photos
        </button>
        <button className="secondary-action" onClick={onDone}>
          See my closet
        </button>
      </div>
    );

  return (
    <div className="sheet-content wardrobe-scanner">
      <p className="eyebrow">
        Wardrobe scan · {stage === "review" ? "Review" : "Private import"}
      </p>
      <h2>
        {stage === "review"
          ? `pilot found ${detections.length} ${detections.length === 1 ? "piece" : "pieces"}`
          : "Your photos in. Your closet out."}
      </h2>
      {stage === "pick" && (
        <>
          <p className="sheet-lede">
            Choose up to 12 photos from your iPhone. Outfit photos, closet
            rails, flat lays, and shoe photos all work.
          </p>
          <div className="scan-steps">
            <span>
              <b>1</b> Pick photos
            </span>
            <ChevronRight />
            <span>
              <b>2</b> Review pieces
            </span>
            <ChevronRight />
            <span>
              <b>3</b> Teach pilot
            </span>
          </div>
          <label className="upload-zone">
            <input
              type="file"
              accept="image/*,.heic,.heif"
              multiple
              onChange={choosePhotos}
            />
            <ImagePlus />
            <b>Choose from Photos</b>
            <span>Multiple photos · HEIC, JPG or PNG</span>
          </label>
          <div className="scan-privacy">
            <LockKeyhole />
            <span>
              <b>Originals stay temporary</b>
              <small>
                pilot strips photo metadata, resizes on your iPhone, and saves
                only crops you confirm.
              </small>
            </span>
          </div>
        </>
      )}
      {(stage === "preparing" || stage === "scanning") && (
        <div className="scan-progress">
          <span className="scan-pulse">
            <Sparkles />
          </span>
          <h3>
            {stage === "preparing"
              ? "Preparing privately…"
              : "Looking for wardrobe pieces…"}
          </h3>
          <p>
            {stage === "preparing"
              ? "Resizing and removing photo metadata on this device."
              : `${photos.filter((item) => item.status === "done").length} of ${photos.length} photos reviewed.`}
          </p>
          <i>
            <span style={{ width: `${progress}%` }} />
          </i>
          <b>{progress}%</b>
          {photos.length > 0 && (
            <div className="scan-photo-strip">
              {photos.map((photo) => (
                <span className={photo.status} key={photo.id}>
                  <img src={photo.dataUrl} alt="" />
                  {photo.status === "scanning" && <LoaderCircle />}
                  {photo.status === "done" && <Check />}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {stage === "review" && (
        <>
          <p className="sheet-lede">
            Keep, rename, reframe, or remove each piece. Your corrections are
            the part pilot learns from.
          </p>
          {mode === "guided" && (
            <div className="guided-note">
              <Info />
              <span>
                <b>pilot made a fast first pass</b>
                <small>
                  Confirm the crop, category, and color. Every correction
                  improves your personal style memory.
                </small>
              </span>
            </div>
          )}
          <div className="detection-list">
            {detections.map((item) => (
              <article className={!item.keep ? "removed" : ""} key={item.id}>
                <div className="detection-image">
                  <img src={item.thumbnail} alt={item.name} />
                  <button
                    onClick={() => update(item.id, { keep: !item.keep })}
                    aria-label={
                      item.keep ? `Remove ${item.name}` : `Keep ${item.name}`
                    }
                  >
                    {item.keep ? <Check /> : <RefreshCw />}
                  </button>
                </div>
                <div className="detection-fields">
                  <label>
                    Name
                    <input
                      value={item.name}
                      onChange={(event) =>
                        update(item.id, { name: event.target.value })
                      }
                    />
                  </label>
                  <div>
                    <label>
                      Category
                      <select
                        value={item.category}
                        onChange={(event) =>
                          update(item.id, {
                            category: event.target.value as Category,
                          })
                        }
                      >
                        {categories.map((category) => (
                          <option key={category}>{category}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Color
                      <input
                        value={item.color}
                        onChange={(event) =>
                          update(item.id, { color: event.target.value })
                        }
                      />
                    </label>
                  </div>
                  <p>
                    <span>
                      {item.confidence >= 80
                        ? "High confidence"
                        : "Please confirm"}
                    </span>
                    {item.possibleDuplicate && (
                      <span className="duplicate-chip">
                        May match {item.possibleDuplicate}
                      </span>
                    )}
                  </p>
                  <button
                    className="crop-trigger"
                    onClick={() =>
                      setActiveCrop(activeCrop === item.id ? null : item.id)
                    }
                  >
                    {activeCrop === item.id ? "Done cropping" : "Adjust crop"}
                  </button>
                </div>
                {activeCrop === item.id && (
                  <div className="crop-controls">
                    <label>
                      Zoom{" "}
                      <input
                        type="range"
                        min="1"
                        max="2.8"
                        step=".1"
                        value={item.cropZoom}
                        onInput={(event) =>
                          void adjustCrop(item.id, {
                            cropZoom: Number(event.currentTarget.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Left / right{" "}
                      <input
                        type="range"
                        min="-1"
                        max="1"
                        step=".1"
                        value={item.cropX}
                        onInput={(event) =>
                          void adjustCrop(item.id, {
                            cropX: Number(event.currentTarget.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Up / down{" "}
                      <input
                        type="range"
                        min="-1"
                        max="1"
                        step=".1"
                        value={item.cropY}
                        onInput={(event) =>
                          void adjustCrop(item.id, {
                            cropY: Number(event.currentTarget.value),
                          })
                        }
                      />
                    </label>
                  </div>
                )}
                <button
                  className="detection-remove"
                  onClick={() => update(item.id, { keep: !item.keep })}
                >
                  {item.keep ? (
                    <>
                      <Trash2 /> Remove
                    </>
                  ) : (
                    <>
                      <Check /> Keep this
                    </>
                  )}
                </button>
              </article>
            ))}
          </div>
          <div className="review-summary">
            <Sparkles />
            <span>
              <b>
                {kept.length} {kept.length === 1 ? "piece" : "pieces"} ready
              </b>
              <small>
                {detections.length - kept.length} removed · likely duplicates
                merge automatically
              </small>
            </span>
          </div>
          <button
            className="primary-action scan-save"
            onClick={save}
            disabled={!kept.length}
          >
            Save {kept.length} to my closet
          </button>
          <button
            className="secondary-action"
            onClick={() => {
              setStage("pick");
              setPhotos([]);
              setDetections([]);
            }}
          >
            Choose different photos
          </button>
        </>
      )}
      {stage === "saving" && (
        <div className="scan-progress saving">
          <span className="scan-pulse">
            <LoaderCircle />
          </span>
          <h3>Teaching your pilot…</h3>
          <p>
            Saving confirmed crops and updating your personal style signals.
          </p>
        </div>
      )}
      {error && (
        <p className="scan-error">
          <X /> {error}
        </p>
      )}
    </div>
  );
}
