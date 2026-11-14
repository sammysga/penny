import { useState } from 'react';
import { useStore } from '../lib/store';
import { Badge, Button, Card, Field, Modal, Money, MoneyInput, Notice, PageHeader, Ring } from '../components/ui';
import { Icon } from '../components/Icon';
import { MonthlyBars, ProjectionChart } from '../components/charts';
import { accountBalance, accountByRole, contributionsByMonth, flowsForAccount, savingsStreak } from '../lib/ledger';
import { addMonths, monthLabel, nowLocal, thisMonth, today } from '../lib/date';
import { peso, type Cents } from '../lib/money';
import { mainSavings, monthsToReach, projectionSeries, reachMonth, requiredMonthly, scenarios } from '../lib/projections';
import { payObligation, receiveExpected } from '../lib/actions';
import type { ExpectedIncome } from '../lib/types';

export default function Savings() {
  const { state } = useStore();
  const [editGoals, setEditGoals] = useState(false);
  const s = state.settings;
  const main = accountByRole(state, 'main_savings');
  const saved = mainSavings(state);
  const contributed = main ? flowsForAccount(state, main.id).inflow : 0;
  const withdrawn = main ? flowsForAccount(state, main.id).outflow : 0;
  const sc = scenarios(state);
  const need = requiredMonthly(state, s.goal2, s.goalTargetMonth);
  const need1 = requiredMonthly(state, s.goal1, s.goalTargetMonth);
  const standardReach = reachMonth(state, s.goal2, s.monthlyContribution);
  const onTrack = standardReach !== null && standardReach <= s.goalTargetMonth;

  const others = (['emergency', 'travel', 'investment_cash'] as const).map((r) => accountByRole(state, r)).filter((a) => a && a.status === 'active');
  const otherTotal = others.reduce((a, x) => a + accountBalance(state, x!.id), 0);

  const byMonth = main ? contributionsByMonth(state, main.id) : {};
  const hist = Array.from({ length: 12 }, (_, i) => addMonths(thisMonth(), i - 11)).map((m) => ({ month: m, value: (byMonth[m] ?? 0) / 100 }));

  return (
    <div className="space-y-5">
      <PageHeader title="Savings Goals" subtitle="Honest projections from confirmed balances only — no assumed returns or bonuses."
        actions={<Button variant="secondary" icon="Pencil" onClick={() => setEditGoals(true)}>Edit goals</Button>} />

      <section className="card overflow-hidden">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="text-[13px] font-medium text-muted">My Road to {peso(s.goal2, { compact: true })}</div>
            <Money value={saved} serif className="mt-1 block text-[40px] font-medium leading-none sm:text-[48px]" />
            <div className="mt-1 text-[13.5px] text-muted">in {main?.name ?? 'main savings'} · protected</div>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div><div className="text-[12px] text-muted">Monthly contribution</div><div className="num font-semibold">{peso(s.monthlyContribution, { compact: true })}</div></div>
              <div><div className="text-[12px] text-muted">Contributed in Penny</div><div className="num font-semibold">{peso(contributed, { compact: true })}</div></div>
              <div><div className="text-[12px] text-muted">To {peso(s.goal1, { compact: true })}</div><div className="num font-semibold">{peso(Math.max(0, s.goal1 - saved), { compact: true })}</div></div>
              <div><div className="text-[12px] text-muted">To {peso(s.goal2, { compact: true })}</div><div className="num font-semibold">{peso(Math.max(0, s.goal2 - saved), { compact: true })}</div></div>
            </div>
            {withdrawn > 0 && <p className="mt-3 text-[12.5px] text-muted">{peso(withdrawn)} has been taken out of {main?.name} since you started.</p>}
            {savingsStreak(state) > 0 && <Badge tone="gold" className="mt-3"><Icon name="Flame" size={12} /> {savingsStreak(state)}-month savings streak</Badge>}
          </div>
          <div className="flex items-center gap-5">
            <Ring value={(saved / s.goal1) * 100} size={128} label={`${Math.round((saved / s.goal1) * 100)}% of first milestone`}>
              <div><div className="num text-[20px] font-semibold">{Math.min(100, Math.round((saved / s.goal1) * 100))}%</div><div className="text-[11px] text-muted">of {peso(s.goal1, { compact: true })}</div></div>
            </Ring>
            <Ring value={(saved / s.goal2) * 100} size={128} tone="gold" label={`${Math.round((saved / s.goal2) * 100)}% of long-term goal`}>
              <div><div className="num text-[20px] font-semibold">{Math.min(100, Math.round((saved / s.goal2) * 100))}%</div><div className="text-[11px] text-muted">of {peso(s.goal2, { compact: true })}</div></div>
            </Ring>
          </div>
        </div>
      </section>

      <Notice tone={onTrack ? 'good' : 'info'}>
        {onTrack
          ? <>At {peso(s.monthlyContribution, { compact: true })}/month you're on track for {peso(s.goal2, { compact: true })} by {monthLabel(standardReach!)}.</>
          : <>Your aspirational target is {monthLabel(s.goalTargetMonth)}. Reaching {peso(s.goal1, { compact: true })} by then needs about <b>{need1 ? peso(need1, { compact: true }) : '—'}/month</b>, and {peso(s.goal2, { compact: true })} needs about <b>{need ? peso(need, { compact: true }) : '—'}/month</b>. At your standard {peso(s.monthlyContribution, { compact: true })} you'd reach {peso(s.goal2, { compact: true })} around <b>{standardReach ? monthLabel(standardReach) : '—'}</b>. Windfalls like the Nestlé remainder or 13th-month pay can close the gap — but only once they're actually received.</>}
      </Notice>

      <div className="grid gap-4 lg:grid-cols-3">
        {sc.map((x) => {
          const r1 = reachMonth(state, s.goal1, x.monthly);
          const r2 = reachMonth(state, s.goal2, x.monthly);
          return (
            <Card key={x.key} as="div" className="!p-5">
              <div className="flex items-center justify-between"><span className="text-[13px] font-semibold">{x.label}</span><span className="num text-[13px] text-muted">{peso(x.monthly, { compact: true })}/mo</span></div>
              <dl className="mt-3 space-y-2 text-[13.5px]">
                <div className="flex justify-between"><dt className="text-muted">{peso(s.goal1, { compact: true })}</dt><dd className="font-semibold">{r1 ? monthLabel(r1, true) : '—'} <span className="font-normal text-muted">({monthsToReach(saved, s.goal1, x.monthly) ?? '—'} mo)</span></dd></div>
                <div className="flex justify-between"><dt className="text-muted">{peso(s.goal2, { compact: true })}</dt><dd className="font-semibold">{r2 ? monthLabel(r2, true) : '—'} <span className="font-normal text-muted">({monthsToReach(saved, s.goal2, x.monthly) ?? '—'} mo)</span></dd></div>
              </dl>
            </Card>
          );
        })}
      </div>

      <Card title="Projected main savings" subtitle={`Contributions start ${monthLabel(s.contributionStartMonth)} or the next month without one. No interest or returns assumed.`}>
        <ProjectionChart data={projectionSeries(state)} goal1={s.goal1} goal2={s.goal2} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Protected vs. all savings" subtitle="Projections above use protected savings only.">
          <ul className="space-y-2.5 text-[14px]">
            <li className="flex justify-between"><span className="flex items-center gap-2"><Icon name="Lock" size={15} className="text-forest" />{main?.name} (protected)</span><Money value={saved} className="font-semibold" /></li>
            {others.map((a) => <li key={a!.id} className="flex justify-between"><span className="text-muted">{a!.name} · {a!.purpose.toLowerCase()}</span><Money value={accountBalance(state, a!.id)} /></li>)}
            <li className="flex justify-between border-t border-line pt-2.5 font-semibold"><span>All savings</span><Money value={saved + otherTotal} /></li>
          </ul>
          {others.length < 3 && <p className="mt-3 text-[12.5px] text-muted">Planned savings accounts appear here once you open them.</p>}
        </Card>
        <Card title="Monthly contributions" subtitle={`Into ${main?.name}, last 12 months`}>
          {hist.some((h) => h.value > 0) ? <MonthlyBars data={hist} name="Contributed" /> : <p className="py-8 text-center text-[14px] text-muted">Your first contribution will show here — it's the first transfer on your payday checklist.</p>}
        </Card>
      </div>

      <ExpectedIncomeCard />
      {editGoals && <GoalEditor onClose={() => setEditGoals(false)} />}
    </div>
  );
}

function ExpectedIncomeCard() {
  const { state } = useStore();
  const [recv, setRecv] = useState<ExpectedIncome | null>(null);
  const [pay, setPay] = useState<{ e: ExpectedIncome; oid: string } | null>(null);
  return (
    <Card title="Expected income" subtitle="Pending until it actually arrives. Never counted in cash, net worth or projections.">
      <ul className="divide-y divide-line/60">
        {state.expectedIncome.map((e) => (
          <li key={e.id} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 font-medium">{e.name} <Badge tone={e.status === 'received' ? 'good' : 'neutral'}>{e.status === 'received' ? 'Received' : 'Pending'}</Badge></div>
                <div className="text-[13px] text-muted">{e.expectedAmount !== null ? `Expected ${peso(e.expectedAmount)}` : 'Amount not confirmed yet'}{e.notes ? ` · ${e.notes}` : ''}</div>
              </div>
              {e.status === 'pending' && <Button size="sm" variant="secondary" onClick={() => setRecv(e)}>Mark received</Button>}
            </div>
            {e.obligations.map((o) => (
              <div key={o.id} className="mt-2 flex items-center justify-between rounded-xl bg-sunken px-3 py-2 text-[13.5px]">
                <span>{o.label} · <span className="num">{peso(o.amount)}</span></span>
                {o.paidTxnId ? <Badge tone="good">Paid</Badge> : e.status === 'received' ? <Button size="sm" variant="ghost" onClick={() => setPay({ e, oid: o.id })}>Record payment</Button> : <span className="text-[12px] text-muted">After receipt</span>}
              </div>
            ))}
          </li>
        ))}
      </ul>
      {recv && <ReceiveModal e={recv} onClose={() => setRecv(null)} />}
      {pay && <PayObligationModal e={pay.e} oid={pay.oid} onClose={() => setPay(null)} />}
    </Card>
  );
}

function ReceiveModal({ e, onClose }: { e: ExpectedIncome; onClose: () => void }) {
  const { state, commit } = useStore();
  const [amount, setAmount] = useState<Cents | null>(e.expectedAmount);
  const [acc, setAcc] = useState(state.accounts.find((a) => a.role === 'salary')?.id ?? '');
  const [date, setDate] = useState(today());
  return (
    <Modal open onClose={onClose} title={`${e.name} received`}
      footer={<><Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button><Button className="flex-1" disabled={!amount} onClick={() => { if (amount && commit(`${e.name} recorded`, (d) => receiveExpected(d, e.id, amount, acc, `${date}T${nowLocal().slice(11)}`))) onClose(); }}>Record income</Button></>}>
      <div className="space-y-4">
        <Field label="Actual amount received">{(id) => <MoneyInput id={id} value={amount} onChange={setAmount} large />}</Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Into">{(id) => <select id={id} className="input" value={acc} onChange={(x) => setAcc(x.target.value)}>{state.accounts.filter((a) => a.type !== 'credit' && a.status !== 'closed').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}</Field>
          <Field label="Date">{(id) => <input id={id} type="date" className="input" value={date} onChange={(x) => setDate(x.target.value)} />}</Field>
        </div>
        {e.obligations.length > 0 && <Notice>After recording, you can log {e.obligations.map((o) => `${o.label.toLowerCase()} (${peso(o.amount)})`).join(', ')}. Then decide where the remainder goes — e.g. a transfer to BPI Passbook.</Notice>}
      </div>
    </Modal>
  );
}

function PayObligationModal({ e, oid, onClose }: { e: ExpectedIncome; oid: string; onClose: () => void }) {
  const { state, commit } = useStore();
  const o = e.obligations.find((x) => x.id === oid)!;
  const [amount, setAmount] = useState<Cents | null>(o.amount);
  const recvAcc = state.transactions.find((t) => t.id === e.receivedTxnId)?.accountId;
  const [acc, setAcc] = useState(recvAcc ?? '');
  return (
    <Modal open onClose={onClose} title={o.label}
      footer={<><Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button><Button className="flex-1" disabled={!amount} onClick={() => { if (amount && commit('Payment recorded', (d) => payObligation(d, e.id, oid, acc, amount))) onClose(); }}>Record payment</Button></>}>
      <div className="space-y-4">
        <Field label="Amount">{(id) => <MoneyInput id={id} value={amount} onChange={setAmount} />}</Field>
        <Field label="Paid from">{(id) => <select id={id} className="input" value={acc} onChange={(x) => setAcc(x.target.value)}>{state.accounts.filter((a) => a.type !== 'credit' && a.status === 'active').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}</Field>
        <p className="text-[12.5px] text-muted">Logged under "Family & obligations" — it doesn't use your monthly spending budget.</p>
      </div>
    </Modal>
  );
}

function GoalEditor({ onClose }: { onClose: () => void }) {
  const { state, commit } = useStore();
  const s = state.settings;
  const [v, setV] = useState({ goal1: s.goal1, goal2: s.goal2, monthly: s.monthlyContribution, stretch: s.stretchContribution, cons: s.conservativeContribution, target: s.goalTargetMonth, start: s.contributionStartMonth });
  return (
    <Modal open onClose={onClose} title="Savings goals"
      footer={<><Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button><Button className="flex-1" onClick={() => { if (commit('Goals updated', (d) => Object.assign(d.settings, { goal1: v.goal1, goal2: v.goal2, monthlyContribution: v.monthly, stretchContribution: v.stretch, conservativeContribution: v.cons, goalTargetMonth: v.target, contributionStartMonth: v.start }))) onClose(); }}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First milestone">{(id) => <MoneyInput id={id} value={v.goal1} onChange={(x) => setV({ ...v, goal1: x ?? 0 })} />}</Field>
        <Field label="Long-term goal">{(id) => <MoneyInput id={id} value={v.goal2} onChange={(x) => setV({ ...v, goal2: x ?? 0 })} />}</Field>
        <Field label="Standard monthly">{(id) => <MoneyInput id={id} value={v.monthly} onChange={(x) => setV({ ...v, monthly: x ?? 0 })} />}</Field>
        <Field label="Stretch monthly">{(id) => <MoneyInput id={id} value={v.stretch} onChange={(x) => setV({ ...v, stretch: x ?? 0 })} />}</Field>
        <Field label="Conservative monthly">{(id) => <MoneyInput id={id} value={v.cons} onChange={(x) => setV({ ...v, cons: x ?? 0 })} />}</Field>
        <Field label="Aspirational target month">{(id) => <input id={id} type="month" className="input" value={v.target} onChange={(e) => setV({ ...v, target: e.target.value })} />}</Field>
        <Field label="Contributions start" hint="Used for projections only.">{(id) => <input id={id} type="month" className="input" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} />}</Field>
      </div>
    </Modal>
  );
}
