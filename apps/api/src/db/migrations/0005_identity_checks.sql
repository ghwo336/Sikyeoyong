CREATE TABLE `identity_checks` (
	`user_id` text PRIMARY KEY NOT NULL,
	`method` text NOT NULL,
	`verified_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "identity_checks_method_check" CHECK("identity_checks"."method" in ('kakao', 'mock'))
);
