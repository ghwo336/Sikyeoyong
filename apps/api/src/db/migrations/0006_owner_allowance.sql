CREATE TABLE `owner_allowance_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`amount_aokrw` text NOT NULL,
	`tx_hash` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "owner_allowance_kind_check" CHECK("owner_allowance_entries"."kind" in ('trial', 'fund', 'refund')),
	CONSTRAINT "owner_allowance_amount_check" CHECK("owner_allowance_entries"."amount_aokrw" <> '' and "owner_allowance_entries"."amount_aokrw" not glob '*[^0-9]*' and ("owner_allowance_entries"."amount_aokrw" = '0' or "owner_allowance_entries"."amount_aokrw" not like '0%') and length("owner_allowance_entries"."amount_aokrw") <= 78),
	CONSTRAINT "owner_allowance_amount_positive" CHECK("owner_allowance_entries"."amount_aokrw" <> '0')
);
--> statement-breakpoint
CREATE INDEX `owner_allowance_user_idx` ON `owner_allowance_entries` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `owner_allowance_trial_uq` ON `owner_allowance_entries` (`user_id`) WHERE "owner_allowance_entries"."kind" = 'trial';