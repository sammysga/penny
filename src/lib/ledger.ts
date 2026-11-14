import type { Account, AppState, BudgetPlan, Transaction } from './types';
import type { Cents } from './money';
import { addDays, daysInMonth, monthOf, thisMonth, today } from './date';
import { portfolioSummary } from './invest';

/**
 * Pure ledger functions. Rules enforced here (see README "Financial integrity"):
 *  1. Transfers move money between your accounts — never income or expense.
 *  3. Budget reservations live only in BudgetPlan/Payday; they never touch balances.
 *  4. Purchases reduce cash, or raise a credit card's outstanding balance.
 *  5. Card repayments are transfers (bank → card): they reduce cash and the liability, not spending.
 *  6/7. Pending transactions never change balances.
 *  8. Investments are valued separately from cash.
 *  9. Net worth = assets − liabilities.
 */

export const live = (s: AppState) => s.transactions.filter((t) => !t.deletedAt);
export const accountById = (s: AppState, id?: string) => s.accounts.find((a) => a.id === id);
export const accountByRole = (s: AppState, role: Account['role']) => s.accounts.find((a) => a.role === role && a.status !== 'closed');
export const isCredit = (a?: Account) => a?.type === 'credit';

/** Asset-style cash delta of a transaction for one account (+ = money in). */
export function cashDelta(t: Transaction, accountId: string): Cents {
  let d = 0;
  if (t.accountId === accountId) {
    switch (t.kind) {
      case 'income': case 'refund': case 'invest_sell': d += t.amount; break;
      case 'expense': case 'invest_buy': d -= t.amount; break;
      case 'transfer': d -= t.amount; break;
      case 'adjustment': d += t.amount; break; // signed
    }
  }
  if (t.kind === 'transfer' && t.toAccountId === accountId) d += t.amount;
  return d;
}

/**
 * Balance of an account from cleared transactions only.
 * Assets: cash on hand. Credit cards: outstanding amount owed (positive = you owe).
 */
export function accountBalance(s: AppState, accountId: string, opts: { asOf?: string; includePending?: boolean } = {}): Cents {
  const acc = accountById(s, accountId);
  if (!acc) return 0;
  let delta = 0;
  for (const t of live(s)) {
    if (!opts.includePending && t.status !== 'cleared') continue;
    if (opts.asOf && t.datetime.slice(0, 10) > opts.asOf) continue;
    if (t.accountId !== accountId && t.toAccountId !== accountId) continue;
    delta += cashDelta(t, accountId);
  }
  return isCredit(acc) ? acc.initialBalance - delta : acc.initialBalance + delta;
}

export const availableBalance = (s: AppState, a: Account) =>
  isCredit(a) ? (a.creditLimit ?? 0) - accountBalance(s, a.id) : accountBalance(s, a.id) - a.holdAmount;

/** Plan in force for a month. One-month plans (holiday) win; otherwise the latest plan starting on/before the month. */
export function planForMonth(s: AppState, month: string): BudgetPlan | null {
  const exact = s.budgetPlans.find((p) => p.onlyMonth && p.effectiveFrom === month);
  if (exact) return exact;
  const candidates = s.budgetPlans
    .filter((p) => !p.onlyMonth && p.effectiveFrom <= month)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return candidates[0] ?? null;
}

export const planTotal = (p: BudgetPlan) => p.lines.reduce((a, l) => a + l.amount, 0);

/** Budget lines for a month: the payday snapshot if salary was confirmed (actual amounts), else the plan. */
export function linesForMonth(s: AppState, month: string) {
  const pd = s.paydays.find((p) => p.month === month);
  if (pd) return pd.items;
  return planForMonth(s, month)?.lines ?? null;
}

export function categoryBudgets(s: AppState, month: string): { byCategory: Record<string, Cents>; buffer: Cents; total: Cents } | null {
  const lines = linesForMonth(s, month);
  if (!lines) return null;
  const byCategory: Record<string, Cents> = {};
  let buffer = 0;
  for (const l of lines) {
    if (l.kind !== 'reservation') continue;
    if (l.categoryId) byCategory[l.categoryId] = (byCategory[l.categoryId] ?? 0) + l.amount;
    else buffer += l.amount;
  }
  const total = Object.values(byCategory).reduce((a, b) => a + b, 0) + buffer;
  return { byCategory, buffer, total };
}

/** Net spending per category for a month (expenses − refunds − earmarked portions). Pending purchases count: the money is committed. */
export function spentByCategory(s: AppState, month: string): Record<string, Cents> {
  const out: Record<string, Cents> = {};
  for (const t of live(s)) {
    if (monthOf(t.datetime) !== month || !t.categoryId) continue;
    if (t.kind === 'expense') out[t.categoryId] = (out[t.categoryId] ?? 0) + t.amount - (t.earmarkUse ?? 0);
    else if (t.kind === 'refund') out[t.categoryId] = (out[t.categoryId] ?? 0) - t.amount;
  }
  // Money set aside from Wants into the reward fund / wishlist counts as used Wants budget.
  const ear = s.earmarks.filter((e) => e.month === month).reduce((a, e) => a + e.amount, 0);
  if (ear) out.wants = (out.wants ?? 0) + ear;
  return out;
}

/** Gross spending (for charts) — what you actually paid this month in spending categories. */
export function grossSpending(s: AppState, month: string): Cents {
  const spending = new Set(s.categories.filter((c) => c.countsAsSpending).map((c) => c.id));
  return live(s).filter((t) => monthOf(t.datetime) === month && t.categoryId && spending.has(t.categoryId))
    .reduce((a, t) => a + (t.kind === 'expense' ? t.amount : t.kind === 'refund' ? -t.amount : 0), 0);
}

export interface BudgetRow { categoryId: string; budget: Cents; spent: Cents; remaining: Cents; pct: number }

export function budgetRows(s: AppState, month: string): BudgetRow[] {
  const b = categoryBudgets(s, month);
  const spent = spentByCategory(s, month);
  const ids = new Set<string>([...Object.keys(b?.byCategory ?? {}), ...Object.keys(spent).filter((k) => spent[k] !== 0)]);
  return s.categories
    .filter((c) => ids.has(c.id) && c.countsAsSpending)
    .map((c) => {
      const budget = b?.byCategory[c.id] ?? 0;
      const sp = spent[c.id] ?? 0;
      return { categoryId: c.id, budget, spent: sp, remaining: budget - sp, pct: budget > 0 ? (sp / budget) * 100 : sp > 0 ? 100 : 0 };
    });
}

/**
 * Available to spend this month = all spending reservations (incl. buffer) − all spending so far.
 * Overspending in one category honestly reduces the total. Returns null if there's no budget for the month.
 */
export function availableToSpend(s: AppState, month = thisMonth()) {
  const b = categoryBudgets(s, month);
  if (!b) return null;
  const spending = new Set(s.categories.filter((c) => c.countsAsSpending).map((c) => c.id));
  const spentMap = spentByCategory(s, month);
  const spent = Object.entries(spentMap).filter(([k]) => spending.has(k)).reduce((a, [, v]) => a + v, 0);
  const remaining = b.total - spent;
  const isCurrent = month === thisMonth();
  const daysLeft = isCurrent ? daysInMonth(month) - Number(today().slice(8, 10)) + 1 : daysInMonth(month);
  return { budget: b.total, spent, remaining, daysLeft, perDay: remaining > 0 ? Math.floor(remaining / daysLeft) : 0 };
}

export function activeAccounts(s: AppState) { return s.accounts.filter((a) => a.status === 'active'); }

export function totals(s: AppState) {
  let cash = 0, liabilities = 0, savings = 0, spendable = 0;
  for (const a of activeAccounts(s)) {
    const bal = accountBalance(s, a.id);
    if (isCredit(a)) { liabilities += bal; continue; }
    cash += bal;
    if (['main_savings', 'emergency', 'travel', 'investment_cash'].includes(a.role)) savings += bal;
    if (['salary', 'spending'].includes(a.role)) spendable += bal;
  }
  const inv = portfolioSummary(s);
  const pendingIncome = s.expectedIncome.filter((e) => e.status === 'pending').reduce((a, e) => a + (e.expectedAmount ?? 0), 0);
  return { cash, liabilities, savings, spendable, investments: inv.valuePhp, netWorth: cash + inv.valuePhp - liabilities, pendingIncome };
}

/** Net worth at the end of a month (cash − cards; investments at cost since past prices aren't stored). */
export function netWorthAt(s: AppState, date: string): Cents {
  let nw = 0;
  for (const a of s.accounts) {
    if (a.status === 'planned' || a.openingDate > date) continue;
    const bal = accountBalance(s, a.id, { asOf: date });
    nw += isCredit(a) ? -bal : bal;
  }
  return nw;
}

/** Transfers into an account per month (savings contributions). Withdrawals reported separately. */
export function flowsForAccount(s: AppState, accountId: string, month?: string) {
  let inflow = 0, outflow = 0;
  for (const t of live(s)) {
    if (t.status !== 'cleared') continue;
    if (month && monthOf(t.datetime) !== month) continue;
    if (t.kind === 'transfer' && t.toAccountId === accountId) inflow += t.amount;
    else if (t.accountId === accountId && (t.kind === 'transfer' || t.kind === 'expense' || t.kind === 'invest_buy')) outflow += t.amount;
  }
  return { inflow, outflow };
}

export function contributionsByMonth(s: AppState, accountId: string): Record<string, Cents> {
  const out: Record<string, Cents> = {};
  for (const t of live(s)) {
    if (t.status === 'cleared' && t.kind === 'transfer' && t.toAccountId === accountId) {
      const m = monthOf(t.datetime);
      out[m] = (out[m] ?? 0) + t.amount;
    }
  }
  return out;
}

export function incomeForMonth(s: AppState, month: string): Cents {
  return live(s).filter((t) => t.kind === 'income' && t.status === 'cleared' && monthOf(t.datetime) === month).reduce((a, t) => a + t.amount, 0);
}

export const salaryForMonth = (s: AppState, month: string) =>
  live(s).find((t) => t.kind === 'income' && t.incomeType === 'salary' && t.payMonth === month);

/** Possible duplicate: same kind, amount & account within 10 minutes. */
export function findDuplicate(s: AppState, t: Pick<Transaction, 'kind' | 'amount' | 'accountId' | 'datetime'>, ignoreId?: string) {
  const ts = Date.parse(t.datetime + ':00Z');
  return live(s).find((x) => x.id !== ignoreId && x.kind === t.kind && x.amount === t.amount && x.accountId === t.accountId
    && Math.abs(Date.parse(x.datetime + ':00Z') - ts) <= 10 * 60_000);
}

/** Days (YYYY-MM-DD) with tracking activity: any logged expense, or a "nothing spent" check-in. */
export function trackingDays(s: AppState): Set<string> {
  const days = new Set<string>();
  for (const t of live(s)) if (t.kind === 'expense' && t.source !== 'payday') days.add(t.createdAt.slice(0, 10));
  for (const c of s.checkInLog) if (c.response === 'nothing' || c.response === 'logged') days.add(c.at.slice(0, 10));
  return days;
}

export function trackingStreak(s: AppState): number {
  const days = trackingDays(s);
  let d = today();
  if (!days.has(d)) d = addDays(d, -1); // today isn't over yet
  let n = 0;
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

export function bestTrackingStreak(s: AppState): number {
  const days = [...trackingDays(s)].sort();
  let best = 0, run = 0, prev = '';
  for (const d of days) { run = prev && addDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  return best;
}

/** Consecutive months (ending this or last month) with a contribution into main savings. */
export function savingsStreak(s: AppState): number {
  const main = accountByRole(s, 'main_savings');
  if (!main) return 0;
  const by = contributionsByMonth(s, main.id);
  let m = thisMonth();
  const prev = (x: string) => { const [y, mo] = x.split('-').map(Number); return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`; };
  if (!by[m]) m = prev(m);
  let n = 0;
  while (by[m] > 0) { n++; m = prev(m); }
  return n;
}

/** Credit card payments recorded in Penny (transfers into the card) plus pre-Penny legacy payments. */
export function cardPayments(s: AppState, card: Account) {
  const ledger = live(s).filter((t) => t.kind === 'transfer' && t.toAccountId === card.id)
    .map((t) => ({ id: t.id, date: t.datetime.slice(0, 10), amount: t.amount, note: `From ${accountById(s, t.accountId)?.name ?? 'account'}`, legacy: false, status: t.status }));
  const legacy = (card.legacyPayments ?? []).map((p) => ({ ...p, legacy: true, status: 'cleared' as const }));
  return [...ledger, ...legacy].sort((a, b) => b.date.localeCompare(a.date));
}

/** Reward fund = earmarks to the reward fund − earmarked portion used by redemptions. */
export function rewardFundBalance(s: AppState): Cents {
  const added = s.earmarks.filter((e) => e.target === 'reward_fund').reduce((a, e) => a + e.amount, 0);
  const used = live(s).filter((t) => t.rewardId).reduce((a, t) => a + (t.earmarkUse ?? 0), 0);
  return added - used;
}

export function wishSaved(s: AppState, wishId: string): Cents {
  const added = s.earmarks.filter((e) => typeof e.target === 'object' && e.target.wishId === wishId).reduce((a, e) => a + e.amount, 0);
  const used = live(s).filter((t) => t.wishId === wishId).reduce((a, t) => a + (t.earmarkUse ?? 0), 0);
  return added - used;
}

export function tripSpent(s: AppState, tripId: string): Cents {
  return live(s).filter((t) => t.tripId === tripId).reduce((a, t) => a + (t.kind === 'expense' ? t.amount : t.kind === 'refund' ? -t.amount : 0), 0);
}

export function monthlySubscriptionCost(amount: Cents, freq: string): Cents {
  switch (freq) {
    case 'weekly': return Math.round((amount * 52) / 12);
    case 'quarterly': return Math.round(amount / 3);
    case 'yearly': return Math.round(amount / 12);
    default: return amount;
  }
}
