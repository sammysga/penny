import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { Badge, Button, Card, Money, MoneyInput, Progress, Ring, cx } from '../components/ui';
import { Icon } from '../components/Icon';
import { BudgetLine, TxnRow } from '../components/bits';
import { DailySpendChart } from '../components/charts';
import { accountBalance, availableToSpend, budgetRows, live, planForMonth, salaryForMonth, savingsStreak, totals, trackingStreak, wishSaved, rewardFundBalance } from '../lib/ledger';
import { dateLabel, daysInMonth, greeting, monthLabel, relativeDay, thisMonth, today } from '../lib/date';
import { mainSavings, reachMonth } from '../lib/projections';
import { upcoming } from '../lib/alerts';
import { todayInsight } from '../lib/insights';
import { peso, type Cents } from '../lib/money';
import { reconcile } from '../lib/actions';
import { ACHIEVEMENTS } from '../lib/achievements';

export function ConfirmBalances() {
  const { state, commit } = useStore();
  const pending = state.accounts.filter((a) => a.status === 'active' && !a.balanceConfirmed);
  const [vals, setVals] = useState<Record<string, Cents | null>>({});
  if (!pending.length) return null;
  return (
    <Card className="border-gold/50 bg-gradient-to-br from-surface to-beige/40" title="Let's set your starting point"
      subtitle="Enter what's in these accounts right now. Protected savings (BPI Passbook) is already set at ₱50,000 and kept separate.">
      <div className="space-y-3">
        {pending.map((a) => (
          <form key={a.id} className="flex flex-wrap items-end gap-2" onSubmit={(e) => {
            e.preventDefault();
            const v = vals[a.id];
            if (v === null || v === undefined) return;
            commit(`${a.name} balance confirmed`, (d) => reconcile(d, a.id, v));
          }}>
            <div className="min-w-[180px] flex-1">
              <label className="label" htmlFor={`cb-${a.id}`}>{a.name} <span className="font-normal">· {a.purpose}</span></label>
              <MoneyInput id={`cb-${a.id}`} value={vals[a.id] ?? null} onChange={(v) => setVals((x) => ({ ...x, [a.id]: v }))} />
            </div>
            <Button type="submit" disabled={vals[a.id] === null || vals[a.id] === undefined}>Confirm</Button>
          </form>
        ))}
      </div>
    </Card>
  );
}

export function PaydayCard() {
  const { state, go } = useStore();
  const m = thisMonth();
  const pd = state.paydays.find((p) => p.month === m);
  const salary = salaryForMonth(state, m);
  const day = Number(today().slice(8, 10));
  if (!pd && (salary || day < state.settings.payDay - 5)) return null;
  if (pd?.completedAt) {
    return (
      <Card className="flex items-center gap-4 !py-4">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-good/10 text-good"><Icon name="CheckCircle2" size={20} /></div>
        <div className="flex-1 text-[14px]"><b>{monthLabel(m)} payday organized.</b> <span className="text-muted">Every peso has a purpose this month.</span></div>
        <Button variant="ghost" size="sm" onClick={() => go('payday')}>View</Button>
      </Card>
    );
  }
  if (!pd) {
    const plan = planForMonth(state, m);
    return (
      <section className="relative overflow-hidden rounded-2xl bg-forest p-6 text-[#F8F7F3] shadow-soft dark:bg-[#244B3C] animate-rise">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full border border-gold/40" aria-hidden />
        <div className="relative">
          <div className="text-[13px] font-medium text-[#F8F7F3]/70">Payday {day <= state.settings.payDay ? `is on or before the ${state.settings.payDay}th` : 'check'}</div>
          <h2 className="serif mt-1 text-[24px] leading-tight">Has your salary arrived?</h2>
          <p className="mt-1 max-w-md text-[14px] text-[#F8F7F3]/80">
            {plan ? 'Confirm the actual amount and Penny will build this month\'s checklist.' : `There's no ${monthLabel(m)} budget yet — Penny will help you set one up first.`}
          </p>
          <button onClick={() => go('payday')} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#F8F7F3] px-4 text-[14px] font-semibold text-[#244B3C] hover:bg-white">
            Confirm salary <Icon name="ChevronRight" size={16} />
          </button>
        </div>
      </section>
    );
  }
  const total = pd.items.reduce((a, i) => a + i.amount, 0);
  const done = pd.items.filter((i) => i.done);
  const doneAmt = done.reduce((a, i) => a + i.amount, 0);
  const transfers = pd.items.filter((i) => i.kind === 'transfer');
  const pct = pd.items.length ? (done.length / pd.items.length) * 100 : 0;
  return (
    <section className="relative overflow-hidden rounded-2xl bg-forest p-6 text-[#F8F7F3] shadow-soft dark:bg-[#244B3C] animate-rise">
      <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full border border-gold/40" aria-hidden />
      <div className="relative">
        <h2 className="serif text-[22px] leading-snug sm:text-[24px]">It's payday. Let's give every peso a purpose.</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ['Salary received', peso(salary?.amount ?? 0)],
            ['Allocated', peso(doneAmt)],
            ['Remaining to assign', peso((salary?.amount ?? 0) - total + (total - doneAmt))],
            ['Transfers', `${transfers.filter((t) => t.done).length} done · ${transfers.filter((t) => !t.done).length} pending`],
          ].map(([l, v]) => (
            <div key={l}><div className="text-[12px] text-[#F8F7F3]/65">{l}</div><div className="num mt-0.5 text-[15.5px] font-semibold">{v}</div></div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Payday progress">
            <div className="h-full rounded-full bg-gold transition-[width] duration-700" style={{ width: `${pct}%` }} />
          </div>
          <span className="num text-[13px] font-semibold">{Math.round(pct)}%</span>
        </div>
        <button onClick={() => go('payday')} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#F8F7F3] px-4 text-[14px] font-semibold text-[#244B3C] hover:bg-white">
          Continue checklist <Icon name="ChevronRight" size={16} />
        </button>
      </div>
    </section>
  );
}

export default function Dashboard() {
  const { state, go, openAdd } = useStore();
  const m = thisMonth();
  const t = totals(state);
  const avail = availableToSpend(state);
  const rows = budgetRows(state, m).sort((a, b) => b.pct - a.pct);
  const saved = mainSavings(state);
  const g1 = state.settings.goal1, g2 = state.settings.goal2;
  const nextGoal = saved < g1 ? g1 : g2;
  const reach = reachMonth(state, nextGoal, state.settings.monthlyContribution);
  const ups = upcoming(state, 14);
  const insight = todayInsight(state);
  const streak = trackingStreak(state);
  const sStreak = savingsStreak(state);
  const recent = live(state).filter((x) => x.source !== 'payday' || x.kind === 'income').sort((a, b) => b.datetime.localeCompare(a.datetime)).slice(0, 5);

  const daily = useMemo(() => {
    const n = daysInMonth(m);
    const arr = Array.from({ length: n }, (_, i) => ({ day: String(i + 1), value: 0 }));
    const spending = new Set(state.categories.filter((c) => c.countsAsSpending).map((c) => c.id));
    for (const x of live(state)) if (x.kind === 'expense' && x.datetime.startsWith(m) && spending.has(x.categoryId ?? '')) arr[Number(x.datetime.slice(8, 10)) - 1].value += x.amount / 100;
    return arr.slice(0, Number(today().slice(8, 10)));
  }, [state, m]);

  const unlocked = ACHIEVEMENTS.filter((a) => state.achievements[a.id]).sort((a, b) => state.achievements[b.id].localeCompare(state.achievements[a.id]));
  const wishes = state.wishlist.filter((w) => w.status === 'wishing' || w.status === 'saving').slice(0, 3);

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[13.5px] text-muted">{dateLabel(today(), { weekday: true, year: true })}</p>
          <h1 className="serif mt-0.5 text-[28px] font-medium leading-tight sm:text-[34px]">{greeting()}, {state.settings.name}.</h1>
          {insight && <p className="mt-1 text-[14.5px] text-muted">{insight}</p>}
        </div>
        <div className="flex gap-2">
          {streak > 0 && <Badge tone="gold"><Icon name="Flame" size={12} /> {streak}-day tracking streak</Badge>}
          {sStreak > 0 && <Badge tone="accent"><Icon name="PiggyBank" size={12} /> {sStreak}-month savings streak</Badge>}
        </div>
      </div>

      <ConfirmBalances />
      <PaydayCard />

      {/* Row 1 */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card as="div" className="!p-5">
          <div className="flex items-center justify-between text-[13px] font-medium text-muted">Net worth <Icon name="Scale" size={16} /></div>
          <Money value={t.netWorth} serif className="mt-2 block text-[28px] font-medium" />
          <div className="mt-2 space-y-0.5 text-[12.5px] text-muted">
            <div className="flex justify-between"><span>Cash & savings</span><span className="num">{peso(t.cash)}</span></div>
            {t.investments > 0 && <div className="flex justify-between"><span>Investments</span><span className="num">{peso(t.investments)}</span></div>}
            <div className="flex justify-between"><span>Card balances</span><span className="num">{t.liabilities ? `−${peso(t.liabilities)}` : peso(0)}</span></div>
            {t.pendingIncome > 0 && <div className="flex justify-between text-faint"><span>Pending income (not counted)</span><span className="num">{peso(t.pendingIncome, { compact: true })}</span></div>}
          </div>
        </Card>

        <Card as="div" className="!p-5">
          <div className="flex items-center justify-between text-[13px] font-medium text-muted">Available to spend this month <Icon name="Wallet" size={16} /></div>
          {avail ? (
            <>
              <Money value={Math.max(0, avail.remaining)} serif className="mt-2 block text-[28px] font-medium" />
              <Progress value={(avail.spent / Math.max(1, avail.budget)) * 100} tone={avail.remaining < 0 ? 'danger' : avail.spent / avail.budget > 0.8 ? 'warn' : 'accent'} className="mt-3" label="Monthly spending used" />
              <p className="mt-2 text-[12.5px] text-muted">
                {avail.remaining > 0 ? <>≈ <b className="text-ink num">{peso(avail.perDay, { compact: true })}</b> a day · {avail.daysLeft} days left</> : avail.remaining < 0 ? <span className="text-danger">{peso(-avail.remaining)} over plan</span> : 'Fully used'}
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-[14px] text-muted">No spending plan for {monthLabel(m)} yet.</p>
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => go('budgets')}>Set this month's budget</Button>
            </>
          )}
        </Card>

        <Card as="div" className="!p-5">
          <button className="flex w-full items-center justify-between text-left text-[13px] font-medium text-muted" onClick={() => go('savings')}>Road to {peso(g2, { compact: true })} <Icon name="Target" size={16} /></button>
          <div className="mt-2 flex items-center gap-4">
            <Ring value={(saved / g2) * 100} size={72} stroke={7} label={`${Math.round((saved / g2) * 100)}% of goal`}>
              <span className="num text-[13px] font-semibold">{Math.round((saved / g2) * 100)}%</span>
            </Ring>
            <div className="min-w-0">
              <Money value={saved} serif className="block text-[22px] font-medium" />
              <div className="text-[12.5px] text-muted">BPI Passbook</div>
            </div>
          </div>
          <p className="mt-2 text-[12.5px] text-muted">{reach ? <>{peso(nextGoal, { compact: true })} around <b className="text-ink">{monthLabel(reach, true)}</b> at {peso(state.settings.monthlyContribution, { compact: true })}/mo</> : 'Set a monthly contribution to see a projection.'}</p>
        </Card>

        <Card as="div" className="!p-5">
          <div className="flex items-center justify-between text-[13px] font-medium text-muted">Upcoming bills <Icon name="CalendarDays" size={16} /></div>
          {ups.length === 0 ? (
            <p className="mt-3 text-[13.5px] text-muted">Nothing due in the next two weeks. Add subscriptions or a card due date to see them here.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {ups.slice(0, 3).map((u) => (
                <li key={u.id}>
                  <button className="flex w-full items-center justify-between gap-2 text-left text-[13.5px]" onClick={() => go(u.route as never)}>
                    <span className="min-w-0"><span className="block truncate font-medium">{u.title}</span><span className="text-[12px] text-muted">{relativeDay(u.date)}</span></span>
                    {u.amount !== null && <Money value={u.amount} className="text-[13.5px] font-semibold" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Row 2 */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3" title="Spending this month" subtitle={`${peso(daily.reduce((a, d) => a + Math.round(d.value * 100), 0))} so far in ${monthLabel(m)}`}
          action={<Button variant="ghost" size="sm" onClick={() => go('transactions')}>All activity</Button>}>
          {daily.some((d) => d.value > 0)
            ? <DailySpendChart data={daily} perDay={avail && avail.budget > 0 ? avail.budget / daysInMonth(m) / 100 : undefined} />
            : <div className="grid h-[190px] place-items-center text-center text-[14px] text-muted"><div><Icon name="Coffee" size={22} className="mx-auto mb-2 text-forest" />No spending logged this month yet.<br /><button className="mt-2 font-semibold text-forest hover:underline" onClick={() => openAdd({ kind: 'expense' })}>Log your first expense</button></div></div>}
        </Card>
        <Card className="lg:col-span-2" title="Category budgets" action={<Button variant="ghost" size="sm" onClick={() => go('budgets')}>Manage</Button>}>
          {rows.length === 0 ? <p className="text-[14px] text-muted">Budgets appear here once {monthLabel(m)} has a plan.</p> : (
            <div className="-mx-1 space-y-0.5">{rows.slice(0, 5).map((r) => <BudgetLine key={r.categoryId} row={r} onClick={() => go('budgets')} />)}</div>
          )}
        </Card>
      </div>

      {/* Row 3 */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card title="Savings milestones" action={<Button variant="ghost" size="sm" onClick={() => go('savings')}>Details</Button>}>
          <Milestones />
        </Card>
        <Card title="Recent activity" action={<Button variant="ghost" size="sm" onClick={() => go('transactions')}>See all</Button>}>
          {recent.length === 0 ? <p className="text-[14px] text-muted">Transactions you log appear here.</p> : <div className="-mx-2">{recent.map((x) => <TxnRow key={x.id} t={x} />)}</div>}
        </Card>
      </div>

      {/* Row 4 */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card title="Wishlist" action={<Button variant="ghost" size="sm" onClick={() => go('wishlist')}>Open</Button>}>
          {wishes.length === 0 ? <p className="text-[14px] text-muted">Nothing on your wishlist.</p> : (
            <ul className="space-y-3">
              {wishes.map((w) => { const s = wishSaved(state, w.id); return (
                <li key={w.id}>
                  <div className="flex justify-between text-[14px]"><span className="font-medium">{w.name}</span><span className="num text-muted">{peso(s, { compact: true })} / {peso(w.price, { compact: true })}</span></div>
                  <Progress value={(s / w.price) * 100} tone="gold" thin className="mt-1.5" label={`${w.name} saved`} />
                </li>
              ); })}
            </ul>
          )}
        </Card>
        <Card title="Rewards & achievements" action={<Button variant="ghost" size="sm" onClick={() => go('rewards')}>Open</Button>}>
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gold/15 text-ink"><Icon name="Award" size={24} /></div>
            <div>
              <div className="text-[14px]"><b>{unlocked.length}</b> of {ACHIEVEMENTS.length} achievements</div>
              <div className="text-[13px] text-muted">Reward fund: <span className="num">{peso(rewardFundBalance(state))}</span></div>
            </div>
          </div>
          {unlocked[0] && <p className="mt-3 text-[13.5px] text-muted">Latest: <b className="text-ink">{unlocked[0].title}</b></p>}
        </Card>
      </div>

      <AccountsStrip />
    </div>
  );
}

function Milestones() {
  const { state } = useStore();
  const saved = mainSavings(state);
  const marks = [7_500_000, 10_000_000, 15_000_000, 20_000_000, 25_000_000, 30_000_000, 40_000_000, 50_000_000];
  const next = marks.find((x) => x > saved);
  return (
    <div>
      <div className="flex items-center gap-1" aria-label="Milestone track">
        {marks.map((x) => (
          <div key={x} className="flex-1">
            <div className={cx('h-1.5 rounded-full', saved >= x ? 'bg-forest' : x === next ? 'bg-gold/60' : 'bg-sunken')} />
            <div className={cx('mt-1.5 text-center text-[10.5px] num', saved >= x ? 'font-semibold text-ink' : 'text-muted')}>{x / 100_000}k</div>
          </div>
        ))}
      </div>
      {next && <p className="mt-3 text-[13.5px] text-muted"><b className="text-ink num">{peso(next - saved)}</b> to your next milestone ({peso(next, { compact: true })}).</p>}
    </div>
  );
}

function AccountsStrip() {
  const { state, go } = useStore();
  const accs = state.accounts.filter((a) => a.status === 'active');
  return (
    <Card title="Accounts" action={<Button variant="ghost" size="sm" onClick={() => go('accounts')}>Manage</Button>}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {accs.map((a) => {
          const bal = accountBalance(state, a.id);
          return (
            <button key={a.id} onClick={() => go(a.type === 'credit' ? 'cards' : 'accounts')} className="flex items-center gap-3 rounded-xl border border-line/70 p-3 text-left transition hover:border-accent/40">
              <span className="h-8 w-1.5 rounded-full" style={{ background: a.color }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-muted">{a.name}</span>
                <span className="num block text-[15px] font-semibold">{a.type === 'credit' ? (bal > 0 ? `${peso(bal)} owed` : 'Paid up') : peso(bal)}</span>
              </span>
              {!a.balanceConfirmed && <Badge tone="warn">Confirm</Badge>}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
