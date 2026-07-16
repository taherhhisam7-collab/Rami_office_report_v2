import {
  bigint,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
};

export const users = pgTable("users", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  ...timestamps,
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const receipts = pgTable(
  "receipts",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    receiptNo: text("receiptNo"),
    receiptDate: bigint("receiptDate", { mode: "number" }).notNull(),
    branch: text("branch").notNull(),
    customerName: text("customerName").notNull(),
    service: text("service").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    paymentMethod: text("paymentMethod").notNull(),
    employee: text("employee"),
    notes: text("notes"),
    ...timestamps,
  },
  table => ({
    branchIdx: index("receipts_branch_idx").on(table.branch),
    dateIdx: index("receipts_date_idx").on(table.receiptDate),
    paymentIdx: index("receipts_payment_idx").on(table.paymentMethod),
    branchDateIdx: index("receipts_branch_date_idx").on(table.branch, table.receiptDate),
  })
);

export type Receipt = typeof receipts.$inferSelect;
export type InsertReceipt = typeof receipts.$inferInsert;

export const commissionRates = pgTable("commission_rates", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  employeeName: text("employeeName").notNull(),
  rate: numeric("rate", { precision: 5, scale: 2 }).notNull().default("2.00"),
  isActive: integer("isActive").notNull().default(1),
  isGlobalManager: integer("isGlobalManager").notNull().default(0),
  ...timestamps,
});

export type CommissionRate = typeof commissionRates.$inferSelect;
export type InsertCommissionRate = typeof commissionRates.$inferInsert;
