CREATE INDEX `actions_status_idx` ON `actions` (`status`);--> statement-breakpoint
CREATE INDEX `agent_messages_conversation_idx` ON `agent_messages` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `assets_source_idx` ON `assets` (`source`);--> statement-breakpoint
CREATE INDEX `journal_entry_date_idx` ON `journal_entries` (`entry_date`);