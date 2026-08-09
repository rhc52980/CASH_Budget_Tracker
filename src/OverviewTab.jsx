import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line, ReferenceLine,
} from "recharts";
import { T } from "./theme.js";
import { useApp } from "./ctx.js";
import { fmt, kFmt } from "./utils.js";
import { Card, SectionTitle, Empty, pill, tooltipStyle } from "./ui.jsx";
import { TxList } from "./TransactionsTab.jsx";

export function Overview({
  spentByCat, trendRows, trendCats, trendKind, setTrendKind,
  trendRange, setTrendRange, monthTx, expenses, insights,
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
    <div style={{ display: "grid", gap: 14, marginTop: 14, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
      <Card>
        <SectionTitle>Where the money went</SectionTitle>
        {pieData.length === 0 ? (
          <Empty text="No spending recorded this month yet. Add an expense to see the breakdown." />
        ) : (
          <>
            <div style={{ height: 210 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={85}
                    paddingAngle={2} cornerRadius={3} stroke={C.card} strokeWidth={2}>
                    {pieData.map((d) => <Cell key={d.name} fill={catColor(d.name)} />)}
                  </Pie>
                  <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle"
                    style={{ fontFamily: T.serif, fontSize: 21, fill: C.ink }}>{fmt(expenses)}</text>
                  <text x="50%" y="46%" dy={20} textAnchor="middle" dominantBaseline="middle"
                    style={{ fontFamily: T.sans, fontSize: 10, letterSpacing: "0.16em", fill: C.mute }}>SPENT</text>
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
        <Card style={{ gridColumn: "1 / -1", background: T.cardTint }}>
          <SectionTitle>Ledger notes</SectionTitle>
          <div style={{ display: "grid", gap: 8 }}>
            {insights.map((line) => (
              <div key={line} style={{ display: "flex", gap: 9, fontSize: 14, alignItems: "baseline" }}>
                <span aria-hidden style={{ color: T.brass, fontSize: 12, flexShrink: 0 }}>✦</span>
                <span>{line}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card style={{ gridColumn: "1 / -1" }}>
        <SectionTitle>Recent entries</SectionTitle>
        {recent.length === 0
          ? <Empty text="Nothing recorded this month. Use “+ Add entry” to write your first line." />
          : <TxList list={recent} />}
      </Card>
    </div>
  );
}
