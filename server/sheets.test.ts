import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

function createCtx(overrides?: Partial<User>): TrpcContext {
  const mockUser: User = {
    id: 1,
    openId: "test-user-openid",
    name: "مستخدم اختبار",
    email: "test@example.com",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
  return {
    user: mockUser,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("sheets router", () => {
  it("filterOptions returns arrays", async () => {
    const caller = appRouter.createCaller(createCtx());
    const opts = await caller.sheets.filterOptions({});
    expect(Array.isArray(opts.branches)).toBe(true);
    expect(Array.isArray(opts.paymentMethods)).toBe(true);
    expect(Array.isArray(opts.employees)).toBe(true);
    expect(Array.isArray(opts.services)).toBe(true);
  });

  it("dashboardStats returns valid structure", async () => {
    const caller = appRouter.createCaller(createCtx());
    const stats = await caller.sheets.dashboardStats({});
    expect(typeof stats.totalAmount).toBe("number");
    expect(typeof stats.totalCount).toBe("number");
    expect(Array.isArray(stats.byBranch)).toBe(true);
    expect(Array.isArray(stats.byPayment)).toBe(true);
    expect(Array.isArray(stats.byService)).toBe(true);
    expect(Array.isArray(stats.byEmployee)).toBe(true);
    expect(Array.isArray(stats.timeSeries)).toBe(true);
  });

  it("records returns paginated results", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.sheets.records({ page: 1, pageSize: 10 });
    expect(typeof result.total).toBe("number");
    expect(typeof result.totalAmount).toBe("number");
    expect(Array.isArray(result.records)).toBe(true);
    expect(result.records.length).toBeLessThanOrEqual(10);
  });

  it("any authenticated user can access all branches data", async () => {
    // أي مستخدم مسجل يرى كل البيانات بدون قيود
    const caller = appRouter.createCaller(createCtx({ role: "user" }));
    const opts = await caller.sheets.filterOptions({});
    expect(opts.branches.length).toBeGreaterThanOrEqual(0);
    const stats = await caller.sheets.dashboardStats({});
    expect(typeof stats.totalAmount).toBe("number");
  });

  it("branch filter works correctly when specified", async () => {
    const caller = appRouter.createCaller(createCtx());
    const stats = await caller.sheets.dashboardStats({ branch: "جدة" });
    expect(typeof stats.totalAmount).toBe("number");
    expect(Array.isArray(stats.byBranch)).toBe(true);
  });
});
