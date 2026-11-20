-- D-31: limits are amounts the owner picks, levels are gone.
-- agents.level becomes agents.per_order_limit (aokrw text): level 1, 2, 3 map to the old table
-- 10,000, 30,000, 50,000 OKRW. The chain's TransferLimit already holds those amounts.
-- users.monthly_budget becomes users.my_periodic_limit with its value kept. SQL cannot read the
-- policy profile, so a value outside the profile range (or off its step) is clamped by
-- UsersService when it is read, not here.
-- agent_limit_history drops its level column; transfer_limit already holds the amount.
-- Tables are rebuilt with foreign keys off (runMigrations turns them off around the migrator).
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
	`per_order_limit` text NOT NULL,
	`setup_step` text DEFAULT 'wallet' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "agents_dragon_species_check" CHECK("__new_agents"."dragon_species" in ('forest', 'water', 'flower', 'star')),
	CONSTRAINT "agents_status_check" CHECK("__new_agents"."status" in ('PENDING', 'ACTIVE', 'FROZEN', 'REVOKED')),
	CONSTRAINT "agents_payment_path_check" CHECK("__new_agents"."payment_path" in ('A', 'B', 'C', 'mock')),
	CONSTRAINT "agents_setup_step_check" CHECK("__new_agents"."setup_step" in ('wallet', 'identity', 'limit', 'done', 'failed')),
	CONSTRAINT "agents_per_order_limit_check" CHECK("__new_agents"."per_order_limit" <> '' and "__new_agents"."per_order_limit" not glob '*[^0-9]*' and ("__new_agents"."per_order_limit" = '0' or "__new_agents"."per_order_limit" not like '0%') and length("__new_agents"."per_order_limit") <= 78)
);
--> statement-breakpoint
INSERT INTO `__new_agents`("id", "user_id", "dragon_name", "dragon_species", "status", "payment_path", "wallet_address", "onchain_agent_id", "owner_address", "maws_agent_id", "per_order_limit", "setup_step", "created_at") SELECT "id", "user_id", "dragon_name", "dragon_species", "status", "payment_path", "wallet_address", "onchain_agent_id", "owner_address", "maws_agent_id", CASE "level" WHEN 3 THEN '50000000000000000000000' WHEN 2 THEN '30000000000000000000000' ELSE '10000000000000000000000' END, "setup_step", "created_at" FROM `agents`;--> statement-breakpoint
DROP TABLE `agents`;--> statement-breakpoint
ALTER TABLE `__new_agents` RENAME TO `agents`;--> statement-breakpoint
CREATE UNIQUE INDEX `agents_user_id_unique` ON `agents` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `agents_wallet_address_unique` ON `agents` (`wallet_address`);--> statement-breakpoint
CREATE TABLE `__new_agent_limit_history` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`transfer_limit` text NOT NULL,
	`tx_hash` text,
	`approval_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "agent_limit_history_transfer_limit_check" CHECK("__new_agent_limit_history"."transfer_limit" <> '' and "__new_agent_limit_history"."transfer_limit" not glob '*[^0-9]*' and ("__new_agent_limit_history"."transfer_limit" = '0' or "__new_agent_limit_history"."transfer_limit" not like '0%') and length("__new_agent_limit_history"."transfer_limit") <= 78)
);
--> statement-breakpoint
INSERT INTO `__new_agent_limit_history`("id", "agent_id", "transfer_limit", "tx_hash", "approval_id", "created_at") SELECT "id", "agent_id", "transfer_limit", "tx_hash", "approval_id", "created_at" FROM `agent_limit_history`;--> statement-breakpoint
DROP TABLE `agent_limit_history`;--> statement-breakpoint
ALTER TABLE `__new_agent_limit_history` RENAME TO `agent_limit_history`;--> statement-breakpoint
CREATE INDEX `agent_limit_history_agent_idx` ON `agent_limit_history` (`agent_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`nickname` text NOT NULL,
	`address_text` text,
	`address_dong` text,
	`my_periodic_limit` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "users_my_periodic_limit_check" CHECK("__new_users"."my_periodic_limit" <> '' and "__new_users"."my_periodic_limit" not glob '*[^0-9]*' and ("__new_users"."my_periodic_limit" = '0' or "__new_users"."my_periodic_limit" not like '0%') and length("__new_users"."my_periodic_limit") <= 78),
	CONSTRAINT "users_role_check" CHECK("__new_users"."role" in ('user', 'operator', 'merchant'))
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "nickname", "address_text", "address_dong", "my_periodic_limit", "role", "created_at") SELECT "id", "nickname", "address_text", "address_dong", "monthly_budget", "role", "created_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;