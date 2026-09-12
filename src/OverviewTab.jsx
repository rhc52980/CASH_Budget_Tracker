import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line, ReferenceLine,
} from "recharts";
import { T } from "./theme.js";
import { useApp } from "./ctx.js";
import { fmt, kFmt } from "./utils.js";
import { Card, SectionTitle, Empty, pill, tooltipStyle, numeral, ghostBtn } from "./ui.jsx";
import { TxList } from "./TransactionsTab.jsx";

const shortDate = (d) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// The two things worth checking daily — what is left to budget and what is
// about to leave or land — used to sit two taps away on Budgets and Bills.
// Only shown for the current month: "due in 7 days" means nothing in March.
function ThisMonth({ outlook, onGoTo }) {
  const { catColor } = useApp();
  const { overdue, dueSoon, pending, plan, overdueTotal, dueSoonTotal, pendingTotal } = outlook;
  const upcoming = [...overdue, ...dueSoon];
  const nothingSetUp = !plan && upcoming.length === 0 && pending.length === 0;

  const stat = (label, value, color) => (
    <div>
      <div style={{ fontSize: 12, color: T.mute }}>{label}</div>
      <div style={{ ...numeral(22), color: color || T.ink }}>{value}</div>
    </div>
  );
  const go = (tab, label) => (
    <button onClick={() => onGoTo(tab)} style={{ ...ghostBtn, padding: "6px 11px", fontSize: 12.5 }}>{label} ›</button>
  );

  return (
    <Card style={{ gridColumn: "1 / -1" }}>
      <SectionTitle right={<div style={{ display: "flex", gap: 6 }}>{go("bills", "Bills")}{go("budgets", "Budgets")}</div>}>
        This month
      </SectionTitle>
      {nothingSetUp ? (
        <p style={{ margin: 0, fontSize: 13.5, color: T.mute, lineHeight: 1.5 }}>
          Add your bills and income once on the Bills tab, and this will show what is
          due, what is about to land, and what is left to budget.
        </p>
      ) : (
        <>
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            {plan
              ? stat(plan.left >= 0 ? "Left to budget" : "Over-committed by", fmt(Math.abs(plan.left)), plan.left >= 0 ? T.pos : T.neg)
              : stat("Left to budget", "—")}
            {overdue.length > 0
              ? stat("Overdue", `${overdue.length} · ${fmt(overdueTotal)}`, T.neg)
              : stat("Due in 7 days", dueSoon.length ? `${dueSoon.length} · ${fmt(dueSoonTotal)}` : "Nothing")}
            {stat("Paychecks to come", pending.length ? `${pending.length} · ${fmt(pendingTotal)}` : "All in")}
          </div>
          {!plan && (
            <p style={{ margin: "10px 0 0", fontSize: 12.5, color: T.mute }}>
              Add your income on the Bills tab to see what is left to budget.
            </p>
          )}
          {(upcoming.length > 0 || pending.length > 0) && (
            <div style={{ marginTop: 14, borderTop: `1px solid ${T.line}` }}>
              {upcoming.map(({ bill, date }) => {
                const late = date < outlook.today;
                return (
                  <div key={bill.id + date} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 2px", fontSize: 13.5, borderBottom: `1px solid ${T.line}` }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: catColor(bill.category), flexShrink: 0 }} />
                    <span style={{ flex: 1, fontWeight: 550 }}>{bill.name}</span>
                    <span style={{ fontSize: 12.5, color: late ? T.neg : T.mute }}>
                      {late ? `was due ${shortDate(date)}` : `due ${shortDate(date)}`}
                    </span>
                    <span style={{ fontVariantNumeric: "tabular-nums", minWidth: 80, textAlign: "right" }}>{fmt(bill.amount)}</span>
                  </div>
                );
              })}
              {pending.map(({ inc, date }) => {
                const missed = date < outlook.today;
                return (
                  <div key={inc.id + date} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 2px", fontSize: 13.5, borderBottom: `1px solid ${T.line}` }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: T.pos, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontWeight: 550 }}>{inc.name}</span>
                    <span style={{ fontSize: 12.5, color: T.mute }}>
                      {missed ? `${shortDate(date)} — not marked received` : shortDate(date)}
                    </span>
                    <span style={{ fontVariantNumeric: "tabular-nums", minWidth: 80, textAlign: "right", color: T.pos }}>+{fmt(inc.amount)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export function Overview({
  spentByCat, trendRows, trendCats, trendKind, setTrendKind,
  trendRange, setTrendRange, monthTx, expenses, insights, onAddEntry, outlook, onGoTo,
}) {
  const { chart: C, catColor } = useApp();
  const pieData = Object.entries(spentByCat)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const recent = monthTx.slice(0, 6);

  const axes = (
    <>
      <XAxis dataKey="name" tick={{ fontSize: 12, fill: C.mute }} axisLine={false} tickLine={false} />
      <YAxis tick={{ fontSize: 11, fill: C.mute }} axisLine={false} tickLine={false}
        tickFormatter={kFmt} width={48} />
    </>
  );

  return (
    <div style={{
      display: "grid", gap: 14, marginTop: 14,
      // 340px minimum: two cards across the 1000px container, never a stranded third column
      gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
    }}>
      {outlook.isCurrent && <ThisMonth outlook={outlook} onGoTo={onGoTo} />}
      <Card>
        <SectionTitle>Where the money went</SectionTitle>
        {pieData.length === 0 ? (
          <Empty text="No spending recorded this month yet. Add an expense to see the breakdown."
            actionLabel="Add an expense" onAction={onAddEntry} />
        ) : (
          <>
            <div style={{ height: 210 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={85}
                    paddingAngle={2} cornerRadius={3} stroke={C.card} strokeWidth={2}>
                    {pieData.map((d) => <Cell key={d.name} fill={catColor(d.name)} />)}
                  </Pie>
                  <text x="50%" y="45%" textAnchor="middle" dominantBaseline="middle"
                    style={{ fontFamily: T.sans, fontSize: 22, fontWeight: 650, letterSpacing: "-0.03em", fill: C.ink }}>
                    {fmt(expenses)}
                  </text>
                  <text x="50%" y="45%" dy={19} textAnchor="middle" dominantBaseline="middle"
                    style={{ fontFamily: T.sans, fontSize: 11.5, fill: C.mute }}>spent</text>
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {pieData.slice(0, 5).map((d) => (
                <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: catColor(d.name), flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{d.name}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums", color: T.mute }}>
                    {fmt(d.value)} · {expenses ? Math.round((d.value / expenses) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Card>
        <SectionTitle right={
          <div style={{ display: "flex", gap: 4 }}>
            {[3, 6, 12].map((n) => (
              <button key={n} onClick={() => setTrendRange(n)} style={pill(trendRange === n)}>{n}m</button>
            ))}
          </div>
        }>Trends</SectionTitle>
        <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
          {[["flow", "In vs out"], ["net", "Net"], ["cats", "By category"]].map(([id, label]) => (
            <button key={id} onClick={() => setTrendKind(id)} style={pill(trendKind === id)}>{label}</button>
          ))}
        </div>
        <div style={{ height: 205 }}>
          <ResponsiveContainer width="100%" height="100%">
            {trendKind === "net" ? (
              <LineChart data={trendRows}>
                {axes}
                <ReferenceLine y={0} stroke={C.line} />
                <Tooltip formatter={(v) => fmt(v)} contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="Net" stroke={C.netLine} strokeWidth={2}
                  dot={false} activeDot={{ r: 4.5 }} />
              </LineChart>
            ) : trendKind === "cats" ? (
              <BarChart data={trendRows} barGap={2}>
                {axes}
                <Tooltip formatter={(v) => fmt(v)} contentStyle={tooltipStyle}
                  cursor={{ fill: C.cursor }} />
                <Legend wrapperStyle={{ fontSize: 12, fontFamily: T.sans }} iconType="circle" iconSize={9} />
                {trendCats.map((c, i) => (
                  <Bar key={c} dataKey={c} stackId="spend" maxBarSize={30}
                    fill={c === "All else" ? C.rest : catColor(c)}
                    stroke={C.card} strokeWidth={1.5}
                    radius={i === trendCats.length - 1 ? [4, 4, 0, 0] : 0} />
                ))}
              </BarChart>
            ) : (
              <BarChart data={trendRows} barGap={2}>
                {axes}
                <Tooltip formatter={(v) => fmt(v)} contentStyle={tooltipStyle}
                  cursor={{ fill: C.cursor }} />
                <Legend wrapperStyle={{ fontSize: 12, fontFamily: T.sans }} iconType="circle" iconSize={9} />
                <Bar dataKey="In" fill={C.in} radius={[4, 4, 0, 0]} maxBarSize={26} />
                <Bar dataKey="Out" fill={C.out} radius={[4, 4, 0, 0]} maxBarSize={26} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </Card>

      {insights.length > 0 && (
        <Card style={{ gridColumn: "1 / -1" }}>
          <SectionTitle>Insights</SectionTitle>
          <div style={{ display: "grid", gap: 10 }}>
            {insights.map((line) => (
              <div key={line} style={{ display: "flex", gap: 10, fontSize: 14, alignItems: "flex-start", lineHeight: 1.5 }}>
                <span aria-hidden style={{
                  width: 5, height: 5, borderRadius: "50%", background: T.brass,
                  flexShrink: 0, marginTop: 7,
                }} />
                <span>{line}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card style={{ gridColumn: "1 / -1" }}>
        <SectionTitle>Recent entries</SectionTitle>
        {recent.length === 0
          ? <Empty text="Nothing recorded this month yet. Add your first entry to get started."
              actionLabel="Add an entry" onAction={onAddEntry} />
          : <TxList list={recent} />}
      </Card>
    </div>
  );
}
