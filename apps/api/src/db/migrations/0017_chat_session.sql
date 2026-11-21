ALTER TABLE `chat_messages` ADD `session_id` text;--> statement-breakpoint
CREATE INDEX `chat_messages_session_idx` ON `chat_messages` (`user_id`,`session_id`);