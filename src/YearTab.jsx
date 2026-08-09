import { useMemo } from "react";
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { T } from "./theme.js";
import { useApp } from "./ctx.js";
import { fmt, kFmt, monthKey, monthLabel } from "./utils.js";
import { Card, SectionTitle, Empty, tooltipStyle, numeral } from "./ui.jsx";

export function YearTab({ transactions, month }) {
  const { chart: C, catColor } = useApp();
  const year = month.slice(0, 4);

  const { rows, totals, catTotals, active, best, worst, biggest } = useMemo(() => {
    const rows = [];
    for (let m = 1; m <= 12; m++) {
      const ym = `${year}-${String(m).padStart(2, "0")}`;
      rows.push({ ym, name: monthLabel(ym).split(" ")[0].slice(0, 3), In: 0, Out: 0, Net: 0 });
    }
    const catTotals = {};
    let biggest = null;
    transactions.forEach((t) => {
      const ym = monthKey(t.date);
      if (!ym.startsWith(year + "-")) return;
      const row = rows[Number(ym.slice(5, 7)) - 1];
      if (t.type === "income") row.In += t.amount;
      else {
        row.Out += t.amount;
        catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
        if (!biggest || t.amount > biggest.amount) biggest = t;
      }
    });
    rows.forEach((r) => { r.Net = r.In - r.Out; });
    const active = rows.filter((r) => r.In > 0 || r.Out > 0);
    const totals = {
      In: rows.reduce((s, r) => s + r.In, 0),
      Out: rows.reduce((s, r) => s + r.Out, 0),
    };
    totals.Net = totals.In - totals.Out;
    const best = active.length ? active.reduce((a, b) => (b.Net > a.Net ? b : a)) : null;
    const worst = active.length ? active.reduce((a, b) => (b.Net < a.Net ? b : a)) : null;
    return { rows, totals, catTotals, active, best, worst, biggest };
  }, [transactions, year]);

  const catList = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  if (active.length === 0) {
    return (
      <div style={{ marginTop: 14 }}>
        <Empty text={`Nothing recorded in ${year} yet. Entries you add will build the year's story here.`} card />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
      <Card>
        <SectionTitle>{year} at a glance</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, textAlign: "center" }}>
          {[
            ["Money in", fmt(totals.In), T.ink],
            ["Money out", fmt(totals.Out), T.ink],
            ["Net", (totals.Net >= 0 ? "+" : "−") + fmt(Math.abs(totals.Net)), totals.Net >= 0 ? T.pos : T.neg],
          ].map(([label, val, color]) => (
            <div key={label} style={{ padding: "6px 4px" }}>
              <div style={{ fontSize: 13, color: T.mute, fontWeight: 500 }}>{label}</div>
              <div style={{ ...numeral(26), marginTop: 5, color }}>{val}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Net by month</SectionTitle>
        <div style={{ height: 210 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} barGap={2}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.mute }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.mute }} axisLine={false} tickLine={false}
                tickFormatter={kFmt} width={52} />
              <ReferenceLine y={0} stroke={C.line} />
              <Tooltip formatter={(v) => fmt(v)} contentStyle={tooltipStyle} cursor={{ fill: C.cursor }} />
              <Bar dataKey="Net" maxBarSize={30} radius={[4, 4, 0, 0]}>
                {rows.map((r) => <Cell key={r.ym} fill={r.Net >= 0 ? C.in : C.out} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <SectionTitle>Where {year} went</SectionTitle>
        <div style={{ display: "grid", gap: 8 }}>
          {catList.map(([cat, total]) => (
            <div key={cat} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: catColor(cat), flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{cat}</span>
              <span style={{ fontSize: 12, color: T.mute, fontVariantNumeric: "tabular-nums" }}>
                {fmt(total / active.length)}/mo avg
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, minWidth: 92, textAlign: "right" }}>
                {fmt(total)} · {totals.Out ? Math.round((total / totals.Out) * 100) : 0}%
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Year notes</SectionTitle>
        <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
          {best && <Note text={`Best month: ${monthLabel(best.ym)} at ${(best.Net >= 0 ? "+" : "−") + fmt(Math.abs(best.Net))} net.`} />}
          {worst && worst !== best && <Note text={`Toughest month: ${monthLabel(worst.ym)} at ${(worst.Net >= 0 ? "+" : "−") + fmt(Math.abs(worst.Net))} net.`} />}
          {biggest && <Note text={`Largest single expense: ${fmt(biggest.amount)} on ${biggest.category}${biggest.note ? ` (${biggest.note})` : ""}.`} />}
          {totals.In > 0 && (
            <Note text={totals.Net >= 0
              ? `You kept ${Math.round((totals.Net / totals.In) * 100)}% of what you earned across ${active.length} recorded ${active.length === 1 ? "month" : "months"}.`
              : `You spent ${Math.abs(Math.round((totals.Net / totals.In) * 100))}% more than you earned across ${active.length} recorded ${active.length === 1 ? "month" : "months"}.`} />
          )}
        </div>
      </Card>
    </div>
  );
}

function Note({ text }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", lineHeight: 1.5 }}>
      <span aria-hidden style={{
        width: 5, height: 5, borderRadius: "50%", background: T.brass,
        flexShrink: 0, marginTop: 7,
      }} />
      <span>{text}</span>
    </div>
  );
}
