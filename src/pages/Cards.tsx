import { useState } from 'react';
import { useStore } from '../lib/store';
import { Badge, Button, Card, Field, Modal, Money, MoneyInput, Notice, PageHeader } from '../components/ui';
import { TxnRow } from '../components/bits';
import { accountBalance, availableBalance, cardPayments, live } from '../lib/ledger';
import { dateLabel, dayDiff, relativeDay, today } from '../lib/date';
import { peso, type Cents } from '../lib/money';
import type { Account } from '../lib/types';

export default function Cards() {
  const { state, openAdd } = useStore();
  const [stmt, setStmt] = useState<Account | null>(null);
  const cards = state.accounts.filter((a) => a.type === 'credit' && a.status !== 'closed');
  return (
    <div className="space-y-5">
      <PageHeader title="Credit Cards" subtitle="Purchases count as spending when you make them. Payments just settle what you owe." />
      {cards.map((c) => {
        const owed = accountBalance(state, c.id);
        const avail = availableBalance(state, c);
        const util = c.creditLimit ? (owed / c.creditLimit) * 100 : 0;
        const pays = cardPayments(state, c);
        const purchases = live(state).filter((t) => t.accountId === c.id && t.kind !== 'transfer').sort((a, b) => b.datetime.localeCompare(a.datetime)).slice(0, 8);
        const due = c.dueDate ? dayDiff(today(), c.dueDate) : null;
        return (
          <div key={c.id} className="grid gap-4 lg:grid-cols-5">
            <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#292B29] to-[#3a3d39] p-6 text-[#F8F7F3] shadow-soft lg:col-span-2">
              <div className="absolute -bottom-16 -right-10 h-48 w-48 rounded-full border border-gold/30" aria-hidden />
              <div className="flex items-start justify-between"><div className="text-[13px] text-[#F8F7F3]/70">{c.institution}</div><span className="serif text-[18px] text-gold">{c.name}</span></div>
              <div className="mt-8 text-[12px] text-[#F8F7F3]/70">Outstanding balance</div>
              <div className="serif num text-[34px]">{peso(owed)}</div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={Math.round(util)} aria-valuemin={0} aria-valuemax={100} aria-label="Credit used">
                <div className={`h-full rounded-full ${util > 80 ? 'bg-[#E6886F]' : 'bg-gold'}`} style={{ width: `${Math.min(100, util)}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-[12.5px] text-[#F8F7F3]/75"><span>{peso(avail)} available</span><span>Limit {peso(c.creditLimit ?? 0, { compact: true })}</span></div>
            </section>
            <Card className="lg:col-span-3" title="Statement & payments" action={<Button size="sm" variant="secondary" onClick={() => setStmt(c)}>Update statement</Button>}>
              <div className="grid grid-cols-3 gap-3 text-[13.5px]">
                <div><div className="text-muted">Statement balance</div><div className="num font-semibold">{c.statementBalance !== undefined ? peso(c.statementBalance) : '—'}</div></div>
                <div><div className="text-muted">Due date</div><div className="font-semibold">{c.dueDate ? dateLabel(c.dueDate, { year: true }) : 'Not set'}</div></div>
                <div><div className="text-muted">Utilization</div><div className="num font-semibold">{Math.round(util)}%</div></div>
              </div>
              {due !== null && owed > 0 && due <= 7 && <div className="mt-3"><Notice tone={due < 0 ? 'warn' : 'info'}>{due < 0 ? `Payment was due ${relativeDay(c.dueDate!)}.` : `Payment due ${relativeDay(c.dueDate!).toLowerCase()}.`} Paying the full statement balance avoids interest.</Notice></div>}
              {owed === 0 && <div className="mt-3"><Notice tone="good">Nothing owed. Your November bill of ₱9,954.74 was paid before Penny started and isn't deducted again.</Notice></div>}
              <Button className="mt-4" icon="ArrowRightLeft" disabled={owed <= 0} onClick={() => openAdd({ kind: 'transfer', toAccountId: c.id, amount: Math.min(owed, c.statementBalance || owed), merchant: `${c.name} payment`, accountId: state.accounts.find((a) => a.role === 'salary')?.id })}>Record a payment</Button>
              <h3 className="mb-1 mt-5 text-[13px] font-semibold">Payment history</h3>
              {pays.length === 0 ? <p className="text-[13px] text-muted">No payments yet.</p> : (
                <ul className="divide-y divide-line/60 text-[13.5px]">
                  {pays.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                      <span>{dateLabel(p.date, { year: true })} <span className="text-muted">· {p.legacy ? 'Before Penny' : p.note}</span> {p.legacy && <Badge>Not in ledger</Badge>}</span>
                      <Money value={p.amount} className="font-semibold" />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="lg:col-span-5" title="Recent card activity">
              {purchases.length === 0 ? <p className="text-[13.5px] text-muted">Choose {c.name} as "Paid with" when logging an expense.</p> : <div className="-mx-2 grid sm:grid-cols-2">{purchases.map((t) => <TxnRow key={t.id} t={t} />)}</div>}
            </Card>
          </div>
        );
      })}
      {stmt && <StatementModal card={stmt} onClose={() => setStmt(null)} />}
    </div>
  );
}

function StatementModal({ card, onClose }: { card: Account; onClose: () => void }) {
  const { commit } = useStore();
  const [bal, setBal] = useState<Cents | null>(card.statementBalance ?? 0);
  const [due, setDue] = useState(card.dueDate ?? '');
  const [sd, setSd] = useState(card.statementDate ?? '');
  return (
    <Modal open onClose={onClose} title={`${card.name} statement`}
      footer={<><Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button><Button className="flex-1" onClick={() => { if (commit('Statement updated', (d) => { const a = d.accounts.find((x) => x.id === card.id)!; a.statementBalance = bal ?? 0; a.dueDate = due || undefined; a.statementDate = sd || undefined; })) onClose(); }}>Save</Button></>}>
      <div className="space-y-4">
        <Field label="Statement balance">{(id) => <MoneyInput id={id} value={bal} onChange={setBal} />}</Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Statement date">{(id) => <input id={id} type="date" className="input" value={sd} onChange={(e) => setSd(e.target.value)} />}</Field>
          <Field label="Payment due date">{(id) => <input id={id} type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />}</Field>
        </div>
        <p className="text-[12.5px] text-muted">This is for reminders only. Your outstanding balance is calculated from logged purchases and payments.</p>
      </div>
    </Modal>
  );
}
