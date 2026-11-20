PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_agents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`dragon_name` text NOT NULL,
	`dragon_species` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`payment_path` text NOT NULL,
	`wallet_address` text,
	`onchain_agent_id` text,
	`owner_address` text,
	`maws_agent_id` text,
	`level` integer DEFAULT 1 NOT NULL,
	`setup_step` text DEFAULT 'wallet' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "agents_dragon_species_check" CHECK("__new_agents"."dragon_species" in ('forest', 'water', 'flower', 'star')),
	CONSTRAINT "agents_status_check" CHECK("__new_agents"."status" in ('PENDING', 'ACTIVE', 'FROZEN', 'REVOKED')),
	CONSTRAINT "agents_payment_path_check" CHECK("__new_agents"."payment_path" in ('A', 'B', 'C', 'mock')),
	CONSTRAINT "agents_setup_step_check" CHECK("__new_agents"."setup_step" in ('wallet', 'identity', 'limit', 'done', 'failed')),
	CONSTRAINT "agents_level_check" CHECK("__new_agents"."level" in (1, 2, 3))
);
--> statement-breakpoint
INSERT INTO `__new_agents`("id", "user_id", "dragon_name", "dragon_species", "status", "payment_path", "wallet_address", "onchain_agent_id", "owner_address", "maws_agent_id", "level", "setup_step", "created_at") SELECT "id", "user_id", "dragon_name", "dragon_species", "status", "payment_path", "wallet_address", "onchain_agent_id", "owner_address", "maws_agent_id", "level", CASE WHEN "status" = 'PENDING' THEN 'wallet' ELSE 'done' END, "created_at" FROM `agents`;--> statement-breakpoint
DROP TABLE `agents`;--> statement-breakpoint
ALTER TABLE `__new_agents` RENAME TO `agents`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `agents_user_id_unique` ON `agents` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `agents_wallet_address_unique` ON `agents` (`wallet_address`);