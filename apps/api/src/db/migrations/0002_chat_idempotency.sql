ALTER TABLE `chat_messages` ADD `client_message_id` text;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `reply_to_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `chat_messages_client_id_uq` ON `chat_messages` (`user_id`,`client_message_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `chat_messages_reply_to_uq` ON `chat_messages` (`reply_to_id`);