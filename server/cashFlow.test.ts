import { describe, expect, it } from "vitest";
import { getLastCashFlowBalance, parseCashFlowAmount } from "./cashFlow";

describe("cash flow balances", () => {
  it("reads formatted Western and Arabic amounts without changing their value", () => {
    expect(parseCashFlowAmount("1,234.50 ر.س")).toBe(1234.5);
    expect(parseCashFlowAmount("١٬٢٣٤٫٥٠ ر.س")).toBe(1234.5);
    expect(parseCashFlowAmount("(2,500.75)")).toBe(-2500.75);
  });

  it("uses the balance from the last created sheet row", () => {
    const rows = [
      ["01/07/2026", "opening", 0, 0, "10,000"],
      ["20/07/2026", "income", 0, 500, "10,500"],
      ["02/07/2026", "late entry", 250, 0, "10,250"],
    ];

    expect(getLastCashFlowBalance(rows)).toBe(10250);
  });

  it("does not mistake a trailing blank row for the final created row", () => {
    expect(getLastCashFlowBalance([
      ["20/07/2026", "income", 0, 500, "10,500.25"],
      ["", "", "", "", ""],
    ])).toBe(10500.25);
  });
});
