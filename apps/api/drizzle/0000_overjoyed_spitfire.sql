CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`original_path` text NOT NULL,
	`web_path` text NOT NULL,
	`thumb_path` text NOT NULL,
	`mime` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`bytes` integer NOT NULL,
	`source` text NOT NULL,
	`alt` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`label_en` text NOT NULL,
	`label_he` text NOT NULL,
	`icon` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `category_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`section_type` text NOT NULL,
	`sort_order` integer NOT NULL,
	`content` text,
	`body_richtext` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`section_type`) REFERENCES `section_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `content_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`group` text NOT NULL,
	`label_en` text NOT NULL,
	`label_he` text NOT NULL,
	`kind` text NOT NULL,
	`content` text,
	`body_richtext` text,
	`sort_order` integer NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `goal_status_history` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`status` text NOT NULL,
	`note` text,
	`changed_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'not_relevant' NOT NULL,
	`target_date` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_date` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`title` text,
	`body_richtext` text DEFAULT '' NOT NULL,
	`mood` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `life_vision_prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`question` text NOT NULL,
	`answer_richtext` text,
	`sort_order` integer NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `moodboard_items` (
	`id` text PRIMARY KEY NOT NULL,
	`moodboard_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`x` real DEFAULT 0 NOT NULL,
	`y` real DEFAULT 0 NOT NULL,
	`width` real DEFAULT 300 NOT NULL,
	`height` real DEFAULT 300 NOT NULL,
	`rotation` real DEFAULT 0 NOT NULL,
	`z_index` integer DEFAULT 0 NOT NULL,
	`crop` text,
	`corner_radius` real DEFAULT 0 NOT NULL,
	`opacity` real DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`moodboard_id`) REFERENCES `moodboards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `moodboard_text_items` (
	`id` text PRIMARY KEY NOT NULL,
	`moodboard_id` text NOT NULL,
	`text` text NOT NULL,
	`x` real DEFAULT 0 NOT NULL,
	`y` real DEFAULT 0 NOT NULL,
	`width` real DEFAULT 400 NOT NULL,
	`height` real DEFAULT 120 NOT NULL,
	`rotation` real DEFAULT 0 NOT NULL,
	`z_index` integer DEFAULT 0 NOT NULL,
	`color` text,
	`font_size` real DEFAULT 48 NOT NULL,
	`align` text DEFAULT 'start' NOT NULL,
	FOREIGN KEY (`moodboard_id`) REFERENCES `moodboards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `moodboards` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`theme` text,
	`category_id` text,
	`canvas_width` integer DEFAULT 1920 NOT NULL,
	`canvas_height` integer DEFAULT 1080 NOT NULL,
	`background` text,
	`template_id` text,
	`vision_statement` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `section_types` (
	`id` text PRIMARY KEY NOT NULL,
	`label_en` text NOT NULL,
	`label_he` text NOT NULL,
	`shape` text NOT NULL,
	`default_sort` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
