import { describe, expect, it } from "vitest";
import { buildCommissionReport } from "./commissions";

describe("buildCommissionReport", () => {
  it("calculates taxable amounts, tax, and commission for each employee", () => {
    const rows = [
      { employee: "أحمد", amount: 1000, branch: "جدة" },
      { employee: "أحمد", amount: 2000, branch: "جدة" },
      { employee: "سارة", amount: 800, branch: "الدمام" },
    ];

    const rates = [
      { id: 1, employeeName: "أحمد", rate: "10.00", isActive: 1, isGlobalManager: 0 },
      { id: 2, employeeName: "سارة", rate: "5.00", isActive: 1, isGlobalManager: 0 },
    ];

    const result = buildCommissionReport({ rows, rates, month: "يونيو", monthYear: "يونيو-2026" });

    expect(result.month).toBe("يونيو");
    expect(result.totalCommission).toBeCloseTo(295.65);
  });
});
