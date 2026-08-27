const allowedCategories = ["Tops", "Bottoms", "Dresses", "Outerwear", "Shoes"] as const;

type Detection = {
  name: string;
  category: typeof allowedCategories[number];
  subcategory: string;
  color: string;
  material: string;
  warmth: number;
  formality: number;
  seasons: string[];
  occasions: string[];
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
};

const categoryFallbacks: Array<Pick<Detection, "category" | "subcategory" | "warmth" | "formality" | "occasions">> = [
  { category:"Tops", subcategory:"Top", warmth:2, formality:3, occasions:["Office", "Casual"] },
  { category:"Dresses", subcategory:"Dress", warmth:1, formality:4, occasions:["Dinner", "Event"] },
  { category:"Shoes", subcategory:"Shoes", warmth:1, formality:3, occasions:["Office", "Casual"] },
  { category:"Outerwear", subcategory:"Jacket", warmth:3, formality:3, occasions:["Office", "Travel"] },
  { category:"Bottoms", subcategory:"Bottom", warmth:2, formality:3, occasions:["Office", "Casual"] },
];

function guidedDetection(photoIndex: number, dominantColor?: string): Detection {
  const base = categoryFallbacks[Math.abs(photoIndex) % categoryFallbacks.length];
  const color = dominantColor || "Neutral";
  return {
    ...base,
    name:`${color} ${base.subcategory}`,
    color,
    material:"Material to confirm",
    seasons:["Spring", "Summer", "Fall", "Winter"],
    confidence:55,
    bbox:{ x:0.08, y:0.06, width:0.84, height:0.9 },
  };
}

function clampDetection(value: Partial<Detection>, fallback: Detection): Detection {
  const category = allowedCategories.includes(value.category as Detection["category"]) ? value.category as Detection["category"] : fallback.category;
  const bbox = value.bbox || fallback.bbox;
  return {
    name:String(value.name || `${value.color || fallback.color} ${value.subcategory || fallback.subcategory}`).slice(0, 80),
    category,
    subcategory:String(value.subcategory || fallback.subcategory).slice(0, 50),
    color:String(value.color || fallback.color).slice(0, 40),
    material:String(value.material || "Material inferred from photo").slice(0, 60),
    warmth:Math.max(1, Math.min(5, Math.round(Number(value.warmth) || fallback.warmth))),
    formality:Math.max(1, Math.min(5, Math.round(Number(value.formality) || fallback.formality))),
    seasons:Array.isArray(value.seasons) ? value.seasons.map(String).slice(0, 4) : fallback.seasons,
    occasions:Array.isArray(value.occasions) ? value.occasions.map(String).slice(0, 6) : fallback.occasions,
    confidence:Math.max(0, Math.min(100, Math.round(Number(value.confidence) || fallback.confidence))),
    bbox:{
      x:Math.max(0, Math.min(1, Number(bbox.x) || 0)),
      y:Math.max(0, Math.min(1, Number(bbox.y) || 0)),
      width:Math.max(.05, Math.min(1, Number(bbox.width) || 1)),
      height:Math.max(.05, Math.min(1, Number(bbox.height) || 1)),
    },
  };
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth) return unauthorized();
  const body = await request.json().catch(() => ({})) as { image?:string; photoIndex?:number; dominantColor?:string };
  if (!body.image?.startsWith("data:image/")) return apiError("SCAN_IMAGE_REQUIRED", "A prepared image is required.", 400);
  if (body.image.length > 5_500_000) return apiError("SCAN_IMAGE_TOO_LARGE", "The prepared image is too large.", 413);

  const fallback = guidedDetection(body.photoIndex || 0, body.dominantColor);
  if (!process.env.OPENAI_API_KEY) return auth.applyCookies(privateResponse({ analysisMode:"guided", detections:[fallback] }));

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method:"POST",
      headers:{ Authorization:`Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type":"application/json" },
      body:JSON.stringify({
        model:process.env.OPENAI_VISION_MODEL || "gpt-5-mini",
        input:[{ role:"user", content:[
          { type:"input_text", text:"Identify each clearly visible wearable garment in this wardrobe or outfit photo. Ignore people, bags, jewelry, and room objects. Return at most 8 distinct clothing or shoe items. Give a tight normalized bounding box (x, y, width, height from 0 to 1). Material is always an appearance-based inference. If uncertain, keep the item but lower confidence." },
          { type:"input_image", image_url:body.image },
        ] }],
        text:{ format:{ type:"json_schema", name:"wardrobe_scan", strict:true, schema:{
          type:"object", additionalProperties:false, properties:{ items:{ type:"array", maxItems:8, items:{ type:"object", additionalProperties:false, properties:{
            name:{type:"string"}, category:{type:"string",enum:allowedCategories}, subcategory:{type:"string"}, color:{type:"string"}, material:{type:"string"}, warmth:{type:"integer",minimum:1,maximum:5}, formality:{type:"integer",minimum:1,maximum:5}, seasons:{type:"array",items:{type:"string"}}, occasions:{type:"array",items:{type:"string"}}, confidence:{type:"integer",minimum:0,maximum:100}, bbox:{type:"object",additionalProperties:false,properties:{x:{type:"number"},y:{type:"number"},width:{type:"number"},height:{type:"number"}},required:["x","y","width","height"]}
          }, required:["name","category","subcategory","color","material","warmth","formality","seasons","occasions","confidence","bbox"] } } }, required:["items"]
        } } },
      }),
    });
    if (!response.ok) throw new Error(`VISION_${response.status}`);
    const result = await response.json() as { output_text?:string };
    const parsed = JSON.parse(result.output_text || "{}") as { items?:Partial<Detection>[] };
    const detections = (parsed.items || []).map((item) => clampDetection(item, fallback));
    return auth.applyCookies(privateResponse({ analysisMode:"ai", detections:detections.length ? detections : [fallback] }));
  } catch {
    return auth.applyCookies(privateResponse({ analysisMode:"guided", detections:[fallback] }));
  }
}
import { apiError, privateResponse, requireUser, unauthorized } from "../../../../lib/supabase-server";
