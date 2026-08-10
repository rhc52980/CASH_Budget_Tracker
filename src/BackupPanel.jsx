import { useEffect, useState } from "react";
import { T } from "./theme.js";
import { fmt } from "./utils.js";
import { Card, SectionTitle, btn, ghostBtn } from "./ui.jsx";
import {
  listSnapshots, readSnapshot, storageUsage, lastExportAt, requestPersistence,
} from "./storage.js";

const DAY = 24 * 60 * 60 * 1000;

function ago(ts) {
  const d = Date.now() - ts;
  if (d < 60 * 60 * 1000) return "just now";
  if (d < DAY) return `${Math.floor(d / (60 * 60 * 1000))}h ago`;
  const days = Math.floor(d / DAY);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

function Row({ label, value, tone }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      gap: 12, padding: "9px 0", borderTop: `1px solid ${T.line}`, fontSize: 13.5,
    }}>
      <span style={{ color: T.mute }}>{label}</span>
      <span style={{ color: tone || T.ink, fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}

export function BackupPanel({ data, onExport, onImportJson, onImportCsv, onRestore, persistence, onClose }) {
  const [snaps, setSnaps] = useState([]);
  const [usage, setUsage] = useState(null);
  const [persist, setPersist] = useState(persistence);

  useEffect(() => {
    setSnaps(listSnapshots());
    storageUsage().then(setUsage);
  }, []);

  const lastExport = lastExportAt();
  const entryCount = data.transactions.length;
  const stale = !lastExport || Date.now() - lastExport > 30 * DAY;

  const restore = (key) => {
    const snap = readSnapshot(key);
    if (!snap) { window.alert("That snapshot could not be read."); return; }
    const when = ago(Number(key.replace("cash-snap-", "")));
    if (window.confirm(
      `Restore the snapshot from ${when}? It has ${snap.transactions.length} entries and will replace what's in the app now.`
    )) {
      onRestore(snap);
      onClose();
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "var(--overlay)", zIndex: 50,
      display: "grid", placeItems: "center", padding: 16,
    }} onClick={onClose}>
      <Card style={{ width: "min(560px, 100%)", maxHeight: "88vh", overflowY: "auto" }}>
        <div onClick={(e) => e.stopPropagation()}>
          <SectionTitle right={
            <button onClick={onClose} aria-label="Close"
              style={{ ...btn("transparent", T.mute), padding: "4px 8px", fontSize: 18 }}>×</button>
          }>Backup &amp; data</SectionTitle>

          <p style={{ margin: "0 0 4px", fontSize: 13.5, color: T.mute, lineHeight: 1.55 }}>
            Your ledger is stored in this browser. App updates never touch it — but
            clearing browsing data does, and other devices have their own copy.
            An exported file is the only backup that outlives this browser.
          </p>

          <div style={{ marginTop: 14 }}>
            <Row label="Entries saved" value={`${entryCount} · ${data.bills.length} bills · ${data.goals.length} goals`} />
            <Row label="Last exported file"
              value={lastExport ? ago(lastExport) : "never"}
              tone={stale ? T.neg : T.pos} />
            <Row label="Eviction protection"
              value={
                persist === "persisted" ? "On — browser won't evict"
                  : persist === "best-effort" ? "Best effort (browser declined)"
                  : "Not supported here"
              }
              tone={persist === "persisted" ? T.pos : T.mute} />
            {usage && (
              <Row label="Space used"
                value={`${(usage.usage / 1024).toFixed(0)} KB of ${(usage.quota / 1024 / 1024).toFixed(0)} MB`} />
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
            <button onClick={onExport} style={btn(T.brass)}>Export backup file</button>
            <label style={{ ...ghostBtn, display: "inline-block" }}>
              Restore from file
              <input type="file" accept=".json,application/json" style={{ display: "none" }}
                onChange={(e) => { if (e.target.files[0]) onImportJson(e.target.files[0]); e.target.value = ""; }} />
            </label>
            <label style={{ ...ghostBtn, display: "inline-block" }}>
              Import bank CSV
              <input type="file" accept=".csv,text/csv" style={{ display: "none" }}
                onChange={(e) => { if (e.target.files[0]) onImportCsv(e.target.files[0]); e.target.value = ""; }} />
            </label>
          </div>

          {persist !== "persisted" && (
            <button
              onClick={() => requestPersistence().then(setPersist)}
              style={{ ...ghostBtn, marginTop: 10, fontSize: 13, padding: "8px 12px" }}>
              Ask the browser to protect this data
            </button>
          )}

          <div style={{ marginTop: 22 }}>
            <SectionTitle>Automatic snapshots</SectionTitle>
            <p style={{ margin: "-6px 0 10px", fontSize: 13, color: T.mute, lineHeight: 1.55 }}>
              CASH quietly keeps its last few known-good copies in this browser, so a
              bad edit is recoverable. These live alongside your ledger — they're a
              safety net, not a substitute for an exported file.
            </p>
            {snaps.length === 0 ? (
              <div style={{ fontSize: 13, color: T.mute, padding: "8px 0" }}>
                No snapshots yet — the first is taken next time you open the app.
              </div>
            ) : snaps.map((s) => (
              <div key={s.key} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 0",
                borderTop: `1px solid ${T.line}`, fontSize: 13.5,
              }}>
                <span style={{ flex: 1 }}>
                  {ago(s.at)}
                  <span style={{ color: T.mute }}>
                    {" · "}{s.count === null ? `${(s.size / 1024).toFixed(0)} KB` : `${s.count} entries`}
                  </span>
                </span>
                <button onClick={() => restore(s.key)}
                  style={{ ...ghostBtn, padding: "6px 12px", fontSize: 13 }}>Restore</button>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
