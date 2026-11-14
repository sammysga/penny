import { useState } from 'react';
import { useStore } from '../lib/store';
import { Badge, Button, Card, Money, PageHeader, Progress } from '../components/ui';
import { Icon } from '../components/Icon';
import { CategoryBars } from '../components/charts';
import { accountByRole, availableToSpend, budgetRows, contributionsByMonth, grossSpending, incomeForMonth, live, netWorthAt } from '../lib/ledger';
import { addMonths, daysInMonth, monthLabel, thisMonth } from '../lib/date';
import { peso } from '../lib/money';
import { monthInsights } from '../lib/insights';
import { mainSavings } from '../lib/projections';
import { ACHIEVEMENTS } from '../lib/achievements';

export default function Review() {
  const { state } = useStore();
  const [month, setMonth] = useState(thisMonth());
  const end = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
  const prevEnd = `${addMonths(month, -1)}-${String(daysInMonth(addMonths(month, -1))).padStart(2, '0')}`;
  const nwStart = state.createdAt.slice(0, 7) > addMonths(month, -1) ? null : netWorthAt(state, prevEnd);
  const nwEnd = netWorthAt(state, end);
  const income = incomeForMonth(state, month);
  const spent = grossSpending(state, month);
  const contrib = (role: Parameters<typeof accountByRole>[1]) => { const a = accountByRole(state, role); return a ? contributionsByMonth(state, a.id)[month] ?? 0 : 0; };
  const rows = budgetRows(state, month).sort((a, b) => b.spent - a.spent);
  const budgeted = rows.filter((r) => r.budget > 0);
  const within = budgeted.filter((r) => r.spent <= r.budget).length;
  const avail = availableToSpend(state, month);
  const ach = ACHIEVEMENTS.filter((a) => state.achievements[a.id]?.startsWith(month));
  const rewardsAdded = state.earmarks.filter((e) => e.month === month && e.target === 'reward_fund').reduce((a, e) => a + e.amount, 0);
  const redeemed = live(state).filter((t) => t.rewardId && t.datetime.startsWith(month));
  const family = live(state).filter((t) => t.kind === 'expense' && t.categoryId === 'family' && t.datetime.startsWith(month)).reduce((a, t) => a + t.amount, 0);
  const insights = monthInsights(state, month);
  const s = state.settings;
  const saved = mainSavings(state);

  return (
    <div className="space-y-5">
      <PageHeader title="Monthly Review" subtitle="A calm look back — what happened, and what it means."
        actions={<div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}><Icon name="ChevronLeft" size={17} /></Button>
          <span className="min-w-[130px] text-center text-[14px] font-semibold">{monthLabel(month)}</span>
          <Button variant="ghost" size="sm" aria-label="Next month" disabled={month >= thisMonth()} onClick={() => setMonth(addMonths(month, 1))}><Icon name="ChevronRight" size={17} /></Button>
        </div>} />

      <section className="card overflow-hidden p-6 sm:p-8">
        <div className="text-[13px] font-medium text-muted">{month === thisMonth() ? 'So far this month' : 'Your month in review'}</div>
        <h2 className="serif mt-1 text-[28px] leading-tight sm:text-[34px]">{monthLabel(month)}</h2>
        <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
          <div><div className="text-[12.5px] text-muted">Income received</div><Money value={income} className="text-[19px] font-semibold" /></div>
          <div><div className="text-[12.5px] text-muted">Total spending</div><Money value={spent} className="text-[19px] font-semibold" /></div>
          <div><div className="text-[12.5px] text-muted">Main savings added</div><Money value={contrib('main_savings')} className="text-[19px] font-semibold" /></div>
          <div><div className="text-[12.5px] text-muted">Net worth change</div>{nwStart === null ? <div className="text-[14px] text-muted">First month in Penny</div> : <Money value={nwEnd - nwStart} sign className={`text-[19px] font-semibold ${nwEnd - nwStart < 0 ? 'text-danger' : 'text-good'}`} />}</div>
        </div>
        {insights.length > 0 && (
          <ul className="mt-6 space-y-2 border-t border-line pt-5">
            {insights.map((i) => <li key={i} className="flex gap-2.5 text-[14.5px]"><Icon name="Sparkles" size={16} className="mt-0.5 shrink-0 text-gold" />{i}</li>)}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Where your savings went">
          <ul className="space-y-2.5 text-[14px]">
            {[['Main savings', 'main_savings'], ['Emergency fund', 'emergency'], ['Travel savings', 'travel'], ['Investment fund', 'investment_cash']].map(([l, r]) => (
              <li key={r} className="flex justify-between"><span className="text-muted">{l}</span><Money value={contrib(r as never)} className="font-semibold" /></li>
            ))}
            {family > 0 && <li className="flex justify-between border-t border-line pt-2.5"><span className="text-muted">Family & obligations</span><Money value={family} /></li>}
          </ul>
        </Card>
        <Card title="Budget adherence">
          {budgeted.length === 0 ? <p className="text-[13.5px] text-muted">No budget for this month.</p> : <>
            <div className="serif text-[30px]">{within}<span className="text-[18px] text-muted"> / {budgeted.length}</span></div>
            <div className="text-[13px] text-muted">categories within budget</div>
            {avail && <><Progress value={(avail.spent / Math.max(1, avail.budget)) * 100} tone={avail.remaining < 0 ? 'danger' : 'accent'} className="mt-3" label="Spending plan used" />
              <p className="mt-2 text-[12.5px] text-muted">{peso(avail.spent)} of {peso(avail.budget)} spending plan used</p></>}
          </>}
        </Card>
        <Card title="Goal progress">
          <div className="text-[13px] text-muted">Main savings today</div>
          <Money value={saved} serif className="text-[26px]" />
          <Progress value={(saved / s.goal1) * 100} className="mt-3" label="Toward first milestone" />
          <div className="mt-1 flex justify-between text-[12px] text-muted"><span>{Math.round((saved / s.goal1) * 100)}% of {peso(s.goal1, { compact: true })}</span><span>{Math.round((saved / s.goal2) * 100)}% of {peso(s.goal2, { compact: true })}</span></div>
        </Card>
      </div>

      <Card title="Spending by category" subtitle="Net of refunds and money already set aside.">
        {rows.filter((r) => r.spent > 0).length === 0 ? <p className="text-[13.5px] text-muted">No spending logged for {monthLabel(month)}.</p> : <>
          <CategoryBars data={rows.filter((r) => r.spent > 0).map((r) => ({ name: state.categories.find((c) => c.id === r.categoryId)?.name ?? r.categoryId, value: r.spent / 100, over: r.budget > 0 && r.spent > r.budget }))} />
          <details className="mt-3 text-[13px]">
            <summary className="cursor-pointer font-semibold text-muted">Table view</summary>
            <table className="mt-2 w-full"><thead><tr className="text-left text-muted"><th className="py-1 font-medium">Category</th><th className="text-right font-medium">Spent</th><th className="text-right font-medium">Budget</th><th className="text-right font-medium">Status</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.categoryId} className="border-t border-line/60"><td className="py-1.5">{state.categories.find((c) => c.id === r.categoryId)?.name}</td><td className="num text-right">{peso(r.spent)}</td><td className="num text-right">{r.budget ? peso(r.budget) : '—'}</td><td className="text-right">{r.budget ? (r.spent > r.budget ? <Badge tone="danger">Over</Badge> : <Badge tone="good">Within</Badge>) : '—'}</td></tr>)}</tbody></table>
          </details>
        </>}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Achievements unlocked">
          {ach.length === 0 ? <p className="text-[13.5px] text-muted">None this month — every logged expense counts toward the next one.</p> : <ul className="space-y-2">{ach.map((a) => <li key={a.id} className="flex items-center gap-2 text-[14px]"><Icon name="Award" size={16} className="text-gold" />{a.title}</li>)}</ul>}
        </Card>
        <Card title="Rewards">
          <div className="flex justify-between text-[14px]"><span className="text-muted">Added to Rewards Wallet</span><Money value={rewardsAdded} /></div>
          <div className="mt-2 flex justify-between text-[14px]"><span className="text-muted">Redeemed</span><span>{redeemed.length ? redeemed.map((r) => r.merchant).join(', ') : '—'}</span></div>
        </Card>
      </div>
    </div>
  );
}
