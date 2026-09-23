CREATE TABLE `agent_pipelines` (
	`run_id` text NOT NULL,
	`pipeline` text NOT NULL,
	`claimed` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`run_id`, `pipeline`)
);
--> statement-breakpoint
CREATE TABLE `agent_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot` text NOT NULL,
	`expires` integer NOT NULL,
	`closed` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `agent_expiry` ON `agent_runs` (`closed`,`expires`);--> statement-breakpoint
CREATE TABLE `agent_slots` (
	`run_id` text NOT NULL,
	`slot` text NOT NULL,
	`maximum` integer NOT NULL,
	`state` text DEFAULT 'ready' NOT NULL,
	`charged` integer,
	PRIMARY KEY(`run_id`, `slot`)
);
