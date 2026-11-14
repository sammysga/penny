import { useStore } from '../lib/store';
import { Icon } from './Icon';
import { Money, Progress, budgetTone, cx } from './ui';
import type { BudgetRow } from '../lib/ledger';
import { accountById } from '../lib/ledger';
import type { Transaction } from '../lib/types';
import { peso } from '../lib/money';
import { relativeDay, timeLabel } from '../lib/date';

export function CatIcon({ id, className }: { id?: string; className?: string }) {
  const { state } = useStore();
  const c = state.categories.find((x) => x.id === id);
  return (
    <div className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sunken text-forest', className)}>
      <Icon name={c?.icon ?? 'Circle'} size={17} />
    </div>
  );
}

export function budgetMessage(row: BudgetRow, name: string): string | null {
  if (row.budget <= 0) return null;
  if (row.pct >= 100) return name === 'Wants & shopping'
    ? 'You\'ve reached this month\'s shopping budget. Consider moving this purchase to next month.'
    : `You've reached this month's ${name.toLowerCase()} budget.`;
  if (row.pct >= 80) return `You've used ${Math.floor(row.pct)}% of your ${name.toLowerCase()} budget this month.`;
  return null;
}

export function BudgetLine({ row, onClick }: { row: BudgetRow; onClick?: () => void }) {
  const { state } = useStore();
  const c = state.categories.find((x) => x.id === row.categoryId);
  const msg = budgetMessage(row, c?.name ?? '');
  return (
    <button type="button" onClick={onClick} className="block w-full rounded-xl px-1 py-2 text-left transition hover:bg-sunken/60">
      <div className="flex items-center gap-3">
        <CatIcon id={row.categoryId} className="h-8 w-8" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[14px] font-medium">{c?.name}</span>
            <span className="num text-[13.5px] whitespace-nowrap">
              {row.budget > 0
                ? row.remaining >= 0 ? <><Money value={row.remaining} compact /> <span className="text-muted">left</span></> : <span className="text-danger">{peso(-row.remaining, { compact: true })} over</span>
                : <><Money value={row.spent} compact /> <span className="text-muted">unbudgeted</span></>}
            </span>
          </div>
          <Progress value={row.budget > 0 ? row.pct : 100} tone={row.budget > 0 ? budgetTone(row.pct) : 'sage'} thin className="mt-1.5"
            label={`${c?.name}: ${Math.round(row.pct)}% used`} />
          <div className="mt-1 flex justify-between text-[12px] text-muted">
            <span>{peso(row.spent, { compact: true })} of {peso(row.budget, { compact: true })}</span>
            {msg && <span className={cx('ml-2 truncate', row.pct >= 100 ? 'text-danger' : 'text-warn')}>{row.pct >= 100 ? 'Limit reached' : `${Math.floor(row.pct)}% used`}</span>}
          </div>
        </div>
      </div>
    </button>
  );
}

export function TxnRow({ t, showDate = true }: { t: Transaction; showDate?: boolean }) {
  const { state, openAdd } = useStore();
  const acc = accountById(state, t.accountId);
  const to = accountById(state, t.toAccountId);
  const cat = state.categories.find((c) => c.id === t.categoryId);
  const isOut = t.kind === 'expense' || t.kind === 'invest_buy' || (t.kind === 'adjustment' && t.amount < 0);
  const isIn = t.kind === 'income' || t.kind === 'refund' || t.kind === 'invest_sell' || (t.kind === 'adjustment' && t.amount > 0);
  const icon = t.kind === 'transfer' ? 'ArrowRightLeft' : t.kind === 'income' ? 'ArrowDownLeft' : t.kind === 'adjustment' ? 'Scale' : t.kind.startsWith('invest') ? 'LineChart' : undefined;
  const editable = !t.deletedAt && ['expense', 'income', 'transfer', 'refund'].includes(t.kind) && !t.tradeId && !(t.paydayId && t.kind === 'transfer');
  return (
    <button type="button" disabled={!editable} onClick={() => openAdd({ editId: t.id })}
      className={cx('flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition enabled:hover:bg-sunken/70', t.deletedAt && 'opacity-50')}>
      {icon ? <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sunken text-muted"><Icon name={icon} size={17} /></div> : <CatIcon id={t.categoryId} />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 truncate text-[14px] font-medium">
          <span className="truncate">{t.merchant}</span>
          {t.status === 'pending' && <span className="rounded-full bg-warn/10 px-1.5 text-[11px] font-semibold text-warn">Pending</span>}
        </div>
        <div className="truncate text-[12.5px] text-muted">
          {t.kind === 'transfer' ? `${acc?.name} → ${to?.name}` : t.kind === 'adjustment' ? `Reconciliation · ${acc?.name}` : `${cat?.name ?? (t.kind === 'income' ? 'Income' : t.kind)} · ${acc?.name}`}
          {showDate && ` · ${relativeDay(t.datetime)} ${timeLabel(t.datetime)}`}
        </div>
      </div>
      <div className={cx('num text-[14px] font-semibold whitespace-nowrap', isIn && 'text-good', t.kind === 'transfer' && 'text-muted')}>
        {isOut ? '−' : isIn ? '+' : ''}{peso(Math.abs(t.amount))}
      </div>
    </button>
  );
}
