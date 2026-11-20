CREATE TABLE `order_ratings` (
	`order_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`value` text NOT NULL,
	`rated_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "order_ratings_value_check" CHECK("order_ratings"."value" in ('again', 'okay', 'meh'))
);
