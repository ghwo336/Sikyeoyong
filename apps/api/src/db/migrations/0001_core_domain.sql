CREATE TABLE `agent_limit_history` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`level` integer NOT NULL,
	`transfer_limit` text NOT NULL,
	`tx_hash` text,
	`approval_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "agent_limit_history_transfer_limit_check" CHECK("agent_limit_history"."transfer_limit" <> '' and "agent_limit_history"."transfer_limit" not glob '*[^0-9]*' and ("agent_limit_history"."transfer_limit" = '0' or "agent_limit_history"."transfer_limit" not like '0%') and length("agent_limit_history"."transfer_limit") <= 78),
	CONSTRAINT "agent_limit_history_level_check" CHECK("agent_limit_history"."level" in (1, 2, 3))
);
--> statement-breakpoint
CREATE INDEX `agent_limit_history_agent_idx` ON `agent_limit_history` (`agent_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `agents` (
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
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "agents_dragon_species_check" CHECK("agents"."dragon_species" in ('forest', 'water', 'flower', 'star')),
	CONSTRAINT "agents_status_check" CHECK("agents"."status" in ('PENDING', 'ACTIVE', 'FROZEN', 'REVOKED')),
	CONSTRAINT "agents_payment_path_check" CHECK("agents"."payment_path" in ('A', 'B', 'C')),
	CONSTRAINT "agents_level_check" CHECK("agents"."level" in (1, 2, 3))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agents_user_id_unique` ON `agents` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `agents_wallet_address_unique` ON `agents` (`wallet_address`);--> statement-breakpoint
CREATE TABLE `allowed_merchants` (
	`user_id` text NOT NULL,
	`merchant_id` text NOT NULL,
	`approved_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `merchant_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`order_id` text NOT NULL,
	`reason` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`decided_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "approvals_reason_check" CHECK("approvals"."reason" in ('OVER_LEVEL_LIMIT', 'NEW_MERCHANT', 'OVER_PERSONAL_BUDGET')),
	CONSTRAINT "approvals_status_check" CHECK("approvals"."status" in ('pending', 'approved', 'rejected', 'expired'))
);
--> statement-breakpoint
CREATE INDEX `approvals_user_status_idx` ON `approvals` (`user_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `approvals_pending_order_uq` ON `approvals` (`order_id`) WHERE "approvals"."status" = 'pending';--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`content_json` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chat_messages_role_check" CHECK("chat_messages"."role" in ('user', 'assistant'))
);
--> statement-breakpoint
CREATE INDEX `chat_messages_user_created_idx` ON `chat_messages` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `nag_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`month_kst` text NOT NULL,
	`level` text NOT NULL,
	`spent` text NOT NULL,
	`budget` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "nag_events_level_check" CHECK("nag_events"."level" in ('warn70', 'warn90', 'over100')),
	CONSTRAINT "nag_events_spent_check" CHECK("nag_events"."spent" <> '' and "nag_events"."spent" not glob '*[^0-9]*' and ("nag_events"."spent" = '0' or "nag_events"."spent" not like '0%') and length("nag_events"."spent") <= 78),
	CONSTRAINT "nag_events_budget_check" CHECK("nag_events"."budget" <> '' and "nag_events"."budget" not glob '*[^0-9]*' and ("nag_events"."budget" = '0' or "nag_events"."budget" not like '0%') and length("nag_events"."budget") <= 78)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nag_events_user_month_level_uq` ON `nag_events` (`user_id`,`month_kst`,`level`);--> statement-breakpoint
CREATE TABLE `oauth_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_user_id` text NOT NULL,
	`email` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "oauth_accounts_provider_check" CHECK("oauth_accounts"."provider" in ('kakao', 'google', 'apple'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_accounts_provider_user_uq` ON `oauth_accounts` (`provider`,`provider_user_id`);--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`type` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`source` text NOT NULL,
	`tx_hash` text,
	`log_index` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "order_events_source_check" CHECK("order_events"."source" in ('server', 'chain'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_events_tx_log_uq` ON `order_events` (`tx_hash`,`log_index`);--> statement-breakpoint
CREATE INDEX `order_events_order_idx` ON `order_events` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_ref` text NOT NULL,
	`user_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`merchant_id` text NOT NULL,
	`amount` text NOT NULL,
	`items_json` text NOT NULL,
	`note` text,
	`status` text NOT NULL,
	`tx_hash` text,
	`error_code` text,
	`receipt_json` text,
	`attempt` integer DEFAULT 0 NOT NULL,
	`submit_started_at` integer,
	`submit_tx_hash` text,
	`submit_nonce` integer,
	`maws_request_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "orders_amount_check" CHECK("orders"."amount" <> '' and "orders"."amount" not glob '*[^0-9]*' and ("orders"."amount" = '0' or "orders"."amount" not like '0%') and length("orders"."amount") <= 78),
	CONSTRAINT "orders_status_check" CHECK("orders"."status" in ('quoted', 'pending_approval', 'submitting', 'paid', 'preparing', 'delivering', 'delivered', 'failed', 'cancelled', 'refunded'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_ref_unique` ON `orders` (`order_ref`);--> statement-breakpoint
CREATE INDEX `orders_user_created_idx` ON `orders` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`platform` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sessions_platform_check" CHECK("sessions"."platform" in ('web', 'native'))
);
--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`nickname` text NOT NULL,
	`address_text` text,
	`address_dong` text,
	`monthly_budget` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "users_monthly_budget_check" CHECK("users"."monthly_budget" <> '' and "users"."monthly_budget" not glob '*[^0-9]*' and ("users"."monthly_budget" = '0' or "users"."monthly_budget" not like '0%') and length("users"."monthly_budget") <= 78),
	CONSTRAINT "users_role_check" CHECK("users"."role" in ('user', 'operator', 'merchant'))
);
