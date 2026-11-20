ALTER TABLE `orders` ADD `client_order_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_user_client_order_uq` ON `orders` (`user_id`,`client_order_id`);