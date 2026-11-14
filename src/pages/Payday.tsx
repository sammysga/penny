import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { Badge, Button, Card, Field, Modal, Money, MoneyInput, Notice, PageHeader, Progress, cx, useConfirm } from '../components/ui';
import { Icon } from '../components/Icon';
import { accountById, planForMonth, planTotal, salaryForMonth } from '../lib/ledger';
import { addMonths, dateLabel, monthLabel, nowLocal, thisMonth, today } from '../lib/date';
import { peso, type Cents } from '../lib/money';
import { addPaydayItem, confirmSalary, editPaydayItem, removePaydayItem, savePlan, setPaydayItem, uid } from '../lib/actions';
import { januaryPlan } from '../lib/seed';
import type { AllocationLine, PaydayItem } from '../lib/types';

export default function PaydayPage() {
  const { state } = useStore();
  const [month, setMonth] = useState(thisMonth());
  const pd = state.paydays.find((p) => p.month === month);
  const months = [...new Set([thisMonth(), ...state.paydays.map((p) => p.month)])].sort().reverse();

  return (
    <div>
      <PageHeader title="Payday" subtitle="Give every peso a purpose — once a month, in a few taps."
        actions={
          <select aria-label="Month" className="input !w-auto !py-2" value={month} onChange={(e) => setMonth(e.target.value)}>
            {[...new Set([addMonths(thisMonth(), 1), ...months])].sort().reverse().map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        } />
      {pd ? <Checklist paydayId={pd.id} /> : <StartPayday month={month} />}
    </div>
  );
}

function StartPayday({ month }: { month: string }) {
  const { state, commit, go } = useStore();
  const plan = planForMonth(state, month);
  const salaryAcc = state.accounts.find((a) => a.role === 'salary');
  const [amount, setAmount] = useState<Cents | null>(plan?.expectedIncome ?? state.settings.netMonthly);
  const [date, setDate] = useState(month === thisMonth() ? today() : `${month}-${String(state.settings.payDay).padStart(2, '0')}`);
  const [accountId, setAccountId] = useState(salaryAcc?.id ?? '');
  const existing = salaryForMonth(state, month);

  const makePlan = (kind: 'standard' | 'holiday') => {
    const base = januaryPlan(nowLocal()).lines.map((l) => ({ ...l, id: uid('l_') }));
    let lines: AllocationLine[] = base;
    let name = `${monthLabel(month)} plan`;
    if (kind === 'holiday') {
      name = `${monthLabel(month)} holiday budget`;
      // Same structure, plus a gifts line funded by trimming wants & buffer — adjust freely afterwards.
      lines = base.map((l) => (l.categoryId === 'wants' ? { ...l, amount: 150_000 } : !l.categoryId && l.kind === 'reservation' ? { ...l, amount: 46_356 } : l));
      lines.splice(9, 0, { id: uid('l_'), label: 'Gifts & holidays', amount: 250_000, kind: 'reservation', categoryId: 'holiday' });
    }
    // Months before the standard plan get a one-month plan so nothing leaks backwards or forwards.
    commit(`${name} created`, (d) => savePlan(d, month, { name, lines, expectedIncome: 4_296_356, onlyMonth: true, note: 'Created from template — review the amounts.' }));
  };

  if (existing) return <Notice tone="warn">Salary for {monthLabel(month)} is already recorded but its checklist was removed. Delete or edit that salary in Transactions to start over.</Notice>;

  if (!plan) {
    return (
      <Card title={`No budget for ${monthLabel(month)} yet`} subtitle="Your January 2027 plan isn't applied to earlier months automatically. Pick a starting point — every amount stays editable.">
        <div className="grid gap-3 sm:grid-cols-3">
          <TemplateBtn icon="LayoutGrid" title="Standard plan" body="Same split as your January 2027 default." onClick={() => makePlan('standard')} />
          <TemplateBtn icon="Gift" title="Holiday budget" body="Adds ₱2,500 for gifts & celebrations, trimmed from wants and buffer." onClick={() => makePlan('holiday')} />
          <TemplateBtn icon="Pencil" title="Build my own" body="Start in Budgets and set each line yourself." onClick={() => go('budgets')} />
        </div>
      </Card>
    );
  }

  const total = planTotal(plan);
  const submit = () => {
    if (!amount) return;
    commit(`Salary of ${peso(amount)} confirmed`, (d) => confirmSalary(d, { month, amount, datetime: `${date}T${month === thisMonth() && date === today() ? nowLocal().slice(11) : '12:00'}`, accountId, planId: plan.id }));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-3" title="1 · Confirm your salary" subtitle={`Enter the actual net amount that landed. ${peso(state.settings.netMonthly)} is a planning baseline, not a guarantee.`}>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4">
          <Field label="Net salary received">{(id) => <MoneyInput id={id} value={amount} onChange={setAmount} large />}</Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date received">{(id) => <input id={id} type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
            <Field label="Received into">{(id) => (
              <select id={id} className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {state.accounts.filter((a) => a.type !== 'credit' && a.status !== 'closed').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}</Field>
          </div>
          {amount !== null && amount !== total && (
            <Notice tone="info">This month's plan totals {peso(total)}. {amount > total ? `${peso(amount - total)} will be unassigned — you can add it to your buffer or savings.` : `That's ${peso(total - amount)} less than planned — you can trim lines on the checklist.`}</Notice>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={!amount}>Confirm salary & build checklist</Button>
          <p className="text-[12.5px] text-muted">Penny records your salary once per month. It never moves real money — you'll do the transfers in your bank apps and tick them off here.</p>
        </form>
      </Card>
      <Card className="lg:col-span-2" title={plan.name} subtitle={`${plan.lines.length} allocations · ${peso(total)}`}>
        <ul className="space-y-2 text-[13.5px]">
          {plan.lines.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 truncate"><Icon name={l.kind === 'transfer' ? 'ArrowRightLeft' : 'Lock'} size={14} className="shrink-0 text-muted" />{l.label}</span>
              <Money value={l.amount} className="text-muted" />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function TemplateBtn({ icon, title, body, onClick }: { icon: string; title: string; body: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-2xl border border-line p-4 text-left transition hover:border-accent/50 hover:bg-sunken/50">
      <Icon name={icon} size={20} className="text-forest" />
      <div className="mt-2 font-semibold">{title}</div>
      <p className="mt-0.5 text-[13px] text-muted">{body}</p>
    </button>
  );
}

function Checklist({ paydayId }: { paydayId: string }) {
  const { state, commit } = useStore();
  const pd = state.paydays.find((p) => p.id === paydayId)!;
  const salary = state.transactions.find((t) => t.id === pd.salaryTxnId);
  const salaryAcc = accountById(state, pd.salaryAccountId);
  const [editing, setEditing] = useState<PaydayItem | 'new' | null>(null);
  const [confirmDialog, ask] = useConfirm();
  const [burst, setBurst] = useState(false);
  const wasDone = useRef(!!pd.completedAt);

  useEffect(() => {
    if (pd.completedAt && !wasDone.current) { setBurst(true); setTimeout(() => setBurst(false), 1800); }
    wasDone.current = !!pd.completedAt;
  }, [pd.completedAt]);

  const total = pd.items.reduce((a, i) => a + i.amount, 0);
  const done = pd.items.filter((i) => i.done);
  const doneAmt = done.reduce((a, i) => a + i.amount, 0);
  const sal = salary?.amount ?? 0;
  const pct = ((done.length + 1) / (pd.items.length + 1)) * 100;
  const transfers = pd.items.filter((i) => i.kind === 'transfer');
  const reservations = pd.items.filter((i) => i.kind === 'reservation');

  const toggle = async (item: PaydayItem) => {
    const to = accountById(state, item.toAccountId);
    if (!item.done && item.kind === 'transfer' && to?.status === 'planned') {
      const ok = await ask(`${to.name} is still planned`, { body: `Ticking this records a ${peso(item.amount)} transfer from ${salaryAcc?.name} and marks ${to.name} as active. Only do this once you've actually opened the account and sent the money.`, confirm: 'Open account & record', danger: false });
      if (!ok) return;
    }
    commit(item.done ? `Unchecked: ${item.label}` : item.kind === 'transfer' ? `${peso(item.amount)} moved to ${to?.name}` : `${peso(item.amount)} reserved for ${item.label}`,
      (d) => setPaydayItem(d, pd.id, item.id, !item.done));
  };

  return (
    <div className="space-y-4">
      {pd.completedAt && (
        <section className="relative overflow-hidden rounded-2xl border border-gold/50 bg-gradient-to-br from-surface to-gold/10 p-6 text-center animate-rise">
          {burst && Array.from({ length: 10 }).map((_, i) => <span key={i} aria-hidden className="absolute bottom-4 animate-floatUp text-gold" style={{ left: `${10 + i * 8.5}%`, animationDelay: `${i * 80}ms` }}>✦</span>)}
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gold/20 text-ink animate-pop"><Icon name="Award" size={24} /></div>
          <h2 className="serif mt-3 text-[22px]">Payday organized.</h2>
          <p className="mt-1 text-[14.5px] text-muted">You're building a future you can be proud of.</p>
        </section>
      )}

      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Summary label="Salary received" value={peso(sal)} />
          <Summary label="Planned" value={peso(total)} />
          <Summary label="Allocated" value={peso(doneAmt)} />
          <Summary label="Still to assign" value={peso(sal - doneAmt)} />
          <Summary label="Transfers" value={`${transfers.filter((t) => t.done).length} done · ${transfers.filter((t) => !t.done).length} pending`} />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Progress value={pct} label="Payday checklist progress" className="flex-1" />
          <span className="num text-[13px] font-semibold">{Math.round(pct)}%</span>
        </div>
        {sal !== total && (
          <div className="mt-4">
            <Notice tone={sal < total ? 'warn' : 'info'}>
              {sal > total
                ? <>{peso(sal - total)} of this salary has no job yet. <button className="font-semibold underline" onClick={() => setEditing('new')}>Give it one</button> or add it to your buffer.</>
                : <>Your plan is {peso(total - sal)} more than this salary. Trim a line so you don't allocate money you don't have.</>}
            </Notice>
          </div>
        )}
      </Card>

      <Card title="Transfers" subtitle="Money actually moves between your accounts. Do it in your bank app, then tick it here.">
        <ul className="divide-y divide-line/60">
          <li className="flex items-center gap-3 py-3">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-forest text-[#F8F7F3]"><Icon name="Check" size={14} strokeWidth={3} /></span>
            <span className="flex-1 text-[14.5px]">Salary received into {salaryAcc?.name} <span className="text-muted">· {salary ? dateLabel(salary.datetime) : ''}</span></span>
            <Money value={sal} className="font-semibold" />
          </li>
          {transfers.map((i) => <ItemRow key={i.id} item={i} onToggle={() => toggle(i)} onEdit={() => setEditing(i)} />)}
        </ul>
      </Card>

      <Card title="Budget reservations" subtitle={`Assigned to a category — the money stays in ${salaryAcc?.name}. Balances don't change.`}>
        <ul className="divide-y divide-line/60">
          {reservations.map((i) => <ItemRow key={i.id} item={i} onToggle={() => toggle(i)} onEdit={() => setEditing(i)} />)}
        </ul>
        <Button variant="ghost" size="sm" icon="Plus" className="mt-2" onClick={() => setEditing('new')}>Add allocation</Button>
      </Card>

      <ItemEditor paydayId={pd.id} item={editing} onClose={() => setEditing(null)} unassigned={Math.max(0, sal - total)} />
      {confirmDialog}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[12px] font-medium text-muted">{label}</div><div className="num mt-0.5 text-[15.5px] font-semibold">{value}</div></div>;
}

function ItemRow({ item, onToggle, onEdit }: { item: PaydayItem; onToggle: () => void; onEdit: () => void }) {
  const { state } = useStore();
  const to = accountById(state, item.toAccountId);
  return (
    <li className="flex items-center gap-3 py-3">
      <button role="checkbox" aria-checked={item.done} onClick={onToggle} aria-label={`${item.label} ${peso(item.amount)}`}
        className={cx('grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition',
          item.done ? 'border-forest bg-forest text-[#F8F7F3]' : 'border-line hover:border-forest')}>
        {item.done && <Icon name="Check" size={14} strokeWidth={3} className="animate-pop" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={cx('text-[14.5px] transition', item.done && 'text-muted line-through decoration-line')}>
          {item.kind === 'transfer' ? `Transfer to ${to?.name ?? '—'}` : item.categoryId ? `Reserve for ${item.label.toLowerCase()}` : item.label}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
          {item.kind === 'transfer' && <span>{item.label}</span>}
          {to?.status === 'planned' && <Badge tone="warn">Planned account</Badge>}
          {item.done && item.doneAt && <span>Done {dateLabel(item.doneAt)}</span>}
        </div>
      </div>
      <Money value={item.amount} className={cx('text-[14.5px] font-semibold', item.done && 'text-muted')} />
      <button onClick={onEdit} aria-label={`Edit ${item.label}`} className="rounded-lg p-1.5 text-muted hover:bg-sunken hover:text-ink"><Icon name="Pencil" size={15} /></button>
    </li>
  );
}

function ItemEditor({ paydayId, item, onClose, unassigned }: { paydayId: string; item: PaydayItem | 'new' | null; onClose: () => void; unassigned: Cents }) {
  const { state, commit } = useStore();
  const isNew = item === 'new';
  const it = item && item !== 'new' ? item : null;
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState<Cents | null>(null);
  const [kind, setKind] = useState<'transfer' | 'reservation'>('reservation');
  const [categoryId, setCategoryId] = useState('');
  const [toAccountId, setTo] = useState('');
  useEffect(() => {
    if (!item) return;
    setLabel(it?.label ?? 'Extra savings'); setAmount(it?.amount ?? (unassigned || null)); setKind(it?.kind ?? 'transfer');
    setCategoryId(it?.categoryId ?? ''); setTo(it?.toAccountId ?? (isNew ? 'acc_passbook' : ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);
  if (!item) return null;
  const save = () => {
    if (!amount || amount <= 0) return;
    const patch = { label: label || 'Allocation', amount, kind, categoryId: kind === 'reservation' ? categoryId || undefined : undefined, toAccountId: kind === 'transfer' ? toAccountId : undefined };
    if (commit(isNew ? 'Allocation added' : 'Allocation updated', (d) => (isNew ? addPaydayItem(d, paydayId, patch) : editPaydayItem(d, paydayId, it!.id, patch)))) onClose();
  };
  const remove = () => { if (it && commit('Allocation removed', (d) => removePaydayItem(d, paydayId, it.id))) onClose(); };
  return (
    <Modal open onClose={onClose} title={isNew ? 'Add allocation' : 'Edit allocation'}
      footer={<>{!isNew && <Button variant="ghost" icon="Trash2" onClick={remove}>Remove</Button>}<Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button><Button className="flex-1" onClick={save}>Save</Button></>}>
      <div className="space-y-4">
        {it?.done && it.kind === 'transfer' && <Notice tone="warn">Uncheck this transfer before changing its amount or destination.</Notice>}
        <p className="text-[13px] text-muted">Changes apply to this month's checklist only. To change future months, edit your plan in Budgets.</p>
        <div className="flex gap-2">
          {(['transfer', 'reservation'] as const).map((k) => <button key={k} type="button" className={cx('chip', kind === k && 'chip-on')} onClick={() => setKind(k)}>{k === 'transfer' ? 'Transfer (moves money)' : 'Reservation (stays put)'}</button>)}
        </div>
        <Field label="Label">{(id) => <input id={id} className="input" value={label} onChange={(e) => setLabel(e.target.value)} />}</Field>
        <Field label="Amount" hint={unassigned > 0 ? `${peso(unassigned)} currently unassigned` : undefined}>{(id) => <MoneyInput id={id} value={amount} onChange={setAmount} />}</Field>
        {kind === 'transfer' ? (
          <Field label="Destination account">{(id) => (
            <select id={id} className="input" value={toAccountId} onChange={(e) => setTo(e.target.value)}>
              <option value="">Choose…</option>
              {state.accounts.filter((a) => a.status !== 'closed' && a.role !== 'salary').map((a) => <option key={a.id} value={a.id}>{a.name}{a.status === 'planned' ? ' (planned)' : ''}</option>)}
            </select>
          )}</Field>
        ) : (
          <Field label="Category" hint="Leave empty for a general buffer.">{(id) => (
            <select id={id} className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Buffer (no category)</option>
              {state.categories.filter((c) => c.countsAsSpending).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}</Field>
        )}
      </div>
    </Modal>
  );
}
