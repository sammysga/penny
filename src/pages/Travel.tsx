import { useState } from 'react';
import { useStore } from '../lib/store';
import { Badge, Button, Card, Empty, Field, Modal, Money, MoneyInput, Notice, PageHeader, Progress, useConfirm } from '../components/ui';
import { Icon } from '../components/Icon';
import { accountBalance, accountByRole, contributionsByMonth, live, planForMonth, tripSpent } from '../lib/ledger';
import { dateLabel, thisMonth } from '../lib/date';
import { peso, type Cents } from '../lib/money';
import { uid } from '../lib/actions';
import type { Trip } from '../lib/types';

export default function Travel() {
  const { state, openAdd } = useStore();
  const [edit, setEdit] = useState<Trip | 'new' | null>(null);
  const acc = accountByRole(state, 'travel');
  const bal = acc && acc.status === 'active' ? accountBalance(state, acc.id) : 0;
  const assigned = state.trips.filter((t) => t.status !== 'done').reduce((a, t) => a + t.allocated, 0);
  const plan = planForMonth(state, thisMonth()) ?? planForMonth(state, '2027-01');
  const monthly = plan?.lines.filter((l) => l.kind === 'transfer' && l.toAccountId === acc?.id).reduce((a, l) => a + l.amount, 0) ?? 0;
  const thisMonthIn = acc ? contributionsByMonth(state, acc.id)[thisMonth()] ?? 0 : 0;
  const spentTotal = live(state).filter((t) => t.kind === 'expense' && t.categoryId === 'travel').reduce((a, t) => a + t.amount, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Travel" subtitle="Save first, then go. Transfers into travel savings are never counted as spending."
        actions={<><Button variant="secondary" icon="Plus" onClick={() => openAdd({ kind: 'transfer', toAccountId: acc?.id })}>Add to fund</Button><Button icon="Plane" onClick={() => setEdit('new')}>New trip</Button></>} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card as="div" className="!p-5"><div className="text-[13px] text-muted">Travel savings · {acc?.name}</div><Money value={bal} serif className="mt-1 block text-[28px]" />
          {acc?.status === 'planned' && <Badge className="mt-1">Account planned</Badge>}</Card>
        <Card as="div" className="!p-5"><div className="text-[13px] text-muted">Not yet assigned to a trip</div><Money value={bal - assigned} serif className="mt-1 block text-[28px]" />
          {bal - assigned < 0 && <p className="text-[12.5px] text-warn">Trips have more assigned than the fund holds.</p>}</Card>
        <Card as="div" className="!p-5"><div className="text-[13px] text-muted">Monthly allocation</div><Money value={monthly} serif className="mt-1 block text-[28px]" />
          <p className="text-[12.5px] text-muted">{thisMonthIn > 0 ? `${peso(thisMonthIn)} added this month` : 'Not added yet this month'}</p></Card>
      </div>

      {state.trips.length === 0 ? (
        <Card><Empty icon="Plane" title="No trips planned yet" body="Create a trip with a budget and planned expenses. Assign money from your travel fund as it grows." action={<Button onClick={() => setEdit('new')}>Plan a trip</Button>} /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {state.trips.map((t) => {
            const spent = tripSpent(state, t.id);
            const planned = t.plannedExpenses.reduce((a, e) => a + e.amount, 0);
            return (
              <Card key={t.id} title={<span className="flex items-center gap-2"><Icon name="Plane" size={16} className="text-forest" />{t.destination}</span>}
                subtitle={t.startDate ? `${dateLabel(t.startDate, { year: true })}${t.endDate ? ` – ${dateLabel(t.endDate, { year: true })}` : ''}` : 'Dates not set'}
                action={<Badge tone={t.status === 'booked' ? 'accent' : t.status === 'done' ? 'good' : 'neutral'}>{t.status}</Badge>}>
                <div className="grid grid-cols-3 gap-3 text-[13px]">
                  <div><div className="text-muted">Budget</div><div className="num font-semibold">{peso(t.budget, { compact: true })}</div></div>
                  <div><div className="text-muted">Saved</div><div className="num font-semibold">{peso(t.allocated, { compact: true })}</div></div>
                  <div><div className="text-muted">Still needed</div><div className="num font-semibold">{peso(Math.max(0, t.budget - t.allocated), { compact: true })}</div></div>
                </div>
                <Progress value={(t.allocated / Math.max(1, t.budget)) * 100} tone="gold" className="mt-3" label="Trip savings" />
                <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
                  <div className="rounded-xl bg-sunken p-3"><div className="text-muted">Planned expenses</div><div className="num font-semibold">{peso(planned)}</div></div>
                  <div className="rounded-xl bg-sunken p-3"><div className="text-muted">Actual spent</div><div className="num font-semibold">{peso(spent)}</div></div>
                </div>
                {t.plannedExpenses.length > 0 && (
                  <ul className="mt-3 space-y-1 text-[13px] text-muted">{t.plannedExpenses.map((e) => <li key={e.id} className="flex justify-between"><span>{e.label}</span><span className="num">{peso(e.amount)}</span></li>)}</ul>
                )}
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setEdit(t)}>Edit & assign</Button>
                  <Button size="sm" variant="ghost" icon="Plus" onClick={() => openAdd({ kind: 'expense', categoryId: 'travel', tripId: t.id, accountId: acc?.status === 'active' ? acc.id : undefined })}>Log trip expense</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <p className="text-center text-[12.5px] text-muted">All travel spending logged: {peso(spentTotal)}. Trip expenses reduce the account they're paid from.</p>
      {edit && <TripEditor trip={edit} available={bal - assigned} onClose={() => setEdit(null)} />}
    </div>
  );
}

function TripEditor({ trip, available, onClose }: { trip: Trip | 'new'; available: Cents; onClose: () => void }) {
  const { commit } = useStore();
  const [confirmDialog, ask] = useConfirm();
  const isNew = trip === 'new';
  const [t, setT] = useState<Trip>(() => isNew ? { id: uid('trip_'), destination: '', budget: 0, allocated: 0, plannedExpenses: [], status: 'planning' } : structuredClone(trip));
  const prevAlloc = isNew ? 0 : (trip as Trip).allocated;
  const canAssign = available + prevAlloc;
  const save = () => { if (t.destination.trim() && commit(isNew ? 'Trip created' : 'Trip saved', (d) => { const i = d.trips.findIndex((x) => x.id === t.id); if (i >= 0) d.trips[i] = t; else d.trips.push(t); })) onClose(); };
  return (
    <Modal open wide onClose={onClose} title={isNew ? 'Plan a trip' : t.destination}
      footer={<>{!isNew && <Button variant="ghost" icon="Trash2" onClick={async () => { if (await ask('Delete this trip?', { body: 'Logged trip expenses stay in your transactions.', confirm: 'Delete' }) && commit('Trip deleted', (d) => { d.trips = d.trips.filter((x) => x.id !== t.id); })) onClose(); }}>Delete</Button>}
        <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button><Button className="flex-1" onClick={save}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Destination" className="sm:col-span-2">{(id) => <input id={id} className="input" value={t.destination} onChange={(e) => setT({ ...t, destination: e.target.value })} placeholder="e.g. Siargao" />}</Field>
        <Field label="Start date">{(id) => <input id={id} type="date" className="input" value={t.startDate ?? ''} onChange={(e) => setT({ ...t, startDate: e.target.value || undefined })} />}</Field>
        <Field label="End date">{(id) => <input id={id} type="date" className="input" value={t.endDate ?? ''} onChange={(e) => setT({ ...t, endDate: e.target.value || undefined })} />}</Field>
        <Field label="Trip budget (target savings)">{(id) => <MoneyInput id={id} value={t.budget} onChange={(v) => setT({ ...t, budget: v ?? 0 })} />}</Field>
        <Field label="Assigned from travel fund" hint={`Up to ${peso(Math.max(0, canAssign))} available`}>{(id) => <MoneyInput id={id} value={t.allocated} onChange={(v) => setT({ ...t, allocated: v ?? 0 })} />}</Field>
        <Field label="Status">{(id) => <select id={id} className="input" value={t.status} onChange={(e) => setT({ ...t, status: e.target.value as Trip['status'] })}><option value="planning">Planning</option><option value="booked">Booked</option><option value="done">Done</option></select>}</Field>
        {t.allocated > canAssign && <div className="sm:col-span-2"><Notice tone="warn">That's more than your travel fund has unassigned. Add money to the fund first.</Notice></div>}
        <div className="sm:col-span-2">
          <div className="label">Planned expenses</div>
          <div className="space-y-2">
            {t.plannedExpenses.map((e, i) => (
              <div key={e.id} className="flex gap-2">
                <input aria-label="Expense" className="input" value={e.label} onChange={(x) => setT({ ...t, plannedExpenses: t.plannedExpenses.map((y, j) => (j === i ? { ...y, label: x.target.value } : y)) })} />
                <MoneyInput className="w-40 shrink-0" value={e.amount} onChange={(v) => setT({ ...t, plannedExpenses: t.plannedExpenses.map((y, j) => (j === i ? { ...y, amount: v ?? 0 } : y)) })} />
                <button aria-label="Remove" className="px-2 text-muted hover:text-danger" onClick={() => setT({ ...t, plannedExpenses: t.plannedExpenses.filter((_, j) => j !== i) })}><Icon name="Trash2" size={15} /></button>
              </div>
            ))}
            <Button size="sm" variant="ghost" icon="Plus" onClick={() => setT({ ...t, plannedExpenses: [...t.plannedExpenses, { id: uid('pe_'), label: ['Flights', 'Hotel', 'Food', 'Activities'][t.plannedExpenses.length % 4], amount: 0 }] })}>Add expense</Button>
          </div>
        </div>
      </div>
      {confirmDialog}
    </Modal>
  );
}
