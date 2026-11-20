CREATE TABLE `pouchi_accounts` (
	`wallet_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`wallet_address` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pouchi_accounts_user_id_unique` ON `pouchi_accounts` (`user_id`);