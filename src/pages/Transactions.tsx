import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { Button, Card, Empty, PageHeader, Segmented } from '../components/ui';
import { Icon } from '../components/Icon';
import { TxnRow } from '../components/bits';
import { dateLabel, monthLabel, relativeDay, thisMonth } from '../lib/date';
import { peso } from '../lib/money';
import { restoreTxn } from '../lib/actions';
import { download, transactionsCsv } from '../lib/csv';

export default function Transactions() {
  const { state, commit, openAdd } = useStore();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'all' | 'expense' | 'income' | 'transfer'>('all');
  const [month, setMonth] = useState<string>(thisMonth());
  const [cat, setCat] = useState('');
  const [acc, setAcc] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);

  const months = useMemo(() => [...new Set([thisMonth(), ...state.transactions.map((t) => t.datetime.slice(0, 7))])].sort().reverse(), [state.transactions]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return state.transactions
      .filter((t) => (showDeleted ? !!t.deletedAt : !t.deletedAt))
      .filter((t) => month === 'all' || t.datetime.startsWith(month))
      .filter((t) => kind === 'all' || t.kind === kind || (kind === 'expense' && t.kind === 'refund'))
      .filter((t) => !cat || t.categoryId === cat)
      .filter((t) => !acc || t.accountId === acc || t.toAccountId === acc)
      .filter((t) => !needle || [t.merchant, t.notes, state.categories.find((c) => c.id === t.categoryId)?.name, peso(t.amount)].some((x) => x?.toLowerCase().includes(needle)))
      .sort((a, b) => b.datetime.localeCompare(a.datetime));
  }, [state, q, kind, month, cat, acc, showDeleted]);

  const groups = useMemo(() => {
    const g = new Map<string, typeof list>();
    for (const t of list) { const d = t.datetime.slice(0, 10); g.set(d, [...(g.get(d) ?? []), t]); }
    return [...g.entries()];
  }, [list]);

  const spent = list.filter((t) => t.kind === 'expense').reduce((a, t) => a + t.amount, 0);
  const income = list.filter((t) => t.kind === 'income').reduce((a, t) => a + t.amount, 0);

  return (
    <div>
      <PageHeader title="Transactions" subtitle="Everything you've logged — searchable, editable and fully audited."
        actions={<>
          <Button variant="secondary" icon="Download" onClick={() => download(`penny-transactions-${thisMonth()}.csv`, transactionsCsv(state), 'text/csv')}>CSV</Button>
          <Button icon="Plus" onClick={() => openAdd({ kind: 'expense' })}>Add</Button>
        </>} />

      <Card className="mb-4 !p-4">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Icon name="Search" size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input aria-label="Search transactions" className="input pl-10" placeholder="Search merchant, notes, category, amount…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented size="sm" label="Type" value={kind} onChange={setKind} options={[{ value: 'all', label: 'All' }, { value: 'expense', label: 'Spending' }, { value: 'income', label: 'Income' }, { value: 'transfer', label: 'Transfers' }]} />
            <select aria-label="Month" className="input !w-auto !py-1.5 text-[13.5px]" value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="all">All time</option>
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
            <select aria-label="Category" className="input !w-auto !py-1.5 text-[13.5px]" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">All categories</option>
              {state.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select aria-label="Account" className="input !w-auto !py-1.5 text-[13.5px]" value={acc} onChange={(e) => setAcc(e.target.value)}>
              <option value="">All accounts</option>
              {state.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <label className="ml-auto flex items-center gap-2 text-[13px] text-muted">
              <input type="checkbox" className="accent-[rgb(var(--accent))]" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} /> Deleted
            </label>
          </div>
        </div>
      </Card>

      {list.length > 0 && !showDeleted && (
        <div className="mb-3 flex gap-4 px-1 text-[13px] text-muted">
          <span>{list.length} transactions</span><span>Spent <b className="num text-ink">{peso(spent)}</b></span>{income > 0 && <span>Income <b className="num text-ink">{peso(income)}</b></span>}
        </div>
      )}

      {list.length === 0 ? (
        <Card><Empty icon="Receipt" title={showDeleted ? 'Nothing deleted' : 'No transactions here yet'} body={showDeleted ? 'Deleted transactions keep their history and can be restored.' : 'Log an expense in seconds with the + button. Transfers and salary appear here too.'}
          action={!showDeleted && <Button icon="Plus" onClick={() => openAdd({ kind: 'expense' })}>Add expense</Button>} /></Card>
      ) : (
        <div className="space-y-4">
          {groups.map(([d, ts]) => (
            <Card key={d} className="!p-3 sm:!p-4">
              <div className="mb-1 flex justify-between px-2 text-[12.5px] font-semibold text-muted">
                <span>{relativeDay(d) === dateLabel(d) || relativeDay(d) === dateLabel(d, { year: true }) ? dateLabel(d, { weekday: true }) : `${relativeDay(d)} · ${dateLabel(d)}`}</span>
                <span className="num">{peso(ts.filter((t) => t.kind === 'expense').reduce((a, t) => a + t.amount, 0))}</span>
              </div>
              {ts.map((t) => (
                <div key={t.id} className="flex items-center">
                  <div className="min-w-0 flex-1"><TxnRow t={t} showDate={false} /></div>
                  {t.deletedAt && <Button size="sm" variant="secondary" onClick={() => commit('Transaction restored', (s) => restoreTxn(s, t.id))}>Restore</Button>}
                </div>
              ))}
            </Card>
          ))}
        </div>
      )}
      <p className="mt-6 text-center text-[12.5px] text-muted">Tap any entry to edit it. Every change is kept in its history. Payday transfers are managed from the checklist.</p>
    </div>
  );
}
