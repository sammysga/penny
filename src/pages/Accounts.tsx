import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { Badge, Button, Card, Field, Modal, Money, MoneyInput, Notice, PageHeader, useConfirm } from '../components/ui';
import { Icon } from '../components/Icon';
import { TxnRow } from '../components/bits';
import { accountBalance, availableBalance, flowsForAccount, live, totals } from '../lib/ledger';
import { dateLabel, relativeDay, thisMonth, today } from '../lib/date';
import { peso, type Cents } from '../lib/money';
import { reconcile, uid, upsertAccount } from '../lib/actions';
import type { Account, AccountRole, AccountType } from '../lib/types';

const ROLE_LABEL: Record<AccountRole, string> = {
  main_savings: 'Main savings', salary: 'Salary & buffer', spending: 'Everyday spending', emergency: 'Emergency fund', travel: 'Travel savings',
  investment_cash: 'Investment cash', brokerage: 'Brokerage', credit_card: 'Credit card', other: 'Other',
};

export default function Accounts() {
  const { state, openAdd } = useStore();
  const [detail, setDetail] = useState<string | null>(null);
  const [edit, setEdit] = useState<Account | 'new' | null>(null);
  const [rec, setRec] = useState<Account | null>(null);
  const t = totals(state);
  const groups: [string, Account[]][] = [
    ['Active', state.accounts.filter((a) => a.status === 'active' && a.type !== 'credit')],
    ['Credit', state.accounts.filter((a) => a.status === 'active' && a.type === 'credit')],
    ['Planned — not opened yet', state.accounts.filter((a) => a.status === 'planned')],
    ['Closed', state.accounts.filter((a) => a.status === 'closed')],
  ];
  const d = detail ? state.accounts.find((a) => a.id === detail) : null;

  return (
    <div>
      <PageHeader title="Accounts" subtitle="Where your money actually lives. Penny never connects to your bank."
        actions={<><Button variant="secondary" icon="ArrowRightLeft" onClick={() => openAdd({ kind: 'transfer' })}>Transfer</Button><Button icon="Plus" onClick={() => setEdit('new')}>Account</Button></>} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Cash in accounts', t.cash], ['Savings accounts', t.savings], ['Card balances', -t.liabilities], ['Net worth', t.netWorth]].map(([l, v]) => (
          <Card key={l as string} as="div" className="!p-4"><div className="text-[12.5px] text-muted">{l}</div><Money value={v as number} serif className="mt-1 block text-[20px]" /></Card>
        ))}
      </div>

      <div className="space-y-6">
        {groups.filter(([, a]) => a.length).map(([g, accs]) => (
          <section key={g}>
            <h2 className="mb-2 px-1 text-[13px] font-semibold text-muted">{g}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {accs.map((a) => {
                const bal = accountBalance(state, a.id);
                return (
                  <button key={a.id} onClick={() => setDetail(a.id)} className="card group p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <div className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: a.color }}><Icon name={a.icon} size={19} /></div>
                      <div className="flex gap-1">
                        {a.status === 'planned' && <Badge>Planned</Badge>}
                        {a.status === 'active' && !a.balanceConfirmed && <Badge tone="warn">Confirm balance</Badge>}
                      </div>
                    </div>
                    <div className="mt-4 text-[14px] font-semibold">{a.name}</div>
                    <div className="text-[12.5px] text-muted">{a.institution ? `${a.institution} · ` : ''}{a.purpose}</div>
                    <div className="serif num mt-3 text-[24px]">{a.type === 'credit' ? peso(bal) : peso(bal)}</div>
                    <div className="text-[12px] text-muted">{a.type === 'credit' ? `owed · ${peso(availableBalance(state, a))} available` : a.holdAmount ? `${peso(availableBalance(state, a))} available` : a.status === 'planned' ? 'Not opened yet' : 'Current balance'}</div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {d && (
        <Modal open wide onClose={() => setDetail(null)} title={d.name}
          footer={<>
            <Button variant="secondary" icon="Pencil" onClick={() => { setEdit(d); setDetail(null); }}>Edit</Button>
            {d.status !== 'closed' && <Button variant="secondary" icon="Scale" onClick={() => { setRec(d); setDetail(null); }}>Reconcile</Button>}
            <Button className="flex-1" icon="ArrowRightLeft" onClick={() => { setDetail(null); openAdd({ kind: 'transfer', accountId: d.type === 'credit' ? undefined : d.id, toAccountId: d.type === 'credit' ? d.id : undefined }); }}>{d.type === 'credit' ? 'Pay card' : 'Transfer'}</Button>
          </>}>
          <AccountDetail a={d} />
        </Modal>
      )}
      {edit && <AccountEditor account={edit} onClose={() => setEdit(null)} />}
      {rec && <Reconcile account={rec} onClose={() => setRec(null)} />}
    </div>
  );
}

function AccountDetail({ a }: { a: Account }) {
  const { state } = useStore();
  const bal = accountBalance(state, a.id);
  const pendingBal = accountBalance(state, a.id, { includePending: true });
  const f = flowsForAccount(state, a.id, thisMonth());
  const txns = live(state).filter((t) => t.accountId === a.id || t.toAccountId === a.id).sort((x, y) => y.datetime.localeCompare(x.datetime));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><div className="text-[12px] text-muted">{a.type === 'credit' ? 'Outstanding' : 'Current'}</div><Money value={bal} className="text-[17px] font-semibold" /></div>
        <div><div className="text-[12px] text-muted">Available</div><Money value={availableBalance(state, a)} className="text-[17px] font-semibold" /></div>
        <div><div className="text-[12px] text-muted">Opening balance</div><Money value={a.initialBalance} className="text-[17px] font-semibold" /></div>
        <div><div className="text-[12px] text-muted">In / out this month</div><span className="num text-[15px] font-semibold">+{peso(f.inflow, { compact: true })} / −{peso(f.outflow, { compact: true })}</span></div>
      </div>
      {pendingBal !== bal && <Notice>Including pending items, this would be {peso(pendingBal)}. Pending items don't change the balance until confirmed.</Notice>}
      <div className="text-[12.5px] text-muted">Type: {a.type.replace('_', ' ')} · Role: {ROLE_LABEL[a.role]} · Opened {dateLabel(a.openingDate, { year: true })}{a.lastReconciledAt ? ` · Reconciled ${relativeDay(a.lastReconciledAt)}` : ''}</div>
      <div>
        <h3 className="mb-1 text-[13px] font-semibold">Transactions</h3>
        {txns.length === 0 ? <p className="text-[13.5px] text-muted">No activity yet.</p> : <div className="-mx-2">{txns.slice(0, 40).map((t) => <TxnRow key={t.id} t={t} />)}</div>}
      </div>
    </div>
  );
}

function Reconcile({ account, onClose }: { account: Account; onClose: () => void }) {
  const { state, commit } = useStore();
  const bal = accountBalance(state, account.id);
  const [actual, setActual] = useState<Cents | null>(bal);
  const [note, setNote] = useState('');
  const diff = actual === null ? 0 : actual - bal;
  return (
    <Modal open onClose={onClose} title={`Reconcile ${account.name}`}
      footer={<><Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" disabled={actual === null} onClick={() => { if (actual !== null && commit(diff === 0 ? 'Balance confirmed — all matches' : 'Balance reconciled', (d) => reconcile(d, account.id, actual, note))) onClose(); }}>{diff === 0 ? 'Confirm match' : 'Reconcile'}</Button></>}>
      <div className="space-y-4">
        <p className="text-[14px] text-muted">Check your {account.institution || 'bank'} app and enter the {account.type === 'credit' ? 'outstanding balance you owe' : 'actual balance'}.</p>
        <div className="rounded-xl bg-sunken p-3 text-[14px]">Penny's balance: <b className="num">{peso(bal)}</b></div>
        <Field label={account.type === 'credit' ? 'Actual amount owed' : 'Actual balance'}>{(id) => <MoneyInput id={id} value={actual} onChange={setActual} large />}</Field>
        {diff !== 0 && actual !== null && (
          <Notice tone="warn">Difference of {peso(diff, { sign: true })}. Penny will add a reconciliation entry (not income or spending) so the history stays auditable. If you forgot to log something, cancel and log it instead.</Notice>
        )}
        <Field label="Note (optional)">{(id) => <input id={id} className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. bank interest, unlogged fee" />}</Field>
      </div>
    </Modal>
  );
}

const COLORS = ['#244B3C', '#5E7F6E', '#A8B9A5', '#7A9A86', '#C5AA79', '#8C7A5B', '#3F5E52', '#292B29'];
const ICONS = ['Landmark', 'Wallet', 'CreditCard', 'PiggyBank', 'ShieldCheck', 'Plane', 'LineChart', 'Banknote', 'Coins'];

function AccountEditor({ account, onClose }: { account: Account | 'new'; onClose: () => void }) {
  const { state, commit } = useStore();
  const [confirmDialog, ask] = useConfirm();
  const isNew = account === 'new';
  const [a, setA] = useState<Account>(() => isNew ? { id: uid('acc_'), name: '', institution: '', type: 'savings', role: 'other', purpose: '', initialBalance: 0, balanceConfirmed: true, openingDate: today(), status: 'active', color: COLORS[1], icon: 'Wallet', holdAmount: 0 } : { ...account });
  useEffect(() => { if (a.type === 'credit' && a.role !== 'credit_card') setA((x) => ({ ...x, role: 'credit_card', creditLimit: x.creditLimit ?? 0 })); }, [a.type, a.role]);
  const used = !isNew && state.transactions.some((t) => !t.deletedAt && (t.accountId === a.id || t.toAccountId === a.id));
  const set = <K extends keyof Account>(k: K, v: Account[K]) => setA((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!a.name.trim()) return;
    if (!isNew && used && a.initialBalance !== (account as Account).initialBalance) {
      const ok = await ask('Change the opening balance?', { body: 'This account already has transactions, so changing the opening balance rewrites its history. Use Reconcile instead to record today\'s actual balance.', confirm: 'Change anyway' });
      if (!ok) return;
    }
    if (commit(isNew ? 'Account added' : 'Account saved', (d) => upsertAccount(d, { ...a, name: a.name.trim() }))) onClose();
  };
  return (
    <Modal open wide onClose={onClose} title={isNew ? 'New account' : `Edit ${a.name}`}
      footer={<><Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button><Button className="flex-1" onClick={save}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Account name">{(id) => <input id={id} className="input" value={a.name} onChange={(e) => set('name', e.target.value)} />}</Field>
        <Field label="Institution">{(id) => <input id={id} className="input" value={a.institution} onChange={(e) => set('institution', e.target.value)} />}</Field>
        <Field label="Type">{(id) => (
          <select id={id} className="input" value={a.type} onChange={(e) => set('type', e.target.value as AccountType)}>
            {['savings', 'checking', 'debit', 'ewallet', 'investment_cash', 'brokerage', 'credit'].map((x) => <option key={x} value={x}>{x.replace('_', ' ')}</option>)}
          </select>
        )}</Field>
        <Field label="Role in Penny">{(id) => (
          <select id={id} className="input" value={a.role} onChange={(e) => set('role', e.target.value as AccountRole)}>
            {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        )}</Field>
        <Field label="Purpose" className="sm:col-span-2">{(id) => <input id={id} className="input" value={a.purpose} onChange={(e) => set('purpose', e.target.value)} />}</Field>
        <Field label={a.type === 'credit' ? 'Opening amount owed' : 'Opening balance'}>{(id) => <MoneyInput id={id} value={a.initialBalance} onChange={(v) => set('initialBalance', v ?? 0)} />}</Field>
        <Field label="Opening date">{(id) => <input id={id} type="date" className="input" value={a.openingDate} onChange={(e) => set('openingDate', e.target.value)} />}</Field>
        <Field label="Status">{(id) => (
          <select id={id} className="input" value={a.status} onChange={(e) => set('status', e.target.value as Account['status'])}>
            <option value="active">Active</option><option value="planned">Planned (not opened)</option><option value="closed">Closed</option>
          </select>
        )}</Field>
        {a.type === 'credit'
          ? <Field label="Credit limit">{(id) => <MoneyInput id={id} value={a.creditLimit ?? 0} onChange={(v) => set('creditLimit', v ?? 0)} />}</Field>
          : <Field label="On hold / maintaining balance" hint="Subtracted from available balance.">{(id) => <MoneyInput id={id} value={a.holdAmount} onChange={(v) => set('holdAmount', v ?? 0)} />}</Field>}
        <div className="sm:col-span-2">
          <div className="label">Color & icon</div>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={a.color === c} onClick={() => set('color', c)} className="h-8 w-8 rounded-full ring-offset-2 ring-offset-surface transition aria-pressed:ring-2 aria-pressed:ring-accent" style={{ background: c }} />)}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {ICONS.map((i) => <button key={i} type="button" aria-label={i} aria-pressed={a.icon === i} onClick={() => set('icon', i)} className="grid h-9 w-9 place-items-center rounded-xl text-muted aria-pressed:bg-accent/10 aria-pressed:text-forest hover:bg-sunken"><Icon name={i} size={18} /></button>)}
          </div>
        </div>
      </div>
      {confirmDialog}
    </Modal>
  );
}
