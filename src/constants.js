export const STORE_KEY = "budget-book-v1";

export const EXPENSE_CATS = [
  "Housing", "Groceries", "Dining", "Transport", "Utilities",
  "Health", "Entertainment", "Shopping", "Subscriptions", "Other",
];
export const INCOME_CATS = ["Salary", "Freelance", "Gifts", "Other income"];

// Per-theme category colors live in theme.js (CHART.light.cats / CHART.dark.cats)
// so each set can be validated against the surface it actually renders on.

// Swatches offered for user-defined categories — mid-lightness hues that stay
// clear of the built-in palette
export const CUSTOM_CAT_COLORS = [
  "#2E9AA8", "#7A9A3F", "#C2527E", "#6B62D9",
  "#B8722C", "#4E9E4E", "#A65B9E", "#75808A",
];

// Liabilities carry a negative balance so net worth is a plain sum.
export const ACCOUNT_TYPES = [
  { id: "checking", label: "Checking", liability: false },
  { id: "savings", label: "Savings", liability: false },
  { id: "cash", label: "Cash", liability: false },
  { id: "credit", label: "Credit card", liability: true },
  { id: "loan", label: "Loan", liability: true },
];

// Common bills: [name, default category] — one click prefills the add-bill form
export const BILL_PRESETS = [
  ["Rent", "Housing"], ["Mortgage", "Housing"],
  ["Electric", "Utilities"], ["Gas", "Utilities"], ["Water", "Utilities"],
  ["Trash", "Utilities"], ["Internet", "Utilities"], ["Mobile phone", "Utilities"],
  ["TV / Cable", "Subscriptions"], ["Streaming", "Subscriptions"],
  ["Auto payment", "Transport"], ["Auto insurance", "Transport"], ["Boat payment", "Transport"],
  ["Health insurance", "Health"], ["Gym", "Health"],
  ["Credit card", "Other"], ["Student loan", "Other"], ["Childcare", "Other"],
];
