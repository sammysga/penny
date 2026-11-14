import { useState } from 'react';
import { useStore } from '../lib/store';
import { Badge, Button, Card, Empty, Field, Modal, Money, MoneyInput, PageHeader, Progress, Toggle, budgetTone, useConfirm } from '../components/ui';
import { Icon } from '../components/Icon';
import { categoryBudgets, monthlySubscriptionCost } from '../lib/ledger';
import { addPeriod, dayDiff, relativeDay, thisMonth, today } from '../lib/date';
import { peso } from '../lib/money';
import { paySubscription, uid } from '../lib/actions';
import type { Subscription } from '../lib/types';

export default function Subscriptions() {
  const { state, commit } = useStore();
  const [edit, setEdit] = useState<Subscription | 'new' | null>(null);
  const active = state.subscriptions.filter((s) => s.active);
  const monthly = active.reduce((a, s) => a + monthlySubscriptionCost(s.amount, s.frequency), 0);
  const budget = categoryBudgets(state, thisMonth())?.byCategory.subscriptions ?? 150_000;
  const list = [...state.subscriptions].sort((a, b) => Number(b.active) - Number(a.active) || a.nextRenewal.localeCompare(b.nextRenewal));
  return (
    <div className="space-y-5">
      <PageHeader title="Subscriptions" subtitle="Know what renews, and when." actions={<Button icon="Plus" onClick={() => setEdit('new')}>Subscription</Button>} />
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><div className="text-[13px] text-muted">Monthly total (active)</div><Money value={monthly} serif className="text-[30px]" /></div>
          <div className="text-right text-[13px] text-muted">Budget {peso(budget)}<br />{monthly <= budget ? `${peso(budget - monthly)} headroom` : `${peso(monthly - budget)} over budget`}</div>
        </div>
        <Progress value={(monthly / Math.max(1, budget)) * 100} tone={budgetTone((monthly / Math.max(1, budget)) * 100)} className="mt-3" label="Subscriptions vs budget" />
      </Card>
      {list.length === 0 ? <Card><Empty icon="Repeat" title="No subscriptions yet" body="Add Netflix, Spotify, iCloud and the rest. Penny will remind you before each renewal." action={<Button onClick={() => setEdit('new')}>Add subscription</Button>} /></Card> : (
        <Card pad={false}>
          <ul className="divide-y divide-line/60">
            {list.map((s) => {
              const d = dayDiff(today(), s.nextRenewal);
              return (
                <li key={s.id} className={`flex items-center gap-3 px-5 py-4 ${!s.active ? 'opacity-55' : ''}`}>
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-sunken text-forest"><Icon name="Repeat" size={18} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-medium">{s.name} {!s.active && <Badge>Paused</Badge>}{s.active && d <= s.remindDaysBefore && <Badge tone={d < 0 ? 'warn' : 'gold'}>{d < 0 ? 'Overdue' : 'Soon'}</Badge>}</div>
                    <div className="text-[12.5px] text-muted">{s.frequency} · renews {relativeDay(s.nextRenewal).toLowerCase()} · {state.accounts.find((a) => a.id === s.accountId)?.name}</div>
                  </div>
                  <Money value={s.amount} className="font-semibold" />
                  {s.active && <Button size="sm" variant="secondary" onClick={() => commit(`${s.name} payment logged`, (x) => paySubscription(x, s.id))}>Paid</Button>}
                  <button aria-label={`Edit ${s.name}`} className="p-1.5 text-muted hover:text-ink" onClick={() => setEdit(s)}><Icon name="Pencil" size={15} /></button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <p className="text-center text-[12.5px] text-muted">"Paid" logs the expense on the renewal date and moves the next renewal forward.</p>
      {edit && <SubEditor sub={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function SubEditor({ sub, onClose }: { sub: Subscription | 'new'; onClose: () => void }) {
  const { state, commit } = useStore();
  const [confirmDialog, ask] = useConfirm();
  const isNew = sub === 'new';
  const [s, setS] = useState<Subscription>(() => isNew ? { id: uid('sub_'), name: '', amount: 0, frequency: 'monthly', nextRenewal: addPeriod(today(), 'monthly'), accountId: state.accounts.find((a) => a.type === 'credit' && a.status === 'active')?.id ?? state.accounts.find((a) => a.role === 'salary')!.id, categoryId: 'subscriptions', active: true, remindDaysBefore: 3 } : { ...sub });
  return (
    <Modal open onClose={onClose} title={isNew ? 'New subscription' : s.name}
      footer={<>{!isNew && <Button variant="ghost" icon="Trash2" onClick={async () => { if (await ask(`Delete ${s.name}?`, { body: 'Past payments stay in your transactions.', confirm: 'Delete' }) && commit('Subscription deleted', (d) => { d.subscriptions = d.subscriptions.filter((x) => x.id !== s.id); })) onClose(); }}>Delete</Button>}
        <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" onClick={() => { if (s.name.trim() && s.amount > 0 && commit('Subscription saved', (d) => { const i = d.subscriptions.findIndex((x) => x.id === s.id); if (i >= 0) d.subscriptions[i] = s; else d.subscriptions.push(s); })) onClose(); }}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">{(id) => <input id={id} className="input" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} placeholder="e.g. Spotify" />}</Field>
        <Field label="Amount">{(id) => <MoneyInput id={id} value={s.amount} onChange={(v) => setS({ ...s, amount: v ?? 0 })} />}</Field>
        <Field label="Frequency">{(id) => <select id={id} className="input" value={s.frequency} onChange={(e) => setS({ ...s, frequency: e.target.value as Subscription['frequency'] })}><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select>}</Field>
        <Field label="Next renewal">{(id) => <input id={id} type="date" className="input" value={s.nextRenewal} onChange={(e) => setS({ ...s, nextRenewal: e.target.value })} />}</Field>
        <Field label="Remind me (days before)">{(id) => <input id={id} type="number" min={0} max={30} className="input" value={s.remindDaysBefore} onChange={(e) => setS({ ...s, remindDaysBefore: Number(e.target.value) })} />}</Field>
        <Field label="Payment method">{(id) => <select id={id} className="input" value={s.accountId} onChange={(e) => setS({ ...s, accountId: e.target.value })}>{state.accounts.filter((a) => a.status !== 'closed').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}</Field>
        <Field label="Category">{(id) => <select id={id} className="input" value={s.categoryId} onChange={(e) => setS({ ...s, categoryId: e.target.value })}>{state.categories.filter((c) => c.countsAsSpending).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}</Field>
        <div className="sm:col-span-2"><Toggle checked={s.active} onChange={(v) => setS({ ...s, active: v })} label="Active" description="Paused subscriptions don't count toward your monthly total." /></div>
      </div>
      {confirmDialog}
    </Modal>
  );
}
