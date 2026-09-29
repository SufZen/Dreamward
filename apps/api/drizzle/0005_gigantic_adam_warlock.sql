CREATE TABLE `agent_routines` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`schedule_hour` integer DEFAULT 7 NOT NULL,
	`auto_approve` integer DEFAULT 0 NOT NULL,
	`last_run_at` integer,
	`last_status` text,
	`config` text
);
