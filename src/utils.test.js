import { describe, it, expect } from "vitest";
import {
  monthKey, monthDiff, shiftMonth, dueDateInMonth, ordinal, kFmt, computeCarry,
  loanRemaining, loanPaymentsLeft, accountBalance, netWorth,
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

describe("account balances", () => {
  const tx = [
    { id: "a", type: "income", amount: 3000, accountId: "chk", date: "2026-08-01", category: "Salary" },
    { id: "b", type: "expense", amount: 200, accountId: "chk", date: "2026-08-04", category: "Groceries" },
    { id: "c", type: "expense", amount: 75, accountId: "card", date: "2026-08-05", category: "Dining" },
    { id: "d", type: "transfer", amount: 500, accountId: "chk", toAccountId: "sav", date: "2026-08-06" },
  ];

  it("adds income and subtracts spending", () => {
    expect(accountBalance("chk", 1000, tx)).toBe(1000 + 3000 - 200 - 500);
  });

  it("moves value on a transfer without inventing any", () => {
    expect(accountBalance("sav", 0, tx)).toBe(500);
    const before = 1000 + 0;
    const after = accountBalance("chk", 1000, tx) + accountBalance("sav", 0, tx);
    expect(after).toBe(before + 3000 - 200 - 500 + 500 - 0 + 0); // transfer nets out
  });

  it("ignores transactions belonging to other accounts", () => {
    expect(accountBalance("card", 0, tx)).toBe(-75);
  });

  it("treats a credit card as a negative balance", () => {
    // owing $450 to start, then a $75 purchase, then a $100 payment in
    const cardTx = [
      { id: "x", type: "expense", amount: 75, accountId: "card", date: "2026-08-05" },
      { id: "y", type: "transfer", amount: 100, accountId: "chk", toAccountId: "card", date: "2026-08-09" },
    ];
    expect(accountBalance("card", -450, cardTx)).toBe(-425);
  });

  it("nets assets against liabilities for net worth", () => {
    const accounts = [
      { id: "chk", startingBalance: 1000 },
      { id: "sav", startingBalance: 0 },
      { id: "card", startingBalance: -450 },
    ];
    // 1000+3000-200-500 = 3300, savings 500, card -450-75 = -525
    expect(netWorth(accounts, tx)).toBe(3300 + 500 - 525);
  });

  it("is zero for no accounts, and ignores unassigned transactions", () => {
    expect(netWorth([], tx)).toBe(0);
    const loose = [{ id: "z", type: "expense", amount: 50, date: "2026-08-02" }];
    expect(accountBalance("chk", 100, loose)).toBe(100);
  });
});

describe("loan payoff maths", () => {
  it("with no interest a payment comes straight off the balance", () => {
    expect(loanRemaining(1000, 0, 100, 3)).toBe(700);
    expect(loanPaymentsLeft(1000, 0, 100)).toBe(10);
  });

  it("charges interest before principal", () => {
    // 12% APR = 1% a month. First payment: $10 interest, $90 principal.
    expect(loanRemaining(1000, 12, 100, 1)).toBeCloseTo(910, 6);
    // Second: 1% of 910 = $9.10 interest, $90.90 principal.
    expect(loanRemaining(1000, 12, 100, 2)).toBeCloseTo(819.1, 6);
  });

  it("never reports a negative balance once cleared", () => {
    expect(loanRemaining(500, 0, 100, 20)).toBe(0);
    expect(loanPaymentsLeft(0, 5, 100)).toBe(0);
  });

  it("takes more payments with interest than without", () => {
    const plain = loanPaymentsLeft(10000, 0, 300);
    const withApr = loanPaymentsLeft(10000, 7.5, 300);
    expect(withApr).toBeGreaterThan(plain);
    expect(withApr).toBeLessThan(60);
  });

  it("reports never-ending when the payment cannot cover the interest", () => {
    // 24% APR on 10k = $200/month interest; a $150 payment loses ground
    expect(loanPaymentsLeft(10000, 24, 150)).toBe(Infinity);
    expect(loanRemaining(10000, 24, 150, 5)).toBe(10000);
    expect(loanPaymentsLeft(1000, 0, 0)).toBe(Infinity);
  });

  it("a realistic car loan clears in a sensible number of payments", () => {
    // $18,000 at 6.9% paying $412.50 -> roughly four years
    const n = loanPaymentsLeft(18000, 6.9, 412.5);
    expect(n).toBeGreaterThan(44);
    expect(n).toBeLessThan(52);
    expect(loanRemaining(18000, 6.9, 412.5, n)).toBe(0);
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
