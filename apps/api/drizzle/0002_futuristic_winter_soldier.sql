ALTER TABLE `llm_providers` ADD `kind` text DEFAULT 'openai-compat' NOT NULL;--> statement-breakpoint
ALTER TABLE `llm_providers` ADD `oauth_json` text;