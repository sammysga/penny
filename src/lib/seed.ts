import type { AppState, BudgetPlan, Category } from './types';
import { nowLocal, today } from './date';

/**
 * Initial state built from Samantha's financial profile.
 * Only real, stated facts are seeded — no sample transactions.
 */

export const SCHEMA_VERSION = 1;

export const CATEGORIES: Category[] = [
  { id: 'food', name: 'Food, coffee & dining', icon: 'Coffee', group: 'essentials', countsAsSpending: true },
  { id: 'sports', name: 'Golf & pickleball', icon: 'Trophy', group: 'lifestyle', countsAsSpending: true },
  { id: 'skincare', name: 'Skincare', icon: 'Sparkles', group: 'lifestyle', countsAsSpending: true },
  { id: 'dogs', name: 'Dogs', icon: 'PawPrint', group: 'essentials', countsAsSpending: true },
  { id: 'health', name: 'Medication & health', icon: 'HeartPulse', group: 'essentials', countsAsSpending: true },
  { id: 'transport', name: 'Transport & essentials', icon: 'Car', group: 'essentials', countsAsSpending: true },
  { id: 'subscriptions', name: 'Subscriptions', icon: 'Repeat', group: 'lifestyle', countsAsSpending: true },
  { id: 'wants', name: 'Wants & shopping', icon: 'ShoppingBag', group: 'wants', countsAsSpending: true },
  { id: 'travel', name: 'Travel spending', icon: 'Plane', group: 'lifestyle', countsAsSpending: true },
  { id: 'holiday', name: 'Gifts & holidays', icon: 'Gift', group: 'wants', countsAsSpending: true },
  { id: 'rewards', name: 'Rewards', icon: 'Award', group: 'wants', countsAsSpending: true },
  { id: 'family', name: 'Family & obligations', icon: 'Users', group: 'other', countsAsSpending: false },
  { id: 'fees', name: 'Bank fees & charges', icon: 'Landmark', group: 'other', countsAsSpending: true },
  { id: 'other', name: 'Other', icon: 'Circle', group: 'other', countsAsSpending: true },
];

export function januaryPlan(createdAt: string): BudgetPlan {
  return {
    id: 'plan_2027_01',
    name: 'Standard monthly plan',
    effectiveFrom: '2027-01',
    expectedIncome: 4_296_356,
    createdAt,
    lines: [
      { id: 'l_passbook', label: 'BPI Passbook — main savings', amount: 1_000_000, kind: 'transfer', toAccountId: 'acc_passbook' },
      { id: 'l_food', label: 'Food, coffee & dining', amount: 700_000, kind: 'reservation', categoryId: 'food' },
      { id: 'l_sports', label: 'Golf & pickleball', amount: 500_000, kind: 'reservation', categoryId: 'sports' },
      { id: 'l_skincare', label: 'Skincare', amount: 200_000, kind: 'reservation', categoryId: 'skincare' },
      { id: 'l_dogs', label: 'Dogs', amount: 200_000, kind: 'reservation', categoryId: 'dogs' },
      { id: 'l_health', label: 'Medication & health', amount: 200_000, kind: 'reservation', categoryId: 'health' },
      { id: 'l_transport', label: 'Transport & misc. essentials', amount: 300_000, kind: 'reservation', categoryId: 'transport' },
      { id: 'l_subs', label: 'Subscriptions', amount: 150_000, kind: 'reservation', categoryId: 'subscriptions' },
      { id: 'l_wants', label: 'Wants & shopping', amount: 300_000, kind: 'reservation', categoryId: 'wants' },
      { id: 'l_travel', label: 'Travel savings', amount: 300_000, kind: 'transfer', toAccountId: 'acc_maya_goals' },
      { id: 'l_emergency', label: 'Emergency savings', amount: 200_000, kind: 'transfer', toAccountId: 'acc_maya_savings' },
      { id: 'l_invest', label: 'Investment holding fund', amount: 100_000, kind: 'transfer', toAccountId: 'acc_invest_cash' },
      { id: 'l_buffer', label: 'Extra buffer', amount: 146_356, kind: 'reservation' },
    ],
  };
}

export function createInitialState(): AppState {
  const now = nowLocal();
  const d = today();
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    settings: {
      name: 'Samantha',
      employer: 'Oracle Health',
      grossMonthly: 5_423_077,
      netMonthly: 4_296_356,
      payDay: 15,
      goal1: 30_000_000,
      goal2: 50_000_000,
      goalTargetMonth: '2027-12',
      monthlyContribution: 1_000_000,
      stretchContribution: 1_500_000,
      conservativeContribution: 800_000,
      contributionStartMonth: '2027-01',
      emergencyMilestone: 2_000_000,
      usdPhp: 58.5,
      usdPhpUpdated: d,
      theme: 'system',
      sidebarCollapsed: false,
      checkIns: {
        enabled: true, frequency: 'hourly', customHours: [12, 18, 23],
        startHour: 11, endHour: 24, quietStart: 1, quietEnd: 9,
        dailyLimit: 12, browserNotifications: false,
      },
    },
    accounts: [
      { id: 'acc_passbook', name: 'BPI Passbook', institution: 'BPI', type: 'savings', role: 'main_savings', purpose: 'Main protected savings', initialBalance: 5_000_000, balanceConfirmed: true, openingDate: d, status: 'active', color: '#244B3C', icon: 'Landmark', holdAmount: 0 },
      { id: 'acc_bpi_savings', name: 'Existing BPI Savings', institution: 'BPI', type: 'savings', role: 'salary', purpose: 'Salary receiving account & cash buffer', initialBalance: 0, balanceConfirmed: false, openingDate: d, status: 'active', color: '#5E7F6E', icon: 'Wallet', holdAmount: 0 },
      { id: 'acc_debit', name: 'New Debit Account', institution: '', type: 'debit', role: 'spending', purpose: 'Everyday expenses, wants, subscriptions', initialBalance: 0, balanceConfirmed: true, openingDate: d, status: 'planned', color: '#A8B9A5', icon: 'CreditCard', holdAmount: 0 },
      { id: 'acc_maya_savings', name: 'Maya Savings', institution: 'Maya', type: 'ewallet', role: 'emergency', purpose: 'Emergency fund', initialBalance: 0, balanceConfirmed: true, openingDate: d, status: 'planned', color: '#7A9A86', icon: 'ShieldCheck', holdAmount: 0 },
      { id: 'acc_maya_goals', name: 'Maya Personal Goals', institution: 'Maya', type: 'ewallet', role: 'travel', purpose: 'Travel savings', initialBalance: 0, balanceConfirmed: true, openingDate: d, status: 'planned', color: '#C5AA79', icon: 'Plane', holdAmount: 0 },
      { id: 'acc_invest_cash', name: 'Investment Holding Fund', institution: '', type: 'investment_cash', role: 'investment_cash', purpose: 'Cash reserved for future investments', initialBalance: 0, balanceConfirmed: true, openingDate: d, status: 'planned', color: '#8C7A5B', icon: 'PiggyBank', holdAmount: 0 },
      { id: 'acc_brokerage', name: 'Brokerage Account', institution: '', type: 'brokerage', role: 'brokerage', purpose: 'Stocks & ETF holdings (uninvested cash shown here)', initialBalance: 0, balanceConfirmed: true, openingDate: d, status: 'planned', color: '#3F5E52', icon: 'LineChart', holdAmount: 0 },
      {
        id: 'acc_maya_black', name: 'Maya Black', institution: 'Maya', type: 'credit', role: 'credit_card', purpose: 'Credit card',
        initialBalance: 0, balanceConfirmed: true, openingDate: d, status: 'active', color: '#292B29', icon: 'CreditCard', holdAmount: 0,
        creditLimit: 1_000_000, statementBalance: 0,
        legacyPayments: [{ id: 'lp_nov2026', date: '2026-11-01', amount: 995_474, note: 'November 2026 bill — paid before Penny. Already reflected in starting balances; not posted to the ledger.' }],
      },
    ],
    transactions: [],
    categories: CATEGORIES,
    budgetPlans: [januaryPlan(now)],
    paydays: [],
    expectedIncome: [
      {
        id: 'ei_nestle', name: 'Nestlé final pay', source: 'Nestlé', incomeType: 'final_pay', expectedAmount: 6_937_745, status: 'pending',
        obligations: [{ id: 'ob_mom', label: 'Agreed repayment to Mom', amount: 4_200_000 }],
        notes: 'Possible remainder after repaying Mom: ₱27,377.45. Pending until actually received.',
      },
      {
        id: 'ei_13th', name: '13th-month pay', source: 'Oracle Health', incomeType: 'thirteenth_month', expectedAmount: null, status: 'pending', obligations: [],
        notes: 'Amount and date not yet confirmed. Enter the actual amount when it arrives.',
      },
    ],
    earmarks: [],
    wishlist: [
      { id: 'w_salomon', name: 'Salomon shoes', price: 1_250_000, priority: 'medium', category: 'wants', status: 'wishing', createdAt: now },
      { id: 'w_perfume', name: 'Perfume', price: 850_000, priority: 'medium', category: 'wants', status: 'wishing', createdAt: now },
      { id: 'w_guitar', name: 'Electric guitar with amp', price: 1_200_000, priority: 'low', category: 'wants', status: 'wishing', createdAt: now },
      { id: 'w_vinyl', name: 'Vinyl record player', price: 1_200_000, priority: 'low', category: 'wants', status: 'wishing', createdAt: now },
    ],
    rewards: [
      { id: 'r_coffee', name: 'Coffee date', cost: 30_000, condition: { type: 'achievement', achievementId: 'first_payday' }, createdAt: now },
      { id: 'r_skincare', name: 'Skincare treat', cost: 50_000, condition: { type: 'savings', amount: 10_000_000 }, createdAt: now },
      { id: 'r_dinner', name: 'Nice restaurant meal', cost: 150_000, condition: { type: 'savings', amount: 15_000_000 }, createdAt: now },
      { id: 'r_golf', name: 'New golf accessory', cost: 200_000, condition: { type: 'savings', amount: 20_000_000 }, createdAt: now },
      { id: 'r_travel', name: 'Travel experience', cost: 500_000, condition: { type: 'savings', amount: 30_000_000 }, notes: 'Self-selected. Only redeemable once the reward fund already holds the full amount.', createdAt: now },
    ],
    trips: [],
    subscriptions: [],
    holdings: [],
    trades: [],
    achievements: {},
    checkInLog: [],
  };
}
