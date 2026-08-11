import { useMemo, useState } from "react";
import { T } from "./theme.js";
import { ACCOUNT_TYPES } from "./constants.js";
import { fmt, uid, todayStr, accountBalance, netWorth } from "./utils.js";
import { Card, SectionTitle, Empty, btn, ghostBtn, inputStyle, numeral } from "./ui.jsx";

const typeOf = (id) => ACCOUNT_TYPES.find((t) => t.id === id) || ACCOUNT_TYPES[0];

export function AccountsTab({
  accounts, transactions, addAccount, updateAccount, deleteAccount, addTransfer,
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showTransfer, setShowTransfer] = useState(false);

  const balances = useMemo(() => {
    const m = {};
    accounts.forEach((a) => { m[a.id] = accountBalance(a.id, a.startingBalance, transactions); });
    return m;
  }, [accounts, transactions]);

  const worth = useMemo(() => netWorth(accounts, transactions), [accounts, transactions]);
  const assets = accounts.filter((a) => !typeOf(a.type).liability);
  const debts = accounts.filter((a) => typeOf(a.type).liability);
  const sum = (list) => list.reduce((s, a) => s + (balances[a.id] || 0), 0);

  // Entries recorded before any account existed, or whose account was removed
  const known = new Set(accounts.map((a) => a.id));
  const unassigned = transactions.filter(
    (t) => t.type !== "transfer" && (!t.accountId || !known.has(t.accountId))
  ).length;

  return (
    <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
      <Card>
        <SectionTitle right={
          <div style={{ display: "flex", gap: 6 }}>
            {accounts.length > 1 && (
              <button onClick={() => { setShowTransfer((v) => !v); setShowAdd(false); }}
                style={{ ...ghostBtn, padding: "7px 12px", fontSize: 13 }}>
                {showTransfer ? "Cancel" : "Transfer"}
              </button>
            )}
            <button onClick={() => { setShowAdd((v) => !v); setShowTransfer(false); }}
              style={{ ...btn(T.brass), padding: "7px 13px", fontSize: 13 }}>
              {showAdd ? "Close" : "Add account"}
            </button>
          </div>
        }>Net worth</SectionTitle>

        <div style={{ ...numeral("clamp(30px, 8vw, 40px)", 650), color: worth >= 0 ? T.ink : T.neg }}>
          {(worth < 0 ? "−" : "") + fmt(Math.abs(worth))}
        </div>
        {accounts.length > 0 && (
          <div style={{ fontSize: 13, color: T.mute, marginTop: 6 }}>
            {fmt(sum(assets))} in accounts
            {debts.length > 0 && <> · {fmt(Math.abs(sum(debts)))} owed</>}
          </div>
        )}

        {showAdd && (
          <AccountForm
            onSave={(a) => { addAccount(a); setShowAdd(false); }}
            onCancel={() => setShowAdd(false)} />
        )}
        {showTransfer && (
          <TransferForm accounts={accounts} balances={balances}
            onSave={(t) => { addTransfer(t); setShowTransfer(false); }}
            onCancel={() => setShowTransfer(false)} />
        )}
      </Card>

      {accounts.length === 0 ? (
        <Empty card text="No accounts yet. Add your checking account, savings, and any credit cards to see what you actually have — not just what you spent." />
      ) : (
        <>
          {[["Accounts", assets], ["Owed", debts]].map(([heading, list]) =>
            list.length === 0 ? null : (
              <Card key={heading}>
                <SectionTitle right={
                  <span style={{ fontSize: 13, color: T.mute, fontVariantNumeric: "tabular-nums" }}>
                    {fmt(Math.abs(sum(list)))}
                  </span>
                }>{heading}</SectionTitle>
                {list.map((a, i) => (
                  editId === a.id ? (
                    <AccountForm key={a.id} account={a} topBorder={i > 0}
                      onSave={(patch) => { updateAccount(a.id, patch); setEditId(null); }}
                      onCancel={() => setEditId(null)} />
                  ) : (
                    <AccountRow key={a.id} account={a} balance={balances[a.id]} topBorder={i > 0}
                      onEdit={() => setEditId(a.id)} onDelete={() => deleteAccount(a.id)} />
                  )
                ))}
              </Card>
            )
          )}

          {unassigned > 0 && (
            <div style={{ fontSize: 13, color: T.mute, padding: "0 2px" }}>
              {unassigned} {unassigned === 1 ? "entry is" : "entries are"} not assigned to an
              account, so they count in your monthly totals but not in the balances above.
              Edit them on the Transactions tab to attach one.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AccountRow({ account, balance, topBorder, onEdit, onDelete }) {
  const t = typeOf(account.type);
  const shown = t.liability ? Math.abs(balance) : balance;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "11px 2px",
      borderTop: topBorder ? `1px solid ${T.line}` : "none", fontSize: 14,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{account.name}</div>
        <div style={{ fontSize: 12, color: T.mute }}>{t.label}</div>
      </div>
      <span style={{
        ...numeral(16), minWidth: 90, textAlign: "right",
        color: t.liability ? (balance < 0 ? T.neg : T.ink) : (balance < 0 ? T.neg : T.ink),
      }}>
        {(!t.liability && balance < 0 ? "−" : "") + fmt(Math.abs(shown))}
      </span>
      <button onClick={onEdit} aria-label={`Edit ${account.name}`}
        style={{ ...btn("transparent", T.mute), padding: "4px 6px", fontSize: 14 }}>✎</button>
      <button
        onClick={() => {
          if (window.confirm(
            `Remove ${account.name}? Its transactions stay in your ledger but stop counting towards any balance.`
          )) onDelete();
        }}
        aria-label={`Delete ${account.name}`}
        style={{ ...btn("transparent", T.mute), padding: "4px 8px", fontSize: 16 }}>×</button>
    </div>
  );
}

function AccountForm({ account, topBorder, onSave, onCancel }) {
  const [name, setName] = useState(account?.name || "");
  const [type, setType] = useState(account?.type || "checking");
  const [balance, setBalance] = useState(
    account ? String(Math.abs(account.startingBalance ?? 0)) : ""
  );
  const [err, setErr] = useState("");
  const liability = typeOf(type).liability;

  const save = () => {
    if (!name.trim()) { setErr("Give the account a name."); return; }
    const raw = parseFloat(balance);
    if (balance !== "" && isNaN(raw)) { setErr("That balance isn't a number."); return; }
    const magnitude = Math.abs(raw || 0);
    onSave({
      ...(account ? {} : { id: uid(), createdAt: todayStr() }),
      name: name.trim(), type,
      // Liabilities are stored negative so net worth is a plain sum
      startingBalance: liability ? -magnitude : magnitude,
    });
  };

  return (
    <div style={{
      display: "grid", gap: 10, marginTop: topBorder === undefined ? 14 : 0,
      padding: topBorder ? "12px 2px" : 0,
      borderTop: topBorder ? `1px solid ${T.line}` : "none",
    }}>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <label style={{ fontSize: 12, color: T.mute }}>Account name
          <input value={name} placeholder="e.g. Checking"
            onChange={(e) => { setName(e.target.value); setErr(""); }}
            style={{ ...inputStyle, marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12, color: T.mute }}>Type
          <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...inputStyle, marginTop: 4 }}>
            {ACCOUNT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12, color: T.mute }}>
          {liability ? "Amount owed now" : "Balance now"}
          <input type="number" step="0.01" value={balance} placeholder="0.00"
            onChange={(e) => { setBalance(e.target.value); setErr(""); }}
            style={{ ...inputStyle, marginTop: 4 }} />
        </label>
      </div>
      <div style={{ fontSize: 12, color: T.mute }}>
        {liability
          ? "Enter what you currently owe as a positive number — CASH counts it against your net worth."
          : "Whatever the account holds today. Entries you add from now on adjust it."}
      </div>
      {err && <div style={{ color: T.neg, fontSize: 13 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save} style={btn(T.brass)}>{account ? "Save" : "Add account"}</button>
        <button onClick={onCancel} style={{ ...ghostBtn, color: T.mute }}>Cancel</button>
      </div>
    </div>
  );
}

function TransferForm({ accounts, balances, onSave, onCancel }) {
  const [from, setFrom] = useState(accounts[0]?.id || "");
  const [to, setTo] = useState(accounts[1]?.id || "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const save = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setErr("Enter an amount greater than zero."); return; }
    if (from === to) { setErr("Pick two different accounts."); return; }
    onSave({ id: uid(), type: "transfer", amount: amt, accountId: from, toAccountId: to, date, note: note.trim() });
  };

  return (
    <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        <label style={{ fontSize: 12, color: T.mute }}>From
          <select value={from} onChange={(e) => { setFrom(e.target.value); setErr(""); }} style={{ ...inputStyle, marginTop: 4 }}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({fmt(balances[a.id])})</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12, color: T.mute }}>To
          <select value={to} onChange={(e) => { setTo(e.target.value); setErr(""); }} style={{ ...inputStyle, marginTop: 4 }}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({fmt(balances[a.id])})</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12, color: T.mute }}>Amount
          <input type="number" min="0" step="0.01" value={amount} placeholder="0.00"
            onChange={(e) => { setAmount(e.target.value); setErr(""); }} style={{ ...inputStyle, marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12, color: T.mute }}>Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} />
        </label>
      </div>
      <input value={note} placeholder="Note (optional) — e.g. credit card payment"
        onChange={(e) => setNote(e.target.value)} style={inputStyle} />
      <div style={{ fontSize: 12, color: T.mute }}>
        A transfer moves money between your own accounts. It is not income or spending,
        so it stays out of your monthly totals and category budgets.
      </div>
      {err && <div style={{ color: T.neg, fontSize: 13 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save} style={btn(T.brass)}>Record transfer</button>
        <button onClick={onCancel} style={{ ...ghostBtn, color: T.mute }}>Cancel</button>
      </div>
    </div>
  );
}
