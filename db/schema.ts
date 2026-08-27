import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const wardrobeItems = sqliteTable("wardrobe_items", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  subcategory: text("subcategory").notNull(),
  color: text("color").notNull(),
  material: text("material").notNull(),
  warmth: integer("warmth").notNull().default(2),
  formality: integer("formality").notNull().default(3),
  seasonsJson: text("seasons_json").notNull().default("[]"),
  occasionsJson: text("occasions_json").notNull().default("[]"),
  imageKey: text("image_key").notNull(),
  sourceFingerprint: text("source_fingerprint").notNull(),
  confidence: integer("confidence").notNull().default(0),
  scanCount: integer("scan_count").notNull().default(1),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("wardrobe_items_user_active_idx").on(table.userId, table.active),
  uniqueIndex("wardrobe_items_user_fingerprint_idx").on(table.userId, table.sourceFingerprint),
]);

export const wardrobeScans = sqliteTable("wardrobe_scans", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  photoCount: integer("photo_count").notNull(),
  detectedCount: integer("detected_count").notNull(),
  confirmedCount: integer("confirmed_count").notNull(),
  rejectedCount: integer("rejected_count").notNull(),
  mergedCount: integer("merged_count").notNull().default(0),
  analysisMode: text("analysis_mode").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("wardrobe_scans_user_created_idx").on(table.userId, table.createdAt)]);

export const wardrobeLearning = sqliteTable("wardrobe_learning", {
  userId: text("user_id").primaryKey(),
  totalScans: integer("total_scans").notNull().default(0),
  photosScanned: integer("photos_scanned").notNull().default(0),
  itemsConfirmed: integer("items_confirmed").notNull().default(0),
  itemsRejected: integer("items_rejected").notNull().default(0),
  itemsMerged: integer("items_merged").notNull().default(0),
  categoryCountsJson: text("category_counts_json").notNull().default("{}"),
  colorCountsJson: text("color_counts_json").notNull().default("{}"),
  updatedAt: text("updated_at").notNull(),
});
