CREATE TABLE `indexer_cursors` (
	`chain_id` integer NOT NULL,
	`contract` text NOT NULL,
	`last_block` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`chain_id`, `contract`)
);
