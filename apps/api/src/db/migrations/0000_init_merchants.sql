CREATE TABLE `menus` (
	`id` text PRIMARY KEY NOT NULL,
	`merchant_id` text NOT NULL,
	`name` text NOT NULL,
	`price` text NOT NULL,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`available` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "menus_price_check" CHECK("menus"."price" <> '' and "menus"."price" not glob '*[^0-9]*' and ("menus"."price" = '0' or "menus"."price" not like '0%') and length("menus"."price") <= 78)
);
--> statement-breakpoint
CREATE INDEX `menus_merchant_id_idx` ON `menus` (`merchant_id`);--> statement-breakpoint
CREATE TABLE `merchants` (
	`id` text PRIMARY KEY NOT NULL,
	`onchain_id` text,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`payout_address` text NOT NULL,
	`kyb_uid` text,
	`verified` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`business_no_hash` text,
	`metadata_uri` text NOT NULL,
	`open_hours_json` text DEFAULT '{}' NOT NULL,
	`source` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "merchants_source_check" CHECK("merchants"."source" in ('seed', 'console'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `merchants_onchain_id_unique` ON `merchants` (`onchain_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `merchants_payout_address_unique` ON `merchants` (`payout_address`);