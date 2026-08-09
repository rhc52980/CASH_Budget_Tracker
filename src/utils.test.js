import { describe, it, expect } from "vitest";
import {
  monthKey, monthDiff, shiftMonth, dueDateInMonth, ordinal, kFmt, computeCarry,
} from "./utils.js";

describe("date helpers", () => {
  it("monthKey extracts YYYY-MM", () => {
    expect(monthKey("2026-08-09")).toBe("2026-08");
  });

  it("shiftMonth crosses year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-06", -18)).toBe("2024-12");
  });

  it("monthDiff counts calendar months", () => {
    expect(monthDiff("2026-05", "2026-08")).toBe(3);
    expect(monthDiff("2025-11", "2026-02")).toBe(3);
    expect(monthDiff("2026-08", "2026-08")).toBe(0);
  });

  it("dueDateInMonth clamps to the month's length", () => {
    expect(dueDateInMonth("2026-02", 31)).toBe("2026-02-28");
    expect(dueDateInMonth("2024-02", 30)).toBe("2024-02-29"); // leap year
    expect(dueDateInMonth("2026-08", 5)).toBe("2026-08-05");
  });
});

describe("formatting", () => {
  it("ordinal handles teens and edge digits", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(13)).toBe("13th");
    expect(ordinal(21)).toBe("21st");
    expect(ordinal(31)).toBe("31st");
  });

  it("kFmt abbreviates thousands and keeps sign", () => {
    expect(kFmt(950)).toBe("$950");
    expect(kFmt(1500)).toBe("$1.5k");
    expect(kFmt(-2200)).toBe("−$2.2k");
    expect(kFmt(0)).toBe("$0");
  });
});

describe("computeCarry (budget rollover)", () => {
  const tx = (date, category, amount) => ({ id: date + category, type: "expense", category, amount, date });

  it("accumulates surplus from prior months", () => {
    const transactions = [
      tx("2026-05-14", "Dining", 100),
      tx("2026-06-14", "Dining", 120),
      tx("2026-07-14", "Dining", 140),
    ];
    const carry = computeCarry(transactions, { Dining: 200 }, { Dining: true }, "2026-08", ["Dining"]);
    expect(carry.Dining).toBe(100 + 80 + 60);
  });

  it("carries deficits from overspending", () => {
    const transactions = [tx("2026-07-14", "Dining", 350)];
    const carry = computeCarry(transactions, { Dining: 200 }, { Dining: true }, "2026-08", ["Dining"]);
    expect(carry.Dining).toBe(-150);
  });

  it("is zero when rollover is off, no budget, or no history", () => {
    const transactions = [tx("2026-07-14", "Dining", 100)];
    expect(computeCarry(transactions, { Dining: 200 }, {}, "2026-08", ["Dining"]).Dining).toBe(0);
    expect(computeCarry(transactions, {}, { Dining: true }, "2026-08", ["Dining"]).Dining).toBe(0);
    expect(computeCarry([], { Dining: 200 }, { Dining: true }, "2026-08", ["Dining"]).Dining).toBe(0);
  });

  it("does not accrue for months before the first transaction", () => {
    const transactions = [tx("2026-07-14", "Dining", 50)];
    const carry = computeCarry(transactions, { Dining: 200 }, { Dining: true }, "2026-08", ["Dining"]);
    expect(carry.Dining).toBe(150); // only July counts, not a fictional 24 months
  });
});
