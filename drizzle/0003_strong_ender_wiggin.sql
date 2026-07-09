ALTER TABLE `analysis_tasks` ADD `shareToken` varchar(64);--> statement-breakpoint
ALTER TABLE `analysis_tasks` ADD CONSTRAINT `analysis_tasks_shareToken_unique` UNIQUE(`shareToken`);