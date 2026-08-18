CREATE TABLE `product_analysis_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`periodRole` enum('current','prior') NOT NULL,
	`originalName` varchar(255) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` varchar(512) NOT NULL,
	`rowCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_analysis_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_analysis_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`summary` json,
	`ownerSummaries` json,
	`products` json,
	`stars` json,
	`losses` json,
	`attentions` json,
	`currentPeriod` varchar(16),
	`priorPeriod` varchar(16),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_analysis_results_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_analysis_results_taskId_unique` UNIQUE(`taskId`)
);
--> statement-breakpoint
CREATE TABLE `product_analysis_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_analysis_tasks_id` PRIMARY KEY(`id`)
);
