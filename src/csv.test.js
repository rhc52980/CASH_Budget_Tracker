import { describe, it, expect } from "vitest";
import { parseCsv, parseCsvDate, guessCategory, buildCsvPreview } from "./csv.js";

describe("parseCsv", () => {
  it("splits simple rows and skips blank lines", () => {
    expect(parseCsv("a,b\n1,2\n\n3,4\n")).toEqual([["a", "b"], ["1", "2"], ["3", "4"]]);
  });

  it("handles quoted fields with commas and escaped quotes", () => {
    const rows = parseCsv('date,"desc, with comma",amt\n1,"say ""hi""",2');
    expect(rows[0][1]).toBe("desc, with comma");
    expect(rows[1][1]).toBe('say "hi"');
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("parseCsvDate", () => {
  it("accepts ISO, US slash, and two-digit-year dates", () => {
    expect(parseCsvDate("2026-08-09")).toBe("2026-08-09");
    expect(parseCsvDate("2026-8-9")).toBe("2026-08-09");
    expect(parseCsvDate("8/9/2026")).toBe("2026-08-09");
    expect(parseCsvDate("08/09/26")).toBe("2026-08-09");
  });

  it("rejects non-dates", () => {
    expect(parseCsvDate("STARBUCKS")).toBeNull();
    expect(parseCsvDate("")).toBeNull();
  });
});

describe("guessCategory", () => {
  it("maps merchants to categories", () => {
    expect(guessCategory("KROGER #442", false)).toBe("Groceries");
    expect(guessCategory("SHELL OIL 5734", false)).toBe("Transport");
    expect(guessCategory("NETFLIX.COM", false)).toBe("Subscriptions");
    expect(guessCategory("SOMETHING UNKNOWN", false)).toBe("Other");
  });

  it("maps income descriptions", () => {
    expect(guessCategory("PAYROLL DIRECT DEP", true)).toBe("Salary");
    expect(guessCategory("VENMO TRANSFER", true)).toBe("Other income");
  });
});

describe("buildCsvPreview", () => {
  it("parses a signed-amount export and infers types", () => {
    const csv = "Date,Description,Amount\n08/03/2026,KROGER,-52.18\n08/07/2026,PAYROLL,1500.00";
    const res = buildCsvPreview(csv, []);
    expect(res.error).toBeUndefined();
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0]).toMatchObject({ date: "2026-08-03", amount: 52.18, type: "expense", category: "Groceries" });
    expect(res.rows[1]).toMatchObject({ type: "income", category: "Salary" });
  });

  it("parses separate Debit/Credit columns", () => {
    const csv = "Date,Description,Debit,Credit\n2026-08-03,KROGER,52.18,\n2026-08-07,DEPOSIT,,1500";
    const res = buildCsvPreview(csv, []);
    expect(res.rows[0].type).toBe("expense");
    expect(res.rows[1].type).toBe("income");
    expect(res.rows[1].amount).toBe(1500);
  });

  it("treats parenthesized amounts as expenses", () => {
    const csv = "Date,Description,Amount\n2026-08-03,STORE,(25.00)";
    const res = buildCsvPreview(csv, []);
    expect(res.rows[0]).toMatchObject({ type: "expense", amount: 25 });
  });

  it("flags duplicates of existing transactions and unchecks them", () => {
    const csv = "Date,Description,Amount\n2026-08-06,Weekly shop,-340.00\n2026-08-07,New thing,-10.00";
    const existing = [{ date: "2026-08-06", amount: 340, type: "expense" }];
    const res = buildCsvPreview(csv, existing);
    expect(res.rows[0].dup).toBe(true);
    expect(res.rows[0].include).toBe(false);
    expect(res.rows[1].dup).toBe(false);
    expect(res.rows[1].include).toBe(true);
  });

  it("errors on files without detectable columns", () => {
    expect(buildCsvPreview("just,some,text\nmore,text,here", []).error).toBeTruthy();
    expect(buildCsvPreview("", []).error).toBeTruthy();
  });

  it("skips rows with unparseable dates or zero amounts", () => {
    const csv = "Date,Description,Amount\nnot-a-date,X,-5\n2026-08-03,Y,0\n2026-08-04,Z,-7";
    const res = buildCsvPreview(csv, []);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].note).toBe("Z");
  });
});
