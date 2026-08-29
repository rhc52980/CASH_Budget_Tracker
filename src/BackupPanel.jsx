import { useEffect, useState } from "react";
import { T } from "./theme.js";
import { fmt } from "./utils.js";
import { Card, SectionTitle, btn, ghostBtn } from "./ui.jsx";
import { listBackups, restoreBackup, lastExportAt } from "./storage.js";
import { APP_VERSION } from "./version.js";

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

export function BackupPanel({ data, onExport, onImportJson, onImportCsv, onRestore, onClose }) {
  const [snaps, setSnaps] = useState([]);
  const [dir, setDir] = useState(null);

  useEffect(() => {
    listBackups().then((r) => { setSnaps(r.backups); setDir(r.dir); });
  }, []);

  const lastExport = lastExportAt();
  const entryCount = data.transactions.length;
  const stale = !lastExport || Date.now() - lastExport > 30 * DAY;

  const restore = async (b) => {
    if (!window.confirm(
      `Restore the backup from ${ago(b.at)}? It has ${b.count ?? "?"} entries and will replace what is in the app now.`
    )) return;
    const res = await restoreBackup(b.name);
    if (!res.ok) { window.alert(`That backup could not be restored (${res.error}).`); return; }
    onRestore(res.data);
    onClose();
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
            Your ledger is a file inside the CASH folder. App updates never touch it,
            and clearing your browser no longer affects it. Copy the folder, or export
            a file, to take your data elsewhere.
          </p>

          <div style={{ marginTop: 14 }}>
            <Row label="App version" value={`v${APP_VERSION}`} />
            <Row label="Entries saved" value={`${entryCount} · ${data.bills.length} bills · ${data.goals.length} goals`} />
            <Row label="Last exported file"
              value={lastExport ? ago(lastExport) : "never"}
              tone={stale ? T.neg : T.pos} />
            <Row label="Ledger file" value={dir ? dir.replace(/backups$/, "ledger.json") : "…"} />
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

          <div style={{ marginTop: 22 }}>
            <SectionTitle>Automatic backups</SectionTitle>
            <p style={{ margin: "-6px 0 10px", fontSize: 13, color: T.mute, lineHeight: 1.55 }}>
              CASH keeps timestamped copies of the ledger file on disk, up to 30 of
              them. Copy the whole CASH folder and you have taken your data with you.
            </p>
            {snaps.length === 0 ? (
              <div style={{ fontSize: 13, color: T.mute, padding: "8px 0" }}>
                No backups yet — the first is written once you have saved something.
              </div>
            ) : snaps.map((s) => (
              <div key={s.name} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 0",
                borderTop: `1px solid ${T.line}`, fontSize: 13.5,
              }}>
                <span style={{ flex: 1 }}>
                  {ago(s.at)}
                  <span style={{ color: T.mute }}>
                    {" · "}{s.count === null ? `${(s.size / 1024).toFixed(0)} KB` : `${s.count} entries`}
                  </span>
                </span>
                <button onClick={() => restore(s)}
                  style={{ ...ghostBtn, padding: "6px 12px", fontSize: 13 }}>Restore</button>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
