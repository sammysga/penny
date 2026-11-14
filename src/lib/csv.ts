import type { AppState } from './types';
import { toDecimalString } from './money';
import { accountById } from './ledger';

const esc = (v: unknown) => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function transactionsCsv(s: AppState): string {
  const head = ['id', 'date', 'time', 'type', 'amount_php', 'account', 'to_account', 'category', 'merchant', 'notes', 'status', 'income_type', 'deleted'];
  const rows = [...s.transactions].sort((a, b) => a.datetime.localeCompare(b.datetime)).map((t) => [
    t.id, t.datetime.slice(0, 10), t.datetime.slice(11, 16), t.kind, toDecimalString(t.amount),
    accountById(s, t.accountId)?.name, accountById(s, t.toAccountId)?.name ?? '',
    s.categories.find((c) => c.id === t.categoryId)?.name ?? '', t.merchant, t.notes ?? '', t.status, t.incomeType ?? '', t.deletedAt ? 'yes' : '',
  ]);
  return [head, ...rows].map((r) => r.map(esc).join(',')).join('\n');
}

export function download(filename: string, content: string, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
