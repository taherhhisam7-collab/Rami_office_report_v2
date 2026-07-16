CREATE TABLE `receipts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receiptNo` varchar(32),
	`receiptDate` bigint NOT NULL,
	`branch` varchar(32) NOT NULL,
	`customerName` varchar(255) NOT NULL,
	`service` varchar(255) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`paymentMethod` varchar(64) NOT NULL,
	`employee` varchar(255),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `receipts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `assignedBranch` varchar(32);--> statement-breakpoint
CREATE INDEX `branch_idx` ON `receipts` (`branch`);--> statement-breakpoint
CREATE INDEX `date_idx` ON `receipts` (`receiptDate`);--> statement-breakpoint
CREATE INDEX `payment_idx` ON `receipts` (`paymentMethod`);