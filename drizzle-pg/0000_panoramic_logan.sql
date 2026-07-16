CREATE TABLE "commission_rates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "commission_rates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"employeeName" text NOT NULL,
	"rate" numeric(5, 2) DEFAULT '2.00' NOT NULL,
	"isActive" integer DEFAULT 1 NOT NULL,
	"isGlobalManager" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "receipts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"receiptNo" text,
	"receiptDate" bigint NOT NULL,
	"branch" text NOT NULL,
	"customerName" text NOT NULL,
	"service" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"paymentMethod" text NOT NULL,
	"employee" text,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"openId" text NOT NULL,
	"name" text,
	"email" text,
	"loginMethod" text,
	"role" text DEFAULT 'user' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE INDEX "receipts_branch_idx" ON "receipts" USING btree ("branch");--> statement-breakpoint
CREATE INDEX "receipts_date_idx" ON "receipts" USING btree ("receiptDate");--> statement-breakpoint
CREATE INDEX "receipts_payment_idx" ON "receipts" USING btree ("paymentMethod");--> statement-breakpoint
CREATE INDEX "receipts_branch_date_idx" ON "receipts" USING btree ("branch","receiptDate");