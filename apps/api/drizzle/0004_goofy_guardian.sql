CREATE TABLE `api_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`ts` integer NOT NULL,
	`key_id` integer NOT NULL,
	`key_name` text NOT NULL,
	`method` text NOT NULL,
	`path` text NOT NULL,
	`action` text,
	`entity_type` text,
	`entity_id` text,
	`summary` text,
	`prior_state` text,
	`status` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `api_activity_ts_idx` ON `api_activity` (`ts`);--> statement-breakpoint
ALTER TABLE `actions` ADD `priority` text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE `actions` ADD `linked_type` text;--> statement-breakpoint
ALTER TABLE `actions` ADD `linked_id` text;--> statement-breakpoint
ALTER TABLE `actions` ADD `created_by` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `actions` ADD `updated_at` integer;--> statement-breakpoint
ALTER TABLE `actions` ADD `deleted_at` integer;--> statement-breakpoint
CREATE INDEX `actions_linked_idx` ON `actions` (`linked_type`,`linked_id`);--> statement-breakpoint
UPDATE `actions` SET `linked_type` = 'goal', `linked_id` = `goal_id` WHERE `goal_id` IS NOT NULL AND `linked_type` IS NULL;