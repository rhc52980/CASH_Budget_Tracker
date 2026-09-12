import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppCtx } from "./ctx.js";
import { CHART } from "./theme.js";
import { EXPENSE_CATS, INCOME_CATS } from "./constants.js";
import { Bills } from "./BillsTab.jsx";

const ctx = {
  dark: false, chart: CHART.light, expenseCats: EXPENSE_CATS,
  allCats: [...EXPENSE_CATS, ...INCOME_CATS], catColor: () => "#888", accounts: [],
};

function mount(over = {}) {
  const props = {
    bills: [], month: "2026-09", paidMap: {}, transactions: [],
    addBill: vi.fn(), deleteBill: vi.fn(), updateBill: vi.fn(), markPaid: vi.fn(), unmarkPaid: vi.fn(),
    incomes: [], incomePaidMap: {}, addIncome: vi.fn(), deleteIncome: vi.fn(), updateIncome: vi.fn(),
    markIncome: vi.fn(), unmarkIncome: vi.fn(),
    ...over,
  };
  render(<AppCtx.Provider value={ctx}><Bills {...props} /></AppCtx.Provider>);
  return props;
}

describe("Bills", () => {
  it("gives both empty states a way forward", () => {
    mount();
    expect(screen.getByRole("button", { name: "Add your first bill" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add your paycheck" })).toBeInTheDocument();
  });

  it("a preset fills the name and category; the bill is stored with its due day", async () => {
    const user = userEvent.setup();
    const p = mount();
    await user.click(screen.getByRole("button", { name: "Water" }));
    await user.type(screen.getByPlaceholderText("Amount"), "90");
    const day = screen.getByPlaceholderText(/Due day/);
    await user.clear(day);
    await user.type(day, "15");
    await user.click(screen.getByRole("button", { name: "Add bill" }));
    expect(p.addBill).toHaveBeenCalledTimes(1);
    expect(p.addBill.mock.calls[0][0]).toMatchObject({ name: "Water", category: "Utilities", amount: 90, dueDay: 15, autoPay: false, varies: false });
  });

  it("a varying bill asks what you were charged and logs that, not the typical amount", async () => {
    const user = userEvent.setup();
    const water = { id: "w", name: "Water", amount: 90, category: "Utilities", dueDay: 15, varies: true };
    const p = mount({ bills: [water] });
    expect(screen.getByText("VARIES")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mark paid…" }));
    const box = screen.getByLabelText("Amount charged for Water");
    expect(box).toHaveValue(90);
    await user.clear(box);
    await user.type(box, "103.47{Enter}");
    expect(p.markPaid).toHaveBeenCalledWith(water, 103.47);
  });

  it("auto-pay and varies cannot both be on", async () => {
    const user = userEvent.setup();
    mount();
    const autoPay = screen.getByRole("checkbox", { name: /Auto-pay/ });
    const varies = screen.getByRole("checkbox", { name: /Amount varies/ });
    await user.click(autoPay);
    expect(autoPay).toBeChecked();
    await user.click(varies);
    expect(varies).toBeChecked();
    expect(autoPay).not.toBeChecked();
    expect(autoPay).toBeDisabled();
  });
});

describe("Expected income", () => {
  it("an annual biweekly figure is stored per paycheck, with the annual number kept", async () => {
    const user = userEvent.setup();
    const p = mount();
    await user.click(screen.getByRole("button", { name: "Enter annual" }));
    await user.type(screen.getByPlaceholderText(/Name — e.g. Paycheck/), "Paycheck");
    await user.type(screen.getByPlaceholderText("Take-home per year"), "85000");
    await user.type(screen.getByPlaceholderText(/Gross per year/), "100000");
    await user.selectOptions(screen.getByLabelText("How often you are paid"), "biweekly");
    const anchor = screen.getByLabelText("A date you were paid on");
    await user.clear(anchor);
    await user.type(anchor, "2026-09-04");
    await user.click(screen.getByRole("checkbox", { name: /Auto-receive/ }));
    await user.click(screen.getByRole("button", { name: "Add income" }));
    expect(p.addIncome).toHaveBeenCalledTimes(1);
    expect(p.addIncome.mock.calls[0][0]).toMatchObject({
      name: "Paycheck", amount: 3269.23, gross: 3846.15, schedule: "biweekly", anchor: "2026-09-04",
      autoPay: true, annualAmount: 85000, annualGross: 100000,
    });
  });

  it("shows one row per pay date and marks each on its own", async () => {
    const user = userEvent.setup();
    const pay = { id: "p", name: "Paycheck", amount: 3269.23, category: "Salary", schedule: "biweekly", anchor: "2026-09-04", payDay: 4 };
    const p = mount({ incomes: [pay], incomePaidMap: { "p:2026-09-04": "t1" }, transactions: [{ id: "t1", type: "income", amount: 3269.23, date: "2026-09-04" }] });
    expect(screen.getByText(/arrives Sep 4/)).toBeInTheDocument();
    expect(screen.getByText(/arrives Sep 18/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Received ✓" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mark received" }));
    expect(p.markIncome).toHaveBeenCalledWith(pay, "2026-09-18");
  });

  it("the household card totals every source, annual figure first", () => {
    mount({ incomes: [
      { id: "a", name: "Paycheck", amount: 3269.23, category: "Salary", schedule: "biweekly", anchor: "2026-09-04", payDay: 4, annualAmount: 85000 },
      { id: "b", name: "Side", amount: 400, category: "Freelance", schedule: "monthly", payDay: 20 },
    ] });
    const card = screen.getByText("Household income").closest("div").parentElement;
    expect(within(card).getByText("$89,800.00")).toBeInTheDocument();
  });
});
