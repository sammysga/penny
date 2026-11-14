import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { Button, Field, Modal, MoneyInput, Notice, Segmented, cx, useConfirm } from './ui';
import { Icon } from './Icon';
import { peso, type Cents } from '../lib/money';
import { nowLocal, timeLabel, relativeDay } from '../lib/date';
import { accountById, findDuplicate, live } from '../lib/ledger';
import { addTxn, deleteTxn, editTxn } from '../lib/actions';
import type { IncomeType, Transaction } from '../lib/types';

type Kind = 'expense' | 'transfer' | 'income';

const QUICK = [10_000, 25_000, 50_000, 100_000, 150_000];

const KEYWORDS: [RegExp, string][] = [
  [/coffee|cafe|café|starbucks|tim hortons|kape|bakery|lunch|dinner|breakfast|grab ?food|foodpanda|jollibee|mcdo|resto|restaurant|grocer|food|milk ?tea/i, 'food'],
  [/golf|pickle|court|driving range|green fee|caddie|paddle|sports/i, 'sports'],
  [/skin|serum|sunscreen|toner|moistur|watsons|sephora|cleanser|beauty/i, 'skincare'],
  [/dog|pet|vet|kibble|groom|petco|pet ?express/i, 'dogs'],
  [/pharma|mercury|medic|doctor|clinic|hospital|vitamin|dental|health|rx/i, 'health'],
  [/grab(?! ?food)|angkas|joyride|taxi|gas|fuel|petron|shell|toll|parking|mrt|lrt|jeep|bus|uber|transport|load/i, 'transport'],
  [/netflix|spotify|youtube|apple|icloud|disney|hbo|prime|chatgpt|subscription|google one/i, 'subscriptions'],
  [/shopee|lazada|zara|uniqlo|h&m|nike|adidas|shop|mall|clothes|shoes/i, 'wants'],
  [/flight|hotel|airbnb|cebu pac|pal|agoda|booking|travel/i, 'travel'],
  [/gift|christmas|noche/i, 'holiday'],
];

export function AddTransaction() {
  const { state, addOpen, closeAdd, commit } = useStore();
  const [confirmDialog, ask] = useConfirm();
  const editing = addOpen?.editId ? state.transactions.find((t) => t.id === addOpen.editId) : undefined;

  const expenseAccounts = state.accounts.filter((a) => a.status === 'active');
  const assetAccounts = expenseAccounts.filter((a) => a.type !== 'credit');
  const recentExpenses = useMemo(() => live(state).filter((t) => t.kind === 'expense' && t.source !== 'payday').sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [state]);
  const defaultAccount = recentExpenses[0]?.accountId && accountById(state, recentExpenses[0].accountId)?.status === 'active'
    ? recentExpenses[0].accountId
    : (state.accounts.find((a) => a.role === 'spending' && a.status === 'active') ?? state.accounts.find((a) => a.role === 'salary'))?.id ?? '';

  const [kind, setKind] = useState<Kind>('expense');
  const [amount, setAmount] = useState<Cents | null>(null);
  const [merchant, setMerchant] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [catTouched, setCatTouched] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [datetime, setDatetime] = useState(nowLocal());
  const [notes, setNotes] = useState('');
  const [tripId, setTripId] = useState('');
  const [incomeType, setIncomeType] = useState<IncomeType>('other');
  const [pending, setPending] = useState(false);
  const [more, setMore] = useState(false);
  const [dupOk, setDupOk] = useState(false);
  const [error, setError] = useState('');

  // Reset when opened
  useEffect(() => {
    if (!addOpen) return;
    const t = editing;
    const k: Kind = t ? (t.kind === 'income' ? 'income' : t.kind === 'transfer' ? 'transfer' : 'expense') : (addOpen.kind as Kind) ?? 'expense';
    setKind(k);
    setAmount(t?.amount ?? addOpen.amount ?? null);
    setMerchant(t?.merchant ?? addOpen.merchant ?? '');
    setCategoryId(t?.categoryId ?? addOpen.categoryId ?? '');
    setCatTouched(!!(t?.categoryId ?? addOpen.categoryId));
    setAccountId(t?.accountId ?? addOpen.accountId ?? (k === 'expense' ? defaultAccount : state.accounts.find((a) => a.role === 'salary')?.id ?? ''));
    setToAccountId(t?.toAccountId ?? addOpen.toAccountId ?? '');
    setDatetime(t?.datetime ?? nowLocal());
    setNotes(t?.notes ?? '');
    setTripId(t?.tripId ?? addOpen.tripId ?? '');
    setIncomeType(t?.incomeType ?? 'other');
    setPending(t?.status === 'pending');
    setMore(!!t?.notes || !!t);
    setDupOk(false); setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addOpen]);

  // Recently used categories first
  const cats = useMemo(() => {
    const order = [...new Set(recentExpenses.map((t) => t.categoryId))];
    const list = state.categories.filter((c) => !c.archived && c.id !== 'rewards');
    return [...list].sort((a, b) => {
      const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }, [state.categories, recentExpenses]);

  const merchants = useMemo(() => {
    const seen = new Map<string, Transaction>();
    for (const t of recentExpenses) if (t.merchant && !seen.has(t.merchant.toLowerCase())) seen.set(t.merchant.toLowerCase(), t);
    return [...seen.values()];
  }, [recentExpenses]);

  // Smart category suggestion
  useEffect(() => {
    if (catTouched || kind !== 'expense' || !merchant.trim()) return;
    const prev = merchants.find((t) => t.merchant.toLowerCase() === merchant.trim().toLowerCase());
    if (prev?.categoryId) { setCategoryId(prev.categoryId); return; }
    const hit = KEYWORDS.find(([re]) => re.test(merchant));
    if (hit) setCategoryId(hit[1]);
  }, [merchant, catTouched, kind, merchants]);

  if (!addOpen) return null;

  const repeat = recentExpenses.slice(0, 3);
  const acc = accountById(state, accountId);
  const toAcc = accountById(state, toAccountId);
  const isCardPayment = kind === 'transfer' && toAcc?.type === 'credit';

  const save = () => {
    setError('');
    if (!amount || amount <= 0) return setError('Enter an amount.');
    if (!accountId) return setError('Choose an account.');
    const input = {
      kind: kind as Transaction['kind'], amount, datetime, accountId, merchant: merchant.trim() || (kind === 'transfer' ? (isCardPayment ? 'Card payment' : 'Transfer') : kind === 'income' ? 'Income' : 'Expense'),
      categoryId: kind === 'expense' ? categoryId : undefined, toAccountId: kind === 'transfer' ? toAccountId : undefined,
      notes: notes.trim() || undefined, tripId: kind === 'expense' && tripId ? tripId : undefined,
      incomeType: kind === 'income' ? incomeType : undefined, status: (pending ? 'pending' : 'cleared') as Transaction['status'],
      source: addOpen.source ?? 'manual',
    };
    if (kind === 'expense' && !categoryId) return setError('Pick a category.');
    if (kind === 'transfer' && !toAccountId) return setError('Choose where the money goes.');
    if (!editing && !dupOk) {
      const dup = findDuplicate(state, input);
      if (dup) { setDupOk(true); return setError(`Looks like a duplicate of "${dup.merchant}" ${peso(dup.amount)} at ${timeLabel(dup.datetime)}. Tap save again if it's a separate ${kind}.`); }
    }
    const label = editing ? 'Changes saved' : kind === 'expense' ? `Logged ${peso(amount)} · ${input.merchant}` : kind === 'transfer' ? `${isCardPayment ? 'Card payment' : 'Transfer'} recorded` : 'Income recorded';
    const ok = commit(label, (d) => {
      if (editing) editTxn(d, editing.id, input);
      else {
        addTxn(d, input);
        if (addOpen.source === 'checkin') d.checkInLog.push({ at: nowLocal(), response: 'logged' });
      }
    });
    if (ok) closeAdd();
  };

  const remove = async () => {
    if (!editing) return;
    const yes = await ask('Delete this transaction?', { body: 'It moves to the deleted list with its full history, and balances update. You can restore it later.', confirm: 'Delete' });
    if (yes && commit('Transaction deleted', (d) => deleteTxn(d, editing.id))) closeAdd();
  };

  const title = editing ? 'Edit transaction' : kind === 'expense' ? 'Add expense' : kind === 'transfer' ? 'Move money' : 'Add income';

  return (
    <>
      <Modal open onClose={closeAdd} title={title}
        footer={<>
          {editing && <Button variant="ghost" icon="Trash2" onClick={remove} aria-label="Delete">Delete</Button>}
          <Button variant="secondary" className="flex-1" onClick={closeAdd}>Cancel</Button>
          <Button className="flex-[2]" onClick={save}>{editing ? 'Save changes' : dupOk ? 'Save anyway' : 'Save'}</Button>
        </>}>
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-4">
          {!editing && (
            <Segmented label="Type" value={kind} onChange={(v) => { setKind(v); setError(''); setDupOk(false); if (v !== 'expense') setAccountId(state.accounts.find((a) => a.role === 'salary')?.id ?? ''); else setAccountId(defaultAccount); }}
              options={[{ value: 'expense', label: 'Expense' }, { value: 'transfer', label: 'Transfer' }, { value: 'income', label: 'Income' }]} />
          )}

          {kind === 'expense' && !editing && repeat.length > 0 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1">
              {repeat.map((t) => (
                <button type="button" key={t.id} className="chip shrink-0" onClick={() => { setAmount(t.amount); setMerchant(t.merchant); setCategoryId(t.categoryId ?? ''); setCatTouched(true); setAccountId(t.accountId); }}>
                  <Icon name="RotateCcw" size={13} /> {t.merchant} · {peso(t.amount, { compact: true })}
                </button>
              ))}
            </div>
          )}

          <Field label="Amount">{(id) => <MoneyInput id={id} value={amount} onChange={(v) => { setAmount(v); setDupOk(false); }} large autoFocus />}</Field>
          {kind === 'expense' && !editing && (
            <div className="-mt-2 flex flex-wrap gap-1.5">
              {QUICK.map((q) => <button type="button" key={q} className={cx('chip py-1', amount === q && 'chip-on')} onClick={() => setAmount(q)}>{peso(q, { compact: true })}</button>)}
            </div>
          )}

          {kind !== 'transfer' && (
            <Field label={kind === 'income' ? 'Source' : 'Merchant / description'}>
              {(id) => (
                <>
                  <input id={id} className="input" list="penny-merchants" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder={kind === 'income' ? 'e.g. Freelance, refund, gift' : 'e.g. Coffee, Pickleball court'} />
                  <datalist id="penny-merchants">{merchants.map((t) => <option key={t.id} value={t.merchant} />)}</datalist>
                </>
              )}
            </Field>
          )}

          {kind === 'expense' && (
            <div>
              <div className="label">Category {categoryId && !catTouched && merchant && <span className="ml-1 text-[12px] font-normal text-forest">· suggested</span>}</div>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {cats.map((c) => (
                  <button type="button" key={c.id} onClick={() => { setCategoryId(c.id); setCatTouched(true); }} aria-pressed={categoryId === c.id}
                    className={cx('flex flex-col items-center gap-1 rounded-xl border px-1.5 py-2.5 text-center text-[11.5px] font-medium leading-tight transition',
                      categoryId === c.id ? 'border-accent bg-accent/10 text-ink' : 'border-line text-muted hover:border-accent/40 hover:text-ink')}>
                    <Icon name={c.icon} size={18} className={categoryId === c.id ? 'text-forest' : ''} />
                    <span className="line-clamp-2">{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={kind === 'transfer' ? 'From' : kind === 'income' ? 'Into account' : 'Paid with'}>
              {(id) => (
                <select id={id} className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">Choose…</option>
                  {(kind === 'expense' ? expenseAccounts : assetAccounts).map((a) => <option key={a.id} value={a.id}>{a.name}{a.type === 'credit' ? ' (credit)' : ''}</option>)}
                </select>
              )}
            </Field>
            {kind === 'transfer' && (
              <Field label="To">
                {(id) => (
                  <select id={id} className="input" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                    <option value="">Choose…</option>
                    {state.accounts.filter((a) => a.id !== accountId && a.status !== 'closed').map((a) => <option key={a.id} value={a.id}>{a.name}{a.status === 'planned' ? ' (planned)' : ''}</option>)}
                  </select>
                )}
              </Field>
            )}
            {kind === 'income' && (
              <Field label="Type">
                {(id) => (
                  <select id={id} className="input" value={incomeType} onChange={(e) => setIncomeType(e.target.value as IncomeType)}>
                    <option value="other">Other income</option><option value="bonus">Bonus</option><option value="thirteenth_month">13th-month pay</option>
                    <option value="final_pay">Final pay</option><option value="dividend">Dividend</option>
                    {editing?.incomeType === 'salary' && <option value="salary">Salary</option>}
                  </select>
                )}
              </Field>
            )}
            <Field label="Date & time">{(id) => <input id={id} type="datetime-local" className="input" value={datetime} onChange={(e) => setDatetime(e.target.value)} />}</Field>
          </div>

          {kind === 'income' && !editing && <p className="text-[12.5px] text-muted">For your Oracle salary, use <b>Payday</b> — it records the salary once and builds your checklist.</p>}
          {kind === 'transfer' && toAcc?.status === 'planned' && <Notice tone="warn">{toAcc.name} is still planned. Recording this transfer will mark it as active.</Notice>}
          {isCardPayment && <Notice>Card payments reduce what you owe and your bank cash. They aren't counted as spending — the purchases already were.</Notice>}
          {acc?.type === 'credit' && kind === 'expense' && <p className="text-[12.5px] text-muted">Charged to {acc.name}: increases what you owe, and counts toward this category.</p>}

          {kind === 'expense' && categoryId === 'travel' && state.trips.length > 0 && (
            <Field label="Trip">
              {(id) => (
                <select id={id} className="input" value={tripId} onChange={(e) => setTripId(e.target.value)}>
                  <option value="">Not linked to a trip</option>
                  {state.trips.map((t) => <option key={t.id} value={t.id}>{t.destination}</option>)}
                </select>
              )}
            </Field>
          )}

          <button type="button" className="flex items-center gap-1 text-[13px] font-semibold text-muted hover:text-ink" onClick={() => setMore((v) => !v)} aria-expanded={more}>
            <Icon name="ChevronDown" size={15} className={cx('transition', more && 'rotate-180')} /> Notes & options
          </button>
          {more && (
            <div className="space-y-3">
              <Field label="Notes (optional)">{(id) => <textarea id={id} rows={2} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
              <label className="flex items-center gap-2 text-[14px]">
                <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={pending} onChange={(e) => setPending(e.target.checked)} />
                Pending — not yet cleared (won't change balances until confirmed)
              </label>
              {editing && editing.history.length > 0 && (
                <div className="rounded-xl bg-sunken p-3 text-[12.5px] text-muted">
                  <div className="mb-1 flex items-center gap-1.5 font-semibold text-ink"><Icon name="History" size={14} /> History</div>
                  {editing.history.map((h, i) => (
                    <div key={i}>{relativeDay(h.at)} {timeLabel(h.at)} — {h.action}{h.before ? `: ${Object.entries(h.before).map(([k, v]) => `${k} was ${k === 'amount' ? peso(v as number) : String(v ?? '—')}`).join(', ')}` : ''}{h.note ? ` (${h.note})` : ''}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <Notice tone={dupOk ? 'warn' : 'danger'}>{error}</Notice>}
          <button type="submit" hidden />
        </form>
      </Modal>
      {confirmDialog}
    </>
  );
}
