import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState } from './seed';
import { parseMoney, peso, toDecimalString } from './money';
import { setNow } from './date';
import * as A from './actions';
import * as L from './ledger';
import { mainSavings, monthsToReach, reachMonth, requiredMonthly } from './projections';
import { holdingStats } from './invest';
import { savePlan } from './actions';
import { januaryPlan } from './seed';
import type { AppState } from './types';
import { migrate } from './storage';

let s: AppState;
const at = (iso: string) => setNow(new Date(iso));

beforeEach(() => {
  at('2026-11-13T02:00:00Z'); // 10:00 Manila
  s = createInitialState();
  A.reconcile(s, 'acc_bpi_savings', 2_000_000); // confirm ₱20,000 opening cash
});

describe('money', () => {
  it('parses to exact centavos', () => {
    expect(parseMoney('42,963.56')).toBe(4_296_356);
    expect(parseMoney('₱0.1')).toBe(10);
    expect(parseMoney('9954.74')).toBe(995_474);
    expect(parseMoney('0.005')).toBe(1);
    expect(parseMoney('1.234')).toBe(123);
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('')).toBeNull();
  });
  it('formats', () => {
    expect(peso(4_296_356)).toBe('₱42,963.56');
    expect(peso(-150)).toBe('−₱1.50');
    expect(toDecimalString(5)).toBe('0.05');
  });
  it('January plan totals exactly the observed take-home', () => {
    expect(L.planTotal(januaryPlan(''))).toBe(4_296_356);
  });
});

describe('starting position', () => {
  it('protected savings is ₱50,000, not ₱91,000', () => {
    expect(mainSavings(s)).toBe(5_000_000);
  });
  it('the already-paid Maya bill is not deducted again', () => {
    const card = L.accountById(s, 'acc_maya_black')!;
    expect(L.accountBalance(s, card.id)).toBe(0);
    expect(L.availableBalance(s, card)).toBe(1_000_000);
    expect(L.totals(s).cash).toBe(7_000_000);
    expect(L.cardPayments(s, card)[0].legacy).toBe(true);
  });
  it('pending income is excluded from cash and net worth', () => {
    const t = L.totals(s);
    expect(t.pendingIncome).toBe(6_937_745);
    expect(t.netWorth).toBe(7_000_000);
  });
});

describe('ledger rules', () => {
  it('transfers are neither income nor expense', () => {
    A.addTxn(s, { kind: 'transfer', amount: 1_000_000, datetime: '2026-11-13T10:00', accountId: 'acc_bpi_savings', toAccountId: 'acc_passbook', merchant: 'Save' });
    expect(L.accountBalance(s, 'acc_bpi_savings')).toBe(1_000_000);
    expect(mainSavings(s)).toBe(6_000_000);
    expect(L.totals(s).netWorth).toBe(7_000_000);
    expect(L.incomeForMonth(s, '2026-11')).toBe(0);
    expect(L.grossSpending(s, '2026-11')).toBe(0);
  });
  it('pending transactions do not change balances', () => {
    A.addTxn(s, { kind: 'transfer', status: 'pending', amount: 500_000, datetime: '2026-11-13T10:00', accountId: 'acc_bpi_savings', toAccountId: 'acc_passbook', merchant: 'x' });
    expect(L.accountBalance(s, 'acc_bpi_savings')).toBe(2_000_000);
  });
  it('credit card purchase raises liability; repayment does not double-count spending', () => {
    A.addTxn(s, { kind: 'expense', amount: 120_000, datetime: '2026-11-13T10:00', accountId: 'acc_maya_black', categoryId: 'skincare', merchant: 'Skincare' });
    expect(L.accountBalance(s, 'acc_maya_black')).toBe(120_000);
    expect(L.totals(s).netWorth).toBe(7_000_000 - 120_000);
    expect(L.spentByCategory(s, '2026-11').skincare).toBe(120_000);
    A.addTxn(s, { kind: 'transfer', amount: 120_000, datetime: '2026-11-14T10:00', accountId: 'acc_bpi_savings', toAccountId: 'acc_maya_black', merchant: 'Pay card' });
    expect(L.accountBalance(s, 'acc_maya_black')).toBe(0);
    expect(L.accountBalance(s, 'acc_bpi_savings')).toBe(2_000_000 - 120_000);
    expect(L.spentByCategory(s, '2026-11').skincare).toBe(120_000);
    expect(L.grossSpending(s, '2026-11')).toBe(120_000);
    expect(L.totals(s).netWorth).toBe(7_000_000 - 120_000);
  });
  it('reconciliation posts an auditable adjustment', () => {
    A.reconcile(s, 'acc_bpi_savings', 1_950_050);
    expect(L.accountBalance(s, 'acc_bpi_savings')).toBe(1_950_050);
    const adj = s.transactions.find((t) => t.kind === 'adjustment')!;
    expect(adj.amount).toBe(-49_950);
    A.addTxn(s, { kind: 'expense', amount: 10_000, datetime: '2026-11-13T10:00', accountId: 'acc_maya_black', categoryId: 'food', merchant: 'c' });
    A.reconcile(s, 'acc_maya_black', 25_000);
    expect(L.accountBalance(s, 'acc_maya_black')).toBe(25_000);
  });
  it('edits are recorded in history; deletes are soft and restorable', () => {
    const t = A.addTxn(s, { kind: 'expense', amount: 25_000, datetime: '2026-11-13T10:00', accountId: 'acc_bpi_savings', categoryId: 'food', merchant: 'Coffee' });
    A.editTxn(s, t.id, { amount: 26_000 });
    expect(t.history.at(-1)!.before!.amount).toBe(25_000);
    A.deleteTxn(s, t.id);
    expect(L.accountBalance(s, 'acc_bpi_savings')).toBe(2_000_000);
    A.restoreTxn(s, t.id);
    expect(L.accountBalance(s, 'acc_bpi_savings')).toBe(2_000_000 - 26_000);
  });
});

describe('payday', () => {
  beforeEach(() => at('2027-01-15T04:00:00Z'));
  const pay = () => A.confirmSalary(s, { month: '2027-01', amount: 4_296_356, datetime: '2027-01-15T12:00', accountId: 'acc_bpi_savings' });

  it('salary is recognised once — duplicates are blocked', () => {
    pay();
    expect(() => pay()).toThrow();
    expect(() => A.addTxn(s, { kind: 'income', incomeType: 'salary', payMonth: '2027-01', amount: 1, datetime: '2027-01-16T10:00', accountId: 'acc_bpi_savings', merchant: 'x' })).toThrow(/already recorded/);
    expect(L.incomeForMonth(s, '2027-01')).toBe(4_296_356);
  });

  it('no plan for Nov/Dec 2026 — January plan is not applied backwards', () => {
    expect(L.planForMonth(s, '2026-11')).toBeNull();
    expect(L.planForMonth(s, '2026-12')).toBeNull();
    expect(() => A.confirmSalary(s, { month: '2026-12', amount: 1, datetime: '2026-12-15T12:00', accountId: 'acc_bpi_savings' })).toThrow(/no budget/);
  });

  it('transfers move money on check; reservations never touch balances', () => {
    const pd = pay();
    const start = L.accountBalance(s, 'acc_bpi_savings');
    expect(start).toBe(2_000_000 + 4_296_356);
    const food = pd.items.find((i) => i.categoryId === 'food')!;
    A.setPaydayItem(s, pd.id, food.id, true);
    expect(L.accountBalance(s, 'acc_bpi_savings')).toBe(start);
    const save = pd.items.find((i) => i.toAccountId === 'acc_passbook')!;
    A.setPaydayItem(s, pd.id, save.id, true);
    expect(mainSavings(s)).toBe(6_000_000);
    expect(L.accountBalance(s, 'acc_bpi_savings')).toBe(start - 1_000_000);
    // undo by unchecking
    A.setPaydayItem(s, pd.id, save.id, false);
    expect(mainSavings(s)).toBe(5_000_000);
    // planned account activates on first transfer
    const travel = pd.items.find((i) => i.toAccountId === 'acc_maya_goals')!;
    A.setPaydayItem(s, pd.id, travel.id, true);
    expect(L.accountById(s, 'acc_maya_goals')!.status).toBe('active');
    for (const i of pd.items) A.setPaydayItem(s, pd.id, i.id, true);
    expect(s.paydays[0].completedAt).toBeTruthy();
    // all transfers: 10k + 3k + 2k + 1k
    expect(L.accountBalance(s, 'acc_bpi_savings')).toBe(start - 1_600_000);
    expect(L.totals(s).netWorth).toBe(7_000_000 + 4_296_356);
  });

  it('budget edits never rewrite earlier months', () => {
    pay();
    at('2027-03-02T04:00:00Z');
    const lines = januaryPlan('').lines.map((l) => (l.categoryId === 'food' ? { ...l, amount: 800_000 } : l));
    savePlan(s, '2027-03', { name: 'March+', lines, expectedIncome: 4_296_356 });
    expect(L.categoryBudgets(s, '2027-01')!.byCategory.food).toBe(700_000);
    expect(L.categoryBudgets(s, '2027-02')!.byCategory.food).toBe(700_000);
    expect(L.categoryBudgets(s, '2027-03')!.byCategory.food).toBe(800_000);
    expect(L.categoryBudgets(s, '2027-08')!.byCategory.food).toBe(800_000);
  });

  it('available to spend = reservations − spending', () => {
    pay();
    A.addTxn(s, { kind: 'expense', amount: 25_000, datetime: '2027-01-15T13:00', accountId: 'acc_bpi_savings', categoryId: 'food', merchant: 'Coffee' });
    const a = L.availableToSpend(s, '2027-01')!;
    expect(a.budget).toBe(4_296_356 - 1_600_000);
    expect(a.remaining).toBe(4_296_356 - 1_600_000 - 25_000);
  });

  it('deleting the salary removes that month\'s checklist transfers', () => {
    const pd = pay();
    const save = pd.items.find((i) => i.toAccountId === 'acc_passbook')!;
    A.setPaydayItem(s, pd.id, save.id, true);
    A.deleteTxn(s, pd.salaryTxnId);
    expect(s.paydays).toHaveLength(0);
    expect(mainSavings(s)).toBe(5_000_000);
    expect(L.accountBalance(s, 'acc_bpi_savings')).toBe(2_000_000);
  });
});

describe('earmarks & rewards — no free money', () => {
  it('reward fund comes out of wants, redemption is not double-counted', () => {
    at('2027-01-20T04:00:00Z');
    A.confirmSalary(s, { month: '2027-01', amount: 4_296_356, datetime: '2027-01-15T12:00', accountId: 'acc_bpi_savings' });
    A.earmark(s, 'reward_fund', 50_000);
    expect(L.rewardFundBalance(s)).toBe(50_000);
    expect(L.spentByCategory(s, '2027-01').wants).toBe(50_000);
    A.addTxn(s, { kind: 'expense', amount: 50_000, datetime: '2027-01-20T12:00', accountId: 'acc_bpi_savings', categoryId: 'rewards', merchant: 'Skincare treat', rewardId: 'r_skincare', earmarkUse: 50_000 });
    expect(L.rewardFundBalance(s)).toBe(0);
    expect(L.spentByCategory(s, '2027-01').rewards).toBe(0);
    expect(L.availableToSpend(s, '2027-01')!.spent).toBe(50_000);
  });
});

describe('projections — honest, no invented returns', () => {
  it('₱50k + ₱10k/mo from Jan 2027', () => {
    expect(monthsToReach(5_000_000, 30_000_000, 1_000_000)).toBe(25);
    expect(reachMonth(s, 30_000_000, 1_000_000)).toBe('2029-01');
    expect(reachMonth(s, 50_000_000, 1_000_000)).toBe('2030-09');
    // ₱500k by Dec 2027 needs 12 contributions of ₱37,500
    expect(requiredMonthly(s, 50_000_000, '2027-12')).toBe(3_750_000);
  });
});

describe('investments', () => {
  it('average cost, realized and unrealized in PHP', () => {
    const h = { id: 'h1', symbol: 'VOO', name: 'Vanguard S&P 500', assetType: 'etf' as const, currency: 'USD' as const, lastPrice: 50_000 };
    const trades = [
      { id: '1', holdingId: 'h1', kind: 'buy' as const, date: '2027-01-01', shares: 2, price: 40_000, fees: 0, fxRate: 58 },
      { id: '2', holdingId: 'h1', kind: 'sell' as const, date: '2027-02-01', shares: 1, price: 45_000, fees: 0, fxRate: 58 },
    ];
    const st = holdingStats(h, trades, 60);
    expect(st.shares).toBe(1);
    expect(st.costPhp).toBe(40_000 * 58);
    expect(st.realizedPhp).toBe(5_000 * 58);
    expect(st.valuePhp).toBe(50_000 * 60);
    expect(st.unrealizedPhp).toBe(50_000 * 60 - 40_000 * 58);
  });
  it('buying moves cash into holdings, not an expense', () => {
    s.accounts.find((a) => a.id === 'acc_brokerage')!.status = 'active';
    A.addTxn(s, { kind: 'transfer', amount: 1_000_000, datetime: '2026-11-13T10:00', accountId: 'acc_bpi_savings', toAccountId: 'acc_brokerage', merchant: 'fund' });
    s.holdings.push({ id: 'h1', symbol: 'AREIT', name: 'AREIT', assetType: 'ph_reit', currency: 'PHP' });
    A.recordTrade(s, { holdingId: 'h1', kind: 'buy', date: '2026-11-13', shares: 100, price: 3_500, fees: 0, fxRate: 1, cashAccountId: 'acc_brokerage' });
    expect(L.accountBalance(s, 'acc_brokerage')).toBe(650_000);
    expect(L.totals(s).netWorth).toBe(7_000_000);
    expect(L.grossSpending(s, '2026-11')).toBe(0);
  });
});

describe('backup', () => {
  it('round-trips through JSON and rejects junk', () => {
    const back = migrate(JSON.parse(JSON.stringify(s)));
    expect(L.totals(back)).toEqual(L.totals(s));
    expect(() => migrate({ hello: 1 })).toThrow();
  });
});
