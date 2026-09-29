CREATE TABLE `category_ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`score` integer NOT NULL,
	`reality` text,
	`gap` text,
	`rated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `category_ratings_cat_idx` ON `category_ratings` (`category_id`,`rated_at`);--> statement-breakpoint
CREATE TABLE `ikigai_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`items` text NOT NULL,
	`everyday` text NOT NULL,
	`statement` text,
	`confidence` integer,
	`reflections` text NOT NULL,
	`step` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE TABLE `life_chapters` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`intention` text,
	`focus_category_ids` text NOT NULL,
	`maintenance_category_ids` text NOT NULL,
	`not_now` text NOT NULL,
	`no_longer_acceptable` text NOT NULL,
	`start_date` integer NOT NULL,
	`review_date` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`closing_reflection` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`closed_at` integer
);
