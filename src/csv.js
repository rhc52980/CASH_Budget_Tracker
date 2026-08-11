export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export function parseCsvDate(s) {
  s = (s || "").trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)))
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) {
    const y = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return null;
}

const CAT_KEYWORDS = [
  [/krog|walmart|wal-mart|aldi|costco|grocer|wegman|safeway|publix|trader joe|whole foods|\bheb\b|meijer|food lion/i, "Groceries"],
  [/mcdonald|starbucks|chipotle|restaurant|pizza|taco|burger|wendy|dunkin|subway|doordash|grubhub|uber eats|cafe|diner|chick-fil|sonic|kfc|panera/i, "Dining"],
  [/shell|exxon|chevron|\bbp\b|speedway|gas station|fuel|\buber\b|\blyft\b|parking|toll|car wash|jiffy|oil change|autozone|o'reilly/i, "Transport"],
  [/electric|power co|water|sewer|utility|comcast|xfinity|spectrum|verizon|at&t|t-mobile|internet|duke energy|dominion/i, "Utilities"],
  [/netflix|spotify|hulu|disney\+|hbo|paramount|prime video|youtube prem|apple\.com\/bill|subscription|patreon|audible/i, "Subscriptions"],
  [/rent|mortgage|\bhoa\b|landlord|apartment/i, "Housing"],
  [/cvs|walgreens|pharmacy|doctor|dental|clinic|hospital|gym|fitness|medical|optometr/i, "Health"],
  [/amazon|amzn|target|best buy|ebay|etsy|clothing|shoe|home depot|lowe's|lowes|marshalls|tj maxx/i, "Shopping"],
  [/movie|cinema|theater|steam|playstation|xbox|nintendo|ticketmaster|concert|bowling/i, "Entertainment"],
];

/**
 * Stable key for a merchant, so "KROGER #442" and "KROGER #118" are recognised
 * as the same shop. Drops digits and punctuation (store and terminal numbers)
 * and keeps the first few words, which is where the actual name lives.
 */
export function merchantKey(desc) {
  const cleaned = (desc || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? cleaned.split(" ").slice(0, 3).join(" ") : "";
}

export function guessCategory(desc, isIncome) {
  if (isIncome) return /payroll|salary|direct dep|paycheck|\bdd\b/i.test(desc) ? "Salary" : "Other income";
  for (const [re, cat] of CAT_KEYWORDS) if (re.test(desc)) return cat;
  return "Other";
}

export function buildCsvPreview(text, existingTx, learned = {}) {
  const grid = parseCsv(text);
  if (grid.length < 2) return { error: "Couldn't find any data rows in that file." };

  const header = grid[0].map((h) => h.toLowerCase().trim());
  const find = (re) => header.findIndex((h) => re.test(h));
  let iDate = find(/date/);
  let iDesc = find(/desc|memo|payee|merchant|name|detail/);
  let iAmt = find(/amount|^amt$/);
  const iDebit = find(/debit|withdraw/);
  const iCredit = find(/credit|deposit/);
  let dataRows = grid.slice(1);

  if (iDate === -1) {
    // No recognizable header — treat every row as data and sniff the columns
    dataRows = grid;
    const sample = grid[0];
    iDate = sample.findIndex((c) => parseCsvDate(c));
    iAmt = sample.findIndex((c, j) => j !== iDate && c.trim() !== "" && !isNaN(parseFloat(c.replace(/[$,]/g, ""))));
    iDesc = sample.findIndex((c, j) => j !== iDate && j !== iAmt && c.trim() !== "" && isNaN(parseFloat(c.replace(/[$,]/g, ""))));
  }
  if (iDate === -1 || (iAmt === -1 && iDebit === -1 && iCredit === -1)) {
    return { error: "Couldn't detect the date and amount columns. The file needs headers like Date, Description, and Amount (or Debit/Credit)." };
  }

  const dupKeys = new Set(existingTx.map((t) => `${t.date}|${t.amount.toFixed(2)}|${t.type}`));
  const rows = [];
  dataRows.forEach((r) => {
    const date = parseCsvDate(r[iDate]);
    if (!date) return;
    let amount = null, type = "expense";
    if (iDebit !== -1 || iCredit !== -1) {
      const deb = iDebit !== -1 ? parseFloat((r[iDebit] || "").replace(/[$,()]/g, "")) : NaN;
      const cred = iCredit !== -1 ? parseFloat((r[iCredit] || "").replace(/[$,()]/g, "")) : NaN;
      if (deb > 0) { amount = deb; type = "expense"; }
      else if (cred > 0) { amount = cred; type = "income"; }
    } else {
      const raw = (r[iAmt] || "").trim();
      const v = parseFloat(raw.replace(/[$,()]/g, ""));
      if (isNaN(v) || v === 0) return;
      type = (/^\(.*\)$/.test(raw) || v < 0) ? "expense" : "income";
      amount = Math.abs(v);
    }
    if (!amount) return;
    const note = (iDesc !== -1 ? r[iDesc] || "" : "").trim().slice(0, 80);
    const dup = dupKeys.has(`${date}|${amount.toFixed(2)}|${type}`);
    // What you chose last time for this merchant beats the built-in guess
    const remembered = learned[merchantKey(note)];
    rows.push({
      date, amount, type, note,
      category: remembered || guessCategory(note, type === "income"),
      remembered: Boolean(remembered),
      dup, include: !dup,
    });
  });

  if (!rows.length) return { error: "No usable rows found — check that the file has date and amount values." };
  return { rows };
}
