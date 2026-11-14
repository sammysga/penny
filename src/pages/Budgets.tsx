import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { Badge, Button, Card, Field, Modal, Money, MoneyInput, Notice, PageHeader, Progress, Toggle, cx, useConfirm } from '../components/ui';
import { Icon } from '../components/Icon';
import { BudgetLine, budgetMessage } from '../components/bits';
import { availableToSpend, budgetRows, planForMonth, planTotal } from '../lib/ledger';
import { addMonths, monthLabel, thisMonth } from '../lib/date';
import { peso, type Cents } from '../lib/money';
import { savePlan, uid } from '../lib/actions';
import type { AllocationLine, BudgetPlan } from '../lib/types';

export default function Budgets() {
  const { state, go, commit } = useStore();
  const [month, setMonth] = useState(thisMonth());
  const [editing, setEditing] = useState(false);
  const [confirmDialog, ask] = useConfirm();
  const plan = planForMonth(state, month);
  const pd = state.paydays.find((p) => p.month === month);
  const rows = budgetRows(state, month);
  const avail = availableToSpend(state, month);
  const messages = rows.map((r) => budgetMessage(r, state.categories.find((c) => c.id === r.categoryId)?.name ?? '')).filter(Boolean) as string[];
  const plans = [...state.budgetPlans].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));

  const removePlan = async (p: BudgetPlan) => {
    if (state.paydays.some((x) => x.planId === p.id)) {
      const ok = await ask(`Delete "${p.name}"?`, { body: 'Months whose payday is already set up keep their own snapshot, so they won\'t change. Other months will fall back to the previous plan.', confirm: 'Delete plan' });
      if (!ok) return;
    } else if (!(await ask(`Delete "${p.name}"?`, { confirm: 'Delete plan' }))) return;
    commit('Plan deleted', (d) => { d.budgetPlans = d.budgetPlans.filter((x) => x.id !== p.id); });
  };

  return (
    <div>
      <PageHeader title="Budgets" subtitle="What each peso is for this month. Calm, not strict."
        actions={<div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}><Icon name="ChevronLeft" size={17} /></Button>
          <span className="min-w-[130px] text-center text-[14px] font-semibold">{monthLabel(month)}</span>
          <Button variant="ghost" size="sm" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}><Icon name="ChevronRight" size={17} /></Button>
        </div>} />

      {!plan && !pd ? (
        <Card title={`No budget for ${monthLabel(month)}`} subtitle="Create one from a template on the Payday page, or build it here.">
          <div className="flex flex-wrap gap-2"><Button onClick={() => setEditing(true)}>Create budget</Button><Button variant="secondary" onClick={() => go('payday')}>Use a template</Button></div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {avail && (
              <Card>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="text-[13px] text-muted">Available to spend</div>
                    <Money value={Math.max(0, avail.remaining)} serif className="text-[30px]" />
                  </div>
                  <div className="text-right text-[13px] text-muted">{peso(avail.spent)} spent of {peso(avail.budget)}<br />{month === thisMonth() && avail.remaining > 0 && <>≈ {peso(avail.perDay, { compact: true })}/day for {avail.daysLeft} days</>}</div>
                </div>
                <Progress value={(avail.spent / Math.max(1, avail.budget)) * 100} tone={avail.remaining < 0 ? 'danger' : avail.spent / avail.budget >= 0.8 ? 'warn' : 'accent'} className="mt-3" label="Spending used" />
              </Card>
            )}
            {messages.length > 0 && <div className="space-y-2">{messages.map((m) => <Notice key={m} tone="warn">{m}</Notice>)}</div>}
            <Card title="Categories" subtitle="Penny never raises a budget on its own.">
              <div className="-mx-1">{rows.map((r) => <BudgetLine key={r.categoryId} row={r} />)}</div>
            </Card>
          </div>
          <div className="space-y-4">
            <Card title="This month's plan" subtitle={pd ? 'Amounts come from your payday checklist snapshot.' : plan?.name}
              action={!pd && <Button variant="secondary" size="sm" icon="Pencil" onClick={() => setEditing(true)}>Edit</Button>}>
              <ul className="space-y-1.5 text-[13.5px]">
                {(pd?.items ?? plan?.lines ?? []).map((l) => (
                  <li key={l.id} className="flex justify-between gap-2">
                    <span className="flex items-center gap-1.5 truncate"><Icon name={l.kind === 'transfer' ? 'ArrowRightLeft' : 'Lock'} size={13} className="shrink-0 text-muted" />{l.label}</span>
                    <span className="num text-muted">{peso(l.amount)}</span>
                  </li>
                ))}
              </ul>
              {pd && <Button variant="ghost" size="sm" className="mt-3" onClick={() => go('payday')}>Adjust on payday checklist</Button>}
            </Card>
            <Card title="All plans" subtitle="Each plan runs until the next one starts. Editing never rewrites earlier months.">
              <ul className="space-y-2">
                {plans.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-[13.5px]">
                    <span className="min-w-0"><span className="block truncate font-medium">{p.name}</span><span className="text-[12px] text-muted">{p.onlyMonth ? monthLabel(p.effectiveFrom) + ' only' : `From ${monthLabel(p.effectiveFrom)}`} · {peso(planTotal(p))}</span></span>
                    <button className="rounded-lg p-1.5 text-muted hover:bg-sunken hover:text-danger" aria-label={`Delete ${p.name}`} onClick={() => removePlan(p)}><Icon name="Trash2" size={15} /></button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
      {editing && <PlanEditor month={month} base={plan} onClose={() => setEditing(false)} />}
      {confirmDialog}
    </div>
  );
}

function PlanEditor({ month, base, onClose }: { month: string; base: BudgetPlan | null; onClose: () => void }) {
  const { state, commit } = useStore();
  const [name, setName] = useState(base && base.effectiveFrom === month ? base.name : `${monthLabel(month)} plan`);
  const [lines, setLines] = useState<AllocationLine[]>(() => (base?.lines ?? []).map((l) => ({ ...l })));
  const [income, setIncome] = useState<Cents | null>(base?.expectedIncome ?? state.settings.netMonthly);
  const [onlyMonth, setOnlyMonth] = useState(base?.onlyMonth ?? month < '2027-01');
  useEffect(() => { if (!lines.length) setLines([{ id: uid('l_'), label: 'Main savings', amount: 0, kind: 'transfer', toAccountId: 'acc_passbook' }]); }, [lines.length]);
  const total = lines.reduce((a, l) => a + l.amount, 0);
  const upd = (i: number, p: Partial<AllocationLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const save = () => {
    if (commit(`Budget saved for ${onlyMonth ? monthLabel(month) : `${monthLabel(month)} onward`}`, (d) => savePlan(d, month, { name, lines: lines.filter((l) => l.amount > 0), expectedIncome: income ?? 0, onlyMonth }))) onClose();
  };
  return (
    <Modal open wide onClose={onClose} title={`Budget for ${monthLabel(month)}`}
      footer={<><Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button><Button className="flex-1" onClick={save}>Save plan</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Plan name">{(id) => <input id={id} className="input" value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Expected take-home">{(id) => <MoneyInput id={id} value={income} onChange={setIncome} />}</Field>
        </div>
        <Toggle checked={onlyMonth} onChange={setOnlyMonth} label="Only this month" description={onlyMonth ? `Applies to ${monthLabel(month)} only — e.g. a holiday budget.` : `Applies from ${monthLabel(month)} until you set another plan. Earlier months keep theirs.`} />
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={l.id} className="grid grid-cols-12 items-center gap-2 rounded-xl border border-line/70 p-2">
              <input aria-label="Label" className="input col-span-12 !py-2 sm:col-span-4" value={l.label} onChange={(e) => upd(i, { label: e.target.value })} />
              <select aria-label="Kind" className="input col-span-5 !py-2 sm:col-span-2" value={l.kind} onChange={(e) => upd(i, { kind: e.target.value as AllocationLine['kind'] })}>
                <option value="reservation">Reserve</option><option value="transfer">Transfer</option>
              </select>
              {l.kind === 'transfer' ? (
                <select aria-label="Destination" className="input col-span-7 !py-2 sm:col-span-3" value={l.toAccountId ?? ''} onChange={(e) => upd(i, { toAccountId: e.target.value })}>
                  <option value="">To…</option>
                  {state.accounts.filter((a) => a.status !== 'closed' && a.role !== 'salary').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              ) : (
                <select aria-label="Category" className="input col-span-7 !py-2 sm:col-span-3" value={l.categoryId ?? ''} onChange={(e) => upd(i, { categoryId: e.target.value || undefined })}>
                  <option value="">Buffer</option>
                  {state.categories.filter((c) => c.countsAsSpending).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <MoneyInput className="col-span-10 sm:col-span-2" value={l.amount} onChange={(v) => upd(i, { amount: v ?? 0 })} />
              <button aria-label="Remove line" className="col-span-2 grid place-items-center rounded-lg p-2 text-muted hover:text-danger sm:col-span-1" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Icon name="Trash2" size={15} /></button>
            </div>
          ))}
          <Button variant="ghost" size="sm" icon="Plus" onClick={() => setLines((ls) => [...ls, { id: uid('l_'), label: 'New line', amount: 0, kind: 'reservation' }])}>Add line</Button>
        </div>
        <div className={cx('flex items-center justify-between rounded-xl p-3 text-[14px]', income !== null && total !== income ? 'bg-warn/10' : 'bg-sunken')}>
          <span>Total allocated <b className="num">{peso(total)}</b></span>
          {income !== null && <Badge tone={total === income ? 'good' : 'warn'}>{total === income ? 'Every peso assigned' : total < income ? `${peso(income - total)} unassigned` : `${peso(total - income)} over`}</Badge>}
        </div>
      </div>
    </Modal>
  );
}
