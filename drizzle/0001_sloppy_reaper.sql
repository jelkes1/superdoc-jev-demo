CREATE TABLE `workflow_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot` text NOT NULL,
	`expires` integer NOT NULL,
	`closed` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workflow_expiry` ON `workflow_runs` (`closed`,`expires`);--> statement-breakpoint
CREATE TABLE `workflow_slots` (
	`run_id` text NOT NULL,
	`model` text NOT NULL,
	`maximum` integer NOT NULL,
	`state` text DEFAULT 'ready' NOT NULL,
	`charged` integer,
	PRIMARY KEY(`run_id`, `model`)
);
