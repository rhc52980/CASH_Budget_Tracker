import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppCtx } from "./ctx.js";
import { CHART } from "./theme.js";
import { EXPENSE_CATS, INCOME_CATS } from "./constants.js";
import { todayStr } from "./utils.js";
import { AddEntry } from "./AddEntry.jsx";

const ctx = {
  dark: false, chart: CHART.light, expenseCats: EXPENSE_CATS,
  allCats: [...EXPENSE_CATS, ...INCOME_CATS], catColor: () => "#888", accounts: [],
};

function mount(onAdd = vi.fn()) {
  render(<AppCtx.Provider value={ctx}><AddEntry onAdd={onAdd} /></AppCtx.Provider>);
  return onAdd;
}

describe("AddEntry", () => {
  it("lands in the amount field so a phone opens straight onto the keypad", () => {
    mount();
    expect(document.activeElement).toHaveClass("amount-field");
  });

  it("saves on Enter with the chosen chip and today's date", async () => {
    const user = userEvent.setup();
    const onAdd = mount();
    await user.type(screen.getByLabelText("Amount"), "12.40");
    await user.click(screen.getByRole("button", { name: /Dining/ }));
    await user.click(screen.getByLabelText("Amount"));
    await user.keyboard("{Enter}");
    expect(onAdd).toHaveBeenCalledTimes(1);
    const [tx] = onAdd.mock.calls[0][0];
    expect(tx).toMatchObject({ type: "expense", amount: 12.4, category: "Dining", date: todayStr(), note: "" });
  });

  it("refuses an empty amount and says so", async () => {
    const user = userEvent.setup();
    const onAdd = mount();
    await user.click(screen.getByRole("button", { name: "Save entry" }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByText(/amount greater than zero/i)).toBeInTheDocument();
  });

  it("switching to income swaps the chips", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button", { name: "Income" }));
    expect(screen.getByRole("button", { name: /Salary/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Groceries/ })).not.toBeInTheDocument();
  });

  it("keeps a note set behind the collapsed panel, and marks the toggle", async () => {
    const user = userEvent.setup();
    const onAdd = mount();
    await user.click(screen.getByRole("button", { name: "More details" }));
    await user.type(screen.getByPlaceholderText(/Farmers market/), "Coffee with Dana");
    await user.click(screen.getByRole("button", { name: "Fewer details" }));
    // the dot that says something is set
    expect(screen.getByLabelText("1 already set")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Amount"), "6.75{Enter}");
    expect(onAdd.mock.calls[0][0][0].note).toBe("Coffee with Dana");
  });

  it("splits one receipt into several entries that share the note", async () => {
    const user = userEvent.setup();
    const onAdd = mount();
    await user.click(screen.getByRole("button", { name: "More details" }));
    await user.click(screen.getByRole("button", { name: "Split across categories" }));
    const amounts = screen.getAllByPlaceholderText("0.00");
    await user.type(amounts[0], "40");
    await user.type(amounts[1], "15");
    await user.click(screen.getByRole("button", { name: /Save 2 entries/ }));
    const txs = onAdd.mock.calls[0][0];
    expect(txs).toHaveLength(2);
    expect(txs.map((t) => t.amount)).toEqual([40, 15]);
    expect(new Set(txs.map((t) => t.date)).size).toBe(1);
  });
});
