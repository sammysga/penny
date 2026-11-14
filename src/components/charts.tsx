import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { pesoShort, peso } from '../lib/money';
import { monthLabel } from '../lib/date';

/** Chart colors come from CSS tokens so light/dark each use their validated palette. */
export function useChartColors() {
  const read = () => {
    const cs = getComputedStyle(document.documentElement);
    const g = (n: string) => cs.getPropertyValue(n).trim();
    return { c1: g('--chart-1'), c2: g('--chart-2'), c3: g('--chart-3'), bar: g('--chart-bar'), grid: g('--chart-grid'), muted: `rgb(${g('--muted')})`, ink: `rgb(${g('--ink')})`, danger: `rgb(${g('--danger')})` };
  };
  const [c, setC] = useState(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setC(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return c;
}

const axis = (color: string) => ({ tick: { fill: color, fontSize: 11.5 }, axisLine: false, tickLine: false });

function Tip({ active, payload, label, fmtLabel }: { active?: boolean; payload?: { name: string; value: number; color: string; dataKey: string }[]; label?: string; fmtLabel?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] shadow-lg">
      <div className="mb-1 font-semibold">{fmtLabel ? fmtLabel(String(label)) : label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          {payload.length > 1 && <span className="h-0.5 w-3 rounded" style={{ background: p.color }} />}
          <span className="text-muted">{p.name}</span>
          <span className="num ml-auto pl-3 font-semibold">{peso(Math.round(p.value * 100), { compact: true })}</span>
        </div>
      ))}
    </div>
  );
}

/** Daily spending this month — one series, so no legend; the card title names it. */
export function DailySpendChart({ data, perDay }: { data: { day: string; value: number }[]; perDay?: number }) {
  const c = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="day" {...axis(c.muted)} interval="preserveStartEnd" minTickGap={14} />
        <YAxis {...axis(c.muted)} tickFormatter={(v) => pesoShort(v * 100)} width={52} />
        <Tooltip cursor={{ fill: c.grid, opacity: 0.5 }} content={<Tip fmtLabel={(l) => `Day ${l}`} />} />
        {perDay ? <ReferenceLine y={perDay} stroke={c.c2} strokeDasharray="4 4" label={{ value: 'daily pace', fill: c.muted, fontSize: 11, position: 'insideTopLeft' }} /> : null}
        <Bar dataKey="value" name="Spent" fill={c.bar} radius={[4, 4, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Three savings scenarios: color + dash pattern + direct labels, so identity never relies on color alone. */
export function ProjectionChart({ data, goal1, goal2 }: { data: Record<string, number | string>[]; goal1: number; goal2: number }) {
  const c = useChartColors();
  const series = [
    { key: 'stretch', name: 'Stretch', color: c.c1, dash: undefined },
    { key: 'standard', name: 'Standard', color: c.c2, dash: '6 4' },
    { key: 'conservative', name: 'Conservative', color: c.c3, dash: '2 4' },
  ];
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4 text-[12.5px] text-muted" aria-hidden>
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} /></svg>{s.name}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 10, right: 12, left: -6, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="month" {...axis(c.muted)} tickFormatter={(m) => monthLabel(m, true)} minTickGap={36} />
          <YAxis {...axis(c.muted)} tickFormatter={(v) => pesoShort(v * 100)} width={56} domain={[0, Math.ceil((goal2 * 1.1) / 100 / 50_000) * 50_000]} allowDataOverflow={false} />
          <Tooltip content={<Tip fmtLabel={(m) => monthLabel(m)} />} />
          <ReferenceLine y={goal1 / 100} stroke={c.muted} strokeDasharray="3 3" label={{ value: pesoShort(goal1), fill: c.muted, fontSize: 11, position: 'insideTopLeft' }} />
          <ReferenceLine y={goal2 / 100} stroke={c.muted} strokeDasharray="3 3" label={{ value: pesoShort(goal2), fill: c.muted, fontSize: 11, position: 'insideTopLeft' }} />
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} dot={false} connectNulls={false} animationDuration={600} activeDot={{ r: 4, strokeWidth: 2, stroke: 'rgb(var(--surface))' }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Spending by category — magnitude, one hue; over-budget categories get the danger tone + a text label in the table view. */
export function CategoryBars({ data }: { data: { name: string; value: number; over?: boolean }[] }) {
  const c = useChartColors();
  const h = Math.max(120, data.length * 34);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap={8}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" {...axis(c.muted)} width={150} />
        <Tooltip cursor={{ fill: c.grid, opacity: 0.5 }} content={<Tip />} />
        <Bar dataKey="value" name="Spent" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {data.map((d, i) => <Cell key={i} fill={d.over ? c.danger : c.bar} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyBars({ data, name }: { data: { month: string; value: number }[]; name: string }) {
  const c = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="month" {...axis(c.muted)} tickFormatter={(m) => monthLabel(m, true).slice(0, 3)} />
        <YAxis {...axis(c.muted)} tickFormatter={(v) => pesoShort(v * 100)} width={52} />
        <Tooltip cursor={{ fill: c.grid, opacity: 0.5 }} content={<Tip fmtLabel={(m) => monthLabel(m)} />} />
        <Bar dataKey="value" name={name} fill={c.bar} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
