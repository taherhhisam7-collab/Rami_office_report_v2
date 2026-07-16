CREATE TABLE `commission_rates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeName` varchar(255) NOT NULL,
	`rate` decimal(5,2) NOT NULL DEFAULT '2.00',
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `commission_rates_id` PRIMARY KEY(`id`)
);
