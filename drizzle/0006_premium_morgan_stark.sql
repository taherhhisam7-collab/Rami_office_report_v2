CREATE TABLE IF NOT EXISTS "commission_rates" (
  "id" serial PRIMARY KEY,
  "employeeName" text NOT NULL,
  "rate" numeric(5, 2) NOT NULL DEFAULT '2.00',
  "isActive" integer NOT NULL DEFAULT 1,
  "isGlobalManager" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
