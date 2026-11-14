import type { AppState } from './types';
import type { Cents } from './money';
import { dayDiff, thisMonth, today } from './date';
import { accountBalance, budgetRows, salaryForMonth } from './ledger';

export interface Upcoming { id: string; title: string; date: string; amount: Cents | null; kind: 'subscription' | 'card' | 'payday'; route: string }

/** Bills & renewals in the next `days` days (and anything overdue). */
export function upcoming(s: AppState, days = 14): Upcoming[] {
  const t = today();
  const out: Upcoming[] = [];
  for (const sub of s.subscriptions) {
    if (!sub.active) continue;
    if (dayDiff(t, sub.nextRenewal) <= days) out.push({ id: sub.id, title: sub.name, date: sub.nextRenewal, amount: sub.amount, kind: 'subscription', route: 'subscriptions' });
  }
  for (const a of s.accounts) {
    if (a.type !== 'credit' || a.status !== 'active' || !a.dueDate) continue;
    const owed = accountBalance(s, a.id);
    if (owed > 0 && dayDiff(t, a.dueDate) <= days) out.push({ id: a.id, title: `${a.name} payment`, date: a.dueDate, amount: Math.min(owed, a.statementBalance || owed), kind: 'card', route: 'cards' });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export interface Attention { id: string; message: string; route: string; tone: 'info' | 'warn' }

export function attention(s: AppState): Attention[] {
  const out: Attention[] = [];
  const m = thisMonth();
  const day = Number(today().slice(8, 10));
  const pd = s.paydays.find((p) => p.month === m);
  if (!salaryForMonth(s, m) && day >= s.settings.payDay - 3) out.push({ id: 'payday', message: 'Has your salary arrived? Confirm it to start the payday checklist.', route: 'payday', tone: 'info' });
  else if (pd && !pd.completedAt) out.push({ id: 'payday-open', message: `${pd.items.filter((i) => !i.done).length} payday allocations still to do.`, route: 'payday', tone: 'info' });
  for (const a of s.accounts) if (a.status === 'active' && !a.balanceConfirmed) out.push({ id: `confirm-${a.id}`, message: `Confirm the current balance of ${a.name}.`, route: 'accounts', tone: 'warn' });
  for (const r of budgetRows(s, m)) {
    const name = s.categories.find((c) => c.id === r.categoryId)?.name ?? '';
    if (r.budget > 0 && r.pct >= 100) out.push({ id: `b-${r.categoryId}`, message: `You've reached this month's ${name.toLowerCase()} budget.`, route: 'budgets', tone: 'warn' });
  }
  for (const u of upcoming(s, 3)) out.push({ id: `u-${u.id}`, message: `${u.title} ${dayDiff(today(), u.date) < 0 ? 'was due' : 'is due'} ${u.date === today() ? 'today' : u.date}.`, route: u.route, tone: dayDiff(today(), u.date) < 0 ? 'warn' : 'info' });
  return out;
}
