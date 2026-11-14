import type { Account, AllocationLine, AppState, Payday, Trade, Transaction } from './types';
import type { Cents } from './money';
import { addPeriod, monthOf, nowLocal, today } from './date';
import { accountBalance, accountById, isCredit, planForMonth, salaryForMonth } from './ledger';

/**
 * State mutations. Each takes a *draft* (already cloned) state and mutates it.
 * Throwing an Error aborts the commit and the message is shown to you.
 */

export const uid = (p = '') => p + (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, '').slice(0, 16);

export type TxnInput = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'history' | 'status'> & { status?: Transaction['status'] };

export function validateTxn(s: AppState, t: TxnInput) {
  if (!Number.isInteger(t.amount)) throw new Error('Amount must be in whole centavos.');
  if (t.kind !== 'adjustment' && t.amount <= 0) throw new Error('Amount must be greater than zero.');
  const acc = accountById(s, t.accountId);
  if (!acc) throw new Error('Choose an account.');
  if (acc.status === 'closed') throw new Error(`${acc.name} is closed.`);
  if (t.kind === 'transfer') {
    if (!t.toAccountId) throw new Error('Choose where the money is going.');
    if (t.toAccountId === t.accountId) throw new Error('A transfer needs two different accounts.');
  }
  if (t.kind === 'expense' && !t.categoryId) throw new Error('Choose a category.');
  if (t.kind === 'income' && isCredit(acc)) throw new Error('Income can\'t be received into a credit card.');
}

export function addTxn(s: AppState, input: TxnInput, note?: string): Transaction {
  validateTxn(s, input);
  if (input.kind === 'income' && input.incomeType === 'salary') {
    const month = input.payMonth ?? monthOf(input.datetime);
    if (salaryForMonth(s, month)) throw new Error(`Salary for ${month} is already recorded. Edit that entry instead of adding another.`);
    input.payMonth = month;
  }
  const now = nowLocal();
  const t: Transaction = { status: 'cleared', ...input, id: uid('t_'), createdAt: now, updatedAt: now, history: [{ at: now, action: 'created', note }] };
  s.transactions.push(t);
  return t;
}

const AUDITED: (keyof Transaction)[] = ['kind', 'amount', 'datetime', 'accountId', 'toAccountId', 'categoryId', 'merchant', 'notes', 'status', 'tripId'];

export function editTxn(s: AppState, id: string, patch: Partial<Transaction>) {
  const t = s.transactions.find((x) => x.id === id);
  if (!t) throw new Error('Transaction not found.');
  const before: Partial<Transaction> = {};
  for (const k of AUDITED) if (k in patch && patch[k] !== t[k]) (before as Record<string, unknown>)[k] = t[k];
  if (!Object.keys(before).length) return t;
  const next = { ...t, ...patch };
  validateTxn(s, next as TxnInput);
  if (next.kind === 'income' && next.incomeType === 'salary') {
    const dup = s.transactions.find((x) => !x.deletedAt && x.id !== id && x.kind === 'income' && x.incomeType === 'salary' && x.payMonth === next.payMonth);
    if (dup) throw new Error('Another salary entry exists for that month.');
  }
  Object.assign(t, patch, { updatedAt: nowLocal() });
  t.history.push({ at: nowLocal(), action: 'edited', before });
  return t;
}

export function deleteTxn(s: AppState, id: string) {
  const t = s.transactions.find((x) => x.id === id);
  if (!t || t.deletedAt) return;
  t.deletedAt = nowLocal();
  t.history.push({ at: t.deletedAt, action: 'deleted' });
  // Keep linked records consistent
  if (t.paydayId) {
    const pd = s.paydays.find((p) => p.id === t.paydayId);
    if (pd && pd.salaryTxnId === t.id) {
      // Removing the salary removes that month's checklist and the transfers it created.
      for (const i of pd.items) if (i.txnId) {
        const x = s.transactions.find((y) => y.id === i.txnId);
        if (x && !x.deletedAt) { x.deletedAt = t.deletedAt; x.history.push({ at: t.deletedAt, action: 'deleted', note: 'Salary entry removed' }); }
      }
      s.paydays = s.paydays.filter((p) => p.id !== pd.id);
    } else {
      const item = pd?.items.find((i) => i.txnId === t.id);
      if (item && pd) { item.done = false; item.txnId = undefined; item.doneAt = undefined; pd.completedAt = undefined; }
    }
  }
  if (t.tradeId) s.trades = s.trades.filter((x) => x.id !== t.tradeId);
  for (const w of s.wishlist) if (w.purchaseTxnId === t.id) { w.purchaseTxnId = undefined; w.status = 'saving'; }
  for (const r of s.rewards) if (r.redeemedTxnId === t.id) { r.redeemedTxnId = undefined; r.redeemedAt = undefined; }
  for (const e of s.expectedIncome) {
    if (e.receivedTxnId === t.id) { e.receivedTxnId = undefined; e.status = 'pending'; }
    for (const o of e.obligations) if (o.paidTxnId === t.id) o.paidTxnId = undefined;
  }
}

export function restoreTxn(s: AppState, id: string) {
  const t = s.transactions.find((x) => x.id === id);
  if (!t || !t.deletedAt) return;
  if (t.kind === 'income' && t.incomeType === 'salary' && s.transactions.some((x) => !x.deletedAt && x.id !== id && x.incomeType === 'salary' && x.payMonth === t.payMonth))
    throw new Error('A salary for that month already exists, so this one can\'t be restored.');
  t.deletedAt = undefined;
  t.history.push({ at: nowLocal(), action: 'restored' });
  t.paydayId = t.paydayId && s.paydays.some((p) => p.id === t.paydayId) ? t.paydayId : undefined;
}

/* ─────────── Payday ─────────── */

export function confirmSalary(s: AppState, p: { month: string; amount: Cents; datetime: string; accountId: string; planId?: string }): Payday {
  if (s.paydays.some((x) => x.month === p.month)) throw new Error('This month\'s payday is already set up.');
  const plan = p.planId ? s.budgetPlans.find((x) => x.id === p.planId) : planForMonth(s, p.month);
  if (!plan) throw new Error(`There's no budget for ${p.month} yet. Create one first so Penny knows how to split your salary.`);
  const acc = accountById(s, p.accountId);
  if (acc?.status === 'planned') acc.status = 'active';
  const pdId = uid('pd_');
  const salary = addTxn(s, {
    kind: 'income', incomeType: 'salary', payMonth: p.month, amount: p.amount, datetime: p.datetime,
    accountId: p.accountId, merchant: `${s.settings.employer} salary`, paydayId: pdId, source: 'payday',
  });
  const pd: Payday = {
    id: pdId, month: p.month, salaryTxnId: salary.id, salaryAccountId: p.accountId, planId: plan.id, createdAt: nowLocal(),
    // Snapshot the plan: later plan edits never rewrite this month.
    items: plan.lines.map((l) => ({ ...l, id: uid('pi_'), done: false })),
  };
  s.paydays.push(pd);
  return pd;
}

export function setPaydayItem(s: AppState, paydayId: string, itemId: string, done: boolean) {
  const pd = s.paydays.find((p) => p.id === paydayId);
  const item = pd?.items.find((i) => i.id === itemId);
  if (!pd || !item) throw new Error('Checklist item not found.');
  if (item.done === done) return;
  if (done) {
    if (item.kind === 'transfer') {
      const to = accountById(s, item.toAccountId);
      if (!to) throw new Error('Pick a destination account for this transfer.');
      if (to.status === 'planned') { to.status = 'active'; to.openingDate = today(); }
      const t = addTxn(s, {
        kind: 'transfer', amount: item.amount, datetime: nowLocal(), accountId: pd.salaryAccountId, toAccountId: to.id,
        merchant: item.label, paydayId: pd.id, paydayItemId: item.id, source: 'payday',
      }, 'Payday checklist');
      item.txnId = t.id;
    }
    item.done = true;
    item.doneAt = nowLocal();
    if (pd.items.every((i) => i.done)) pd.completedAt = nowLocal();
  } else {
    if (item.txnId) {
      const t = s.transactions.find((x) => x.id === item.txnId);
      if (t && !t.deletedAt) { t.deletedAt = nowLocal(); t.history.push({ at: t.deletedAt, action: 'deleted', note: 'Unchecked on payday checklist' }); }
      item.txnId = undefined;
    }
    item.done = false;
    item.doneAt = undefined;
    pd.completedAt = undefined;
  }
}

export function editPaydayItem(s: AppState, paydayId: string, itemId: string, patch: Partial<AllocationLine>) {
  const pd = s.paydays.find((p) => p.id === paydayId);
  const item = pd?.items.find((i) => i.id === itemId);
  if (!pd || !item) throw new Error('Checklist item not found.');
  if (item.done && item.kind === 'transfer' && (patch.amount !== undefined || patch.toAccountId !== undefined))
    throw new Error('Uncheck this transfer before changing it.');
  Object.assign(item, patch);
}

export function addPaydayItem(s: AppState, paydayId: string, line: Omit<AllocationLine, 'id'>) {
  const pd = s.paydays.find((p) => p.id === paydayId);
  if (!pd) throw new Error('Payday not found.');
  pd.items.push({ ...line, id: uid('pi_'), done: false });
  pd.completedAt = undefined;
}

export function removePaydayItem(s: AppState, paydayId: string, itemId: string) {
  const pd = s.paydays.find((p) => p.id === paydayId);
  if (!pd) return;
  setPaydayItem(s, paydayId, itemId, false);
  pd.items = pd.items.filter((i) => i.id !== itemId);
  if (pd.items.length && pd.items.every((i) => i.done)) pd.completedAt = pd.completedAt ?? nowLocal();
}

/* ─────────── Budgets ─────────── */

/** Save lines for a month. Creates a new plan effective from that month unless one already starts there — earlier months stay untouched. */
export function savePlan(s: AppState, month: string, data: { name: string; lines: AllocationLine[]; expectedIncome: Cents; onlyMonth?: boolean; note?: string }) {
  const existing = s.budgetPlans.find((p) => p.effectiveFrom === month && !!p.onlyMonth === !!data.onlyMonth);
  if (existing) Object.assign(existing, data);
  else s.budgetPlans.push({ id: uid('plan_'), effectiveFrom: month, createdAt: nowLocal(), ...data });
}

/* ─────────── Accounts ─────────── */

export function reconcile(s: AppState, accountId: string, actual: Cents, note?: string) {
  const acc = accountById(s, accountId);
  if (!acc) throw new Error('Account not found.');
  const computed = accountBalance(s, accountId);
  const now = nowLocal();
  if (!acc.balanceConfirmed && !s.transactions.some((t) => (t.accountId === accountId || t.toAccountId === accountId) && !t.deletedAt)) {
    // First confirmation with no activity: set the opening balance itself.
    acc.initialBalance = actual;
  } else if (actual !== computed) {
    // Assets: + adds cash. Credit: an adjustment reduces "cash", i.e. increases what you owe.
    const diff = isCredit(acc) ? computed - actual : actual - computed;
    addTxn(s, { kind: 'adjustment', amount: diff, datetime: now, accountId, merchant: 'Balance reconciliation', notes: note, source: 'reconcile' }, `Reconciled to ${actual}`);
  }
  acc.balanceConfirmed = true;
  acc.lastReconciledAt = now;
}

export function upsertAccount(s: AppState, a: Account) {
  const i = s.accounts.findIndex((x) => x.id === a.id);
  if (i >= 0) s.accounts[i] = a; else s.accounts.push(a);
}

/* ─────────── Expected income ─────────── */

export function receiveExpected(s: AppState, id: string, amount: Cents, accountId: string, datetime: string) {
  const e = s.expectedIncome.find((x) => x.id === id);
  if (!e) throw new Error('Not found.');
  if (e.status === 'received') throw new Error('Already marked as received.');
  const acc = accountById(s, accountId);
  if (acc?.status === 'planned') acc.status = 'active';
  const t = addTxn(s, { kind: 'income', incomeType: e.incomeType, amount, datetime, accountId, merchant: e.name, expectedIncomeId: e.id });
  e.status = 'received';
  e.receivedTxnId = t.id;
}

export function payObligation(s: AppState, incomeId: string, obligationId: string, accountId: string, amount: Cents) {
  const e = s.expectedIncome.find((x) => x.id === incomeId);
  const o = e?.obligations.find((x) => x.id === obligationId);
  if (!e || !o) throw new Error('Not found.');
  if (o.paidTxnId) throw new Error('Already paid.');
  const t = addTxn(s, { kind: 'expense', amount, datetime: nowLocal(), accountId, categoryId: 'family', merchant: o.label, expectedIncomeId: e.id });
  o.paidTxnId = t.id;
}

/* ─────────── Subscriptions ─────────── */

export function paySubscription(s: AppState, subId: string) {
  const sub = s.subscriptions.find((x) => x.id === subId);
  if (!sub) throw new Error('Subscription not found.');
  addTxn(s, { kind: 'expense', amount: sub.amount, datetime: `${sub.nextRenewal}T12:00`, accountId: sub.accountId, categoryId: sub.categoryId, merchant: sub.name, subscriptionId: sub.id, source: 'subscription' });
  sub.nextRenewal = addPeriod(sub.nextRenewal, sub.frequency);
}

/* ─────────── Earmarks, rewards, wishlist ─────────── */

export function earmark(s: AppState, target: 'reward_fund' | { wishId: string }, amount: Cents, note?: string) {
  if (amount === 0) throw new Error('Enter an amount.');
  const d = today();
  s.earmarks.push({ id: uid('e_'), date: d, month: monthOf(d), amount, target, note });
}

/* ─────────── Investments ─────────── */

export function recordTrade(s: AppState, t: Omit<Trade, 'id' | 'ledgerTxnId'>) {
  const h = s.holdings.find((x) => x.id === t.holdingId);
  if (!h) throw new Error('Pick a holding.');
  if (t.kind !== 'dividend' && !(t.shares > 0)) throw new Error('Enter the number of shares.');
  if (t.kind === 'sell') {
    const held = s.trades.filter((x) => x.holdingId === h.id).reduce((a, x) => a + (x.kind === 'buy' ? x.shares : x.kind === 'sell' ? -x.shares : 0), 0);
    if (t.shares > held + 1e-9) throw new Error(`You only hold ${held} shares.`);
  }
  const trade: Trade = { ...t, id: uid('tr_') };
  if (t.cashAccountId) {
    const fx = h.currency === 'USD' ? t.fxRate : 1;
    const gross = t.kind === 'dividend' ? t.price : Math.round(t.shares * t.price) + (t.kind === 'buy' ? t.fees : -t.fees);
    const php = Math.round(gross * fx);
    const kind = t.kind === 'buy' ? 'invest_buy' : t.kind === 'sell' ? 'invest_sell' : 'income';
    const txn = addTxn(s, {
      kind, amount: php, datetime: `${t.date}T12:00`, accountId: t.cashAccountId, merchant: `${t.kind === 'dividend' ? 'Dividend' : t.kind === 'buy' ? 'Buy' : 'Sell'} ${h.symbol}`,
      incomeType: kind === 'income' ? 'dividend' : undefined, tradeId: trade.id, source: 'investment',
    });
    trade.ledgerTxnId = txn.id;
  }
  s.trades.push(trade);
}

export function deleteTrade(s: AppState, id: string) {
  const tr = s.trades.find((x) => x.id === id);
  if (!tr) return;
  if (tr.ledgerTxnId) {
    const t = s.transactions.find((x) => x.id === tr.ledgerTxnId);
    if (t && !t.deletedAt) { t.deletedAt = nowLocal(); t.history.push({ at: t.deletedAt, action: 'deleted', note: 'Trade removed' }); }
  }
  s.trades = s.trades.filter((x) => x.id !== id);
}
