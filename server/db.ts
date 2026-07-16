import { eq, and, gte, lte, sql, desc, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { InsertUser, users, receipts, InsertReceipt } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // Supabase's pooler terminates TLS; the URL supplied by the dashboard is
      // used unchanged and pg manages the application's small connection pool.
      _pool = new Pool({ connectionString: process.env.DATABASE_URL });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet as Partial<InsertUser>,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ===================== Receipts =====================

export type ReceiptFilters = {
  branch?: string;
  paymentMethod?: string;
  employee?: string;
  service?: string;
  startDate?: number; // unix ms
  endDate?: number; // unix ms
};

function buildConditions(filters: ReceiptFilters) {
  const conds = [];
  if (filters.branch) conds.push(eq(receipts.branch, filters.branch));
  if (filters.paymentMethod) conds.push(eq(receipts.paymentMethod, filters.paymentMethod));
  if (filters.employee) conds.push(eq(receipts.employee, filters.employee));
  if (filters.service) conds.push(eq(receipts.service, filters.service));
  if (filters.startDate !== undefined) conds.push(gte(receipts.receiptDate, filters.startDate));
  if (filters.endDate !== undefined) conds.push(lte(receipts.receiptDate, filters.endDate));
  return conds.length > 0 ? and(...conds) : undefined;
}

export async function createReceipt(data: InsertReceipt) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(receipts).values(data);
  return result;
}

export async function listReceipts(filters: ReceiptFilters, limit = 500, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  const where = buildConditions(filters);
  const q = db.select().from(receipts);
  if (where) q.where(where);
  return q.orderBy(desc(receipts.receiptDate), desc(receipts.id)).limit(limit).offset(offset);
}

export async function updateReceipt(id: number, data: Partial<InsertReceipt>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(receipts).set(data).where(eq(receipts.id, id));
}

export async function deleteReceipt(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(receipts).where(eq(receipts.id, id));
}

/** إجمالي عام + عدد السندات مع الفلاتر */
export async function getSummary(filters: ReceiptFilters) {
  const db = await getDb();
  if (!db) return { totalAmount: 0, totalCount: 0 };
  const where = buildConditions(filters);
  const q = db
    .select({
      totalAmount: sql<string>`COALESCE(SUM(${receipts.amount}), 0)`,
      totalCount: count(receipts.id),
    })
    .from(receipts);
  if (where) q.where(where);
  const rows = await q;
  return {
    totalAmount: Number(rows[0]?.totalAmount ?? 0),
    totalCount: Number(rows[0]?.totalCount ?? 0),
  };
}

/** تجميع حسب عمود معيّن (الفرع، طريقة الدفع، الخدمة، الموظف) */
export async function getGroupedTotals(
  groupBy: "branch" | "paymentMethod" | "service" | "employee",
  filters: ReceiptFilters
) {
  const db = await getDb();
  if (!db) return [];
  const col = receipts[groupBy];
  const where = buildConditions(filters);
  const q = db
    .select({
      key: col,
      total: sql<string>`COALESCE(SUM(${receipts.amount}), 0)`,
      cnt: count(receipts.id),
    })
    .from(receipts);
  if (where) q.where(where);
  const rows = await q.groupBy(col).orderBy(desc(sql`SUM(${receipts.amount})`));
  return rows.map((r) => ({
    key: r.key ?? "غير محدد",
    total: Number(r.total ?? 0),
    count: Number(r.cnt ?? 0),
  }));
}

/** سلسلة زمنية للإيرادات حسب الفترة (يومي/شهري) للرسم البياني */
export async function getTimeSeries(
  granularity: "day" | "month",
  filters: ReceiptFilters
) {
  const db = await getDb();
  if (!db) return [];
  const where = buildConditions(filters);
  // تحويل unix ms إلى تاريخ ثم تجميع
  const fmt = granularity === "day" ? "YYYY-MM-DD" : "YYYY-MM";
  const periodExpr = sql<string>`to_char(to_timestamp(${receipts.receiptDate} / 1000.0), ${fmt})`;
  const q = db
    .select({
      period: periodExpr,
      total: sql<string>`COALESCE(SUM(${receipts.amount}), 0)`,
      cnt: count(receipts.id),
    })
    .from(receipts);
  if (where) q.where(where);
  const rows = await q.groupBy(periodExpr).orderBy(periodExpr);
  return rows.map((r) => ({
    period: r.period,
    total: Number(r.total ?? 0),
    count: Number(r.cnt ?? 0),
  }));
}

/** القيم المميزة لعمود (للفلاتر المنسدلة) */
export async function getDistinctValues(
  column: "branch" | "paymentMethod" | "service" | "employee"
) {
  const db = await getDb();
  if (!db) return [];
  const col = receipts[column];
  const rows = await db.selectDistinct({ value: col }).from(receipts);
  return rows.map((r) => r.value).filter((v): v is string => !!v).sort();
}

export async function countReceipts() {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ c: count(receipts.id) }).from(receipts);
  return Number(rows[0]?.c ?? 0);
}

export async function bulkInsertReceipts(rows: InsertReceipt[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (rows.length === 0) return;
  // إدخال على دفعات صغيرة
  const chunkSize = 50;
  for (let i = 0; i < rows.length; i += chunkSize) {
    await db.insert(receipts).values(rows.slice(i, i + chunkSize));
  }
}
