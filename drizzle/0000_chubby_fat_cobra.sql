CREATE TABLE `wardrobe_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`subcategory` text NOT NULL,
	`color` text NOT NULL,
	`material` text NOT NULL,
	`warmth` integer DEFAULT 2 NOT NULL,
	`formality` integer DEFAULT 3 NOT NULL,
	`seasons_json` text DEFAULT '[]' NOT NULL,
	`occasions_json` text DEFAULT '[]' NOT NULL,
	`image_key` text NOT NULL,
	`source_fingerprint` text NOT NULL,
	`confidence` integer DEFAULT 0 NOT NULL,
	`scan_count` integer DEFAULT 1 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wardrobe_items_user_active_idx` ON `wardrobe_items` (`user_id`,`active`);--> statement-breakpoint
CREATE UNIQUE INDEX `wardrobe_items_user_fingerprint_idx` ON `wardrobe_items` (`user_id`,`source_fingerprint`);--> statement-breakpoint
CREATE TABLE `wardrobe_learning` (
	`user_id` text PRIMARY KEY NOT NULL,
	`total_scans` integer DEFAULT 0 NOT NULL,
	`photos_scanned` integer DEFAULT 0 NOT NULL,
	`items_confirmed` integer DEFAULT 0 NOT NULL,
	`items_rejected` integer DEFAULT 0 NOT NULL,
	`items_merged` integer DEFAULT 0 NOT NULL,
	`category_counts_json` text DEFAULT '{}' NOT NULL,
	`color_counts_json` text DEFAULT '{}' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `wardrobe_scans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`photo_count` integer NOT NULL,
	`detected_count` integer NOT NULL,
	`confirmed_count` integer NOT NULL,
	`rejected_count` integer NOT NULL,
	`merged_count` integer DEFAULT 0 NOT NULL,
	`analysis_mode` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wardrobe_scans_user_created_idx` ON `wardrobe_scans` (`user_id`,`created_at`);