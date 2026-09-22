CREATE TABLE `daily_budget` (
	`day` text PRIMARY KEY NOT NULL,
	`reserved` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`visitor` text NOT NULL,
	`ip` text NOT NULL,
	`kind` text NOT NULL,
	`parent` text,
	`amount` integer NOT NULL,
	`settled` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL
);
