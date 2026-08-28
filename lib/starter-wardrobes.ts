import { starterCloset, type Garment } from "./demo-data";

export type StarterWardrobeChoice = "menswear" | "womenswear" | "neutral" | "empty";

const ids: Record<Exclude<StarterWardrobeChoice, "empty">, string[]> = {
  menswear: ["g01", "g02", "g03", "g04", "g05", "g06", "g07", "g08"],
  womenswear: ["g01", "g02", "g04", "g05", "g07", "g09", "g10", "g11"],
  neutral: ["g01", "g02", "g03", "g04", "g05", "g07", "g08", "g10"],
};

export function getStarterWardrobe(choice: StarterWardrobeChoice): Garment[] {
  if (choice === "empty") return [];
  const allowed = new Set(ids[choice]);
  return starterCloset.filter((item) => allowed.has(item.id)).map((item) => ({ ...item, inventoryType: "sample", brand: "Example wardrobe" }));
}
