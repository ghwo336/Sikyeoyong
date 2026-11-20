CREATE TABLE `agent_keys` (
	`address` text PRIMARY KEY NOT NULL,
	`agent_id` text,
	`ciphertext` text NOT NULL,
	`iv` text NOT NULL,
	`tag` text NOT NULL,
	`key_version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_keys_agent_id_unique` ON `agent_keys` (`agent_id`);