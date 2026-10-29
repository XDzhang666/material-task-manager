CREATE TABLE `actions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`material_ids` text DEFAULT '[]' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `actions_name_unique` ON `actions` (`name`);--> statement-breakpoint
CREATE INDEX `actions_active` ON `actions` (`archived`,`name`);