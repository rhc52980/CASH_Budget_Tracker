export const STORE_KEY = "budget-book-v1";

export const EXPENSE_CATS = [
  "Housing", "Groceries", "Dining", "Transport", "Utilities",
  "Health", "Entertainment", "Shopping", "Subscriptions", "Other",
];
export const INCOME_CATS = ["Salary", "Freelance", "Gifts", "Other income"];

// Hue assignment is ordered so adjacent categories stay distinguishable under
// colorblindness — re-validate (dataviz six checks) before reshuffling
export const CAT_COLORS = {
  Housing: "#1E7A4F", Groceries: "#DFA32B", Dining: "#5560C0",
  Transport: "#B5504A", Utilities: "#0E9488", Health: "#A87F35",
  Entertainment: "#3E7FB5", Shopping: "#C4703A", Subscriptions: "#8A5FA8",
  Other: "#D683A2",
};

// Swatches offered for user-defined categories — mid-lightness hues that stay
// clear of the fixed palette above
export const CUSTOM_CAT_COLORS = [
  "#2E9AA8", "#7A9A3F", "#C2527E", "#6B62D9",
  "#B8722C", "#4E9E4E", "#A65B9E", "#75808A",
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
