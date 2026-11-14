import type { Cents } from './money';

/**
 * Penny data model. Every entity has a string id so the shape maps 1:1 onto
 * Supabase tables later (see src/lib/storage.ts). Money is integer centavos.
 */

export type AccountType = 'savings' | 'checking' | 'debit' | 'ewallet' | 'investment_cash' | 'brokerage' | 'credit';
export type AccountStatus = 'active' | 'planned' | 'closed';
/** Semantic role lets features find "the main savings account" even after renames. */
export type AccountRole = 'main_savings' | 'salary' | 'spending' | 'emergency' | 'travel' | 'investment_cash' | 'brokerage' | 'credit_card' | 'other';

export interface LegacyPayment {
  id: string;
  date: string;
  amount: Cents;
  note: string;
}

export interface Account {
  id: string;
  name: string;
  institution: string;
  type: AccountType;
  role: AccountRole;
  purpose: string;
  /** For assets: opening cash. For credit: opening outstanding balance owed. */
  initialBalance: Cents;
  /** True once you've confirmed the opening balance is real (not a placeholder). */
  balanceConfirmed: boolean;
  openingDate: string;
  status: AccountStatus;
  color: string;
  icon: string;
  /** Funds on hold (e.g. maintaining balance). Available = current − hold. */
  holdAmount: Cents;
  // Credit-card-only
  creditLimit?: Cents;
  statementBalance?: Cents;
  statementDate?: string;
  dueDate?: string;
  /** Payments made before Penny started. Displayed in history; NEVER posted to the ledger. */
  legacyPayments?: LegacyPayment[];
  lastReconciledAt?: string;
}

export type TxnKind = 'expense' | 'income' | 'transfer' | 'adjustment' | 'refund' | 'invest_buy' | 'invest_sell';
export type IncomeType = 'salary' | 'final_pay' | 'thirteenth_month' | 'dividend' | 'bonus' | 'other';
export type TxnStatus = 'cleared' | 'pending';

export interface TxnHistoryEntry {
  at: string;
  action: 'created' | 'edited' | 'deleted' | 'restored';
  note?: string;
  before?: Partial<Transaction>;
}

export interface Transaction {
  id: string;
  kind: TxnKind;
  /** Always positive, except `adjustment` which is signed (+ adds to the account). */
  amount: Cents;
  datetime: string;
  accountId: string;
  /** transfer destination */
  toAccountId?: string;
  categoryId?: string;
  merchant: string;
  notes?: string;
  status: TxnStatus;
  incomeType?: IncomeType;
  /** Month the salary funds ("2027-01"). Used for duplicate prevention. */
  payMonth?: string;
  paydayId?: string;
  paydayItemId?: string;
  tripId?: string;
  subscriptionId?: string;
  wishId?: string;
  rewardId?: string;
  tradeId?: string;
  expectedIncomeId?: string;
  /** Portion already covered by an earmark (rewards fund / wishlist savings). Not counted against budgets twice. */
  earmarkUse?: Cents;
  source?: 'manual' | 'payday' | 'checkin' | 'subscription' | 'wishlist' | 'reward' | 'reconcile' | 'investment' | 'import';
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  history: TxnHistoryEntry[];
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  group: 'essentials' | 'lifestyle' | 'wants' | 'savings' | 'other';
  /** Whether spending here draws on the monthly "available to spend" figure. */
  countsAsSpending: boolean;
  archived?: boolean;
}

export type AllocationKind = 'transfer' | 'reservation';

export interface AllocationLine {
  id: string;
  label: string;
  amount: Cents;
  kind: AllocationKind;
  /** reservation: which spending category this money is for (empty = buffer) */
  categoryId?: string;
  /** transfer: destination account */
  toAccountId?: string;
}

/** A budget plan applies from `effectiveFrom` until the next plan's month. Editing never rewrites earlier months. */
export interface BudgetPlan {
  id: string;
  name: string;
  effectiveFrom: string;
  /** If set, the plan applies to exactly this one month (e.g. December holiday budget). */
  onlyMonth?: boolean;
  expectedIncome: Cents;
  lines: AllocationLine[];
  note?: string;
  createdAt: string;
}

export interface PaydayItem extends AllocationLine {
  done: boolean;
  doneAt?: string;
  txnId?: string;
}

export interface Payday {
  id: string;
  month: string;
  salaryTxnId: string;
  salaryAccountId: string;
  planId: string;
  items: PaydayItem[];
  createdAt: string;
  completedAt?: string;
}

export interface ExpectedIncome {
  id: string;
  name: string;
  source: string;
  incomeType: IncomeType;
  /** null = amount not yet known (e.g. 13th month) */
  expectedAmount: Cents | null;
  expectedDate?: string;
  obligations: { id: string; label: string; amount: Cents; paidTxnId?: string }[];
  status: 'pending' | 'received';
  receivedTxnId?: string;
  notes?: string;
}

export interface Earmark {
  id: string;
  date: string;
  month: string;
  amount: Cents;
  /** 'reward_fund' or a wishlist id */
  target: 'reward_fund' | { wishId: string };
  note?: string;
}

export interface WishItem {
  id: string;
  name: string;
  price: Cents;
  imageUrl?: string;
  link?: string;
  priority: 'high' | 'medium' | 'low';
  targetDate?: string;
  category: string;
  notes?: string;
  status: 'wishing' | 'saving' | 'purchased' | 'dropped';
  purchaseTxnId?: string;
  createdAt: string;
}

export type RewardCondition =
  | { type: 'none' }
  | { type: 'savings'; amount: Cents }
  | { type: 'achievement'; achievementId: string };

export interface Reward {
  id: string;
  name: string;
  cost: Cents;
  condition: RewardCondition;
  notes?: string;
  redeemedTxnId?: string;
  redeemedAt?: string;
  createdAt: string;
}

export interface Trip {
  id: string;
  destination: string;
  startDate?: string;
  endDate?: string;
  budget: Cents;
  /** Portion of the travel-savings account assigned to this trip. */
  allocated: Cents;
  plannedExpenses: { id: string; label: string; amount: Cents }[];
  notes?: string;
  status: 'planning' | 'booked' | 'done';
}

export interface Subscription {
  id: string;
  name: string;
  amount: Cents;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  nextRenewal: string;
  accountId: string;
  categoryId: string;
  active: boolean;
  remindDaysBefore: number;
  notes?: string;
}

export type AssetType = 'us_stock' | 'etf' | 'ph_reit' | 'ph_stock' | 'other';

export interface Holding {
  id: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  currency: 'PHP' | 'USD';
  /** Manually entered last price, minor units of `currency`. Penny never fetches live prices. */
  lastPrice?: number;
  lastPriceDate?: string;
}

export interface Trade {
  id: string;
  holdingId: string;
  kind: 'buy' | 'sell' | 'dividend';
  date: string;
  /** shares (up to 6 decimals). 0 for dividends. */
  shares: number;
  /** per-share price in minor units of holding currency (buy/sell). For dividends: total amount. */
  price: number;
  fees: number;
  /** PHP per 1 USD at trade time (1 for PHP holdings) */
  fxRate: number;
  /** Cash account debited/credited (in PHP) — creates a linked ledger transaction. */
  cashAccountId?: string;
  ledgerTxnId?: string;
  notes?: string;
}

export interface CheckInSettings {
  enabled: boolean;
  frequency: 'hourly' | '2h' | '4h' | 'daily' | 'custom' | 'off';
  customHours: number[];
  startHour: number;
  endHour: number;
  quietStart: number;
  quietEnd: number;
  dailyLimit: number;
  browserNotifications: boolean;
}

export interface CheckInLog {
  at: string;
  response: 'logged' | 'nothing' | 'later' | 'shown';
}

export interface Settings {
  name: string;
  employer: string;
  grossMonthly: Cents;
  netMonthly: Cents;
  payDay: number;
  goal1: Cents;
  goal2: Cents;
  goalTargetMonth: string;
  monthlyContribution: Cents;
  stretchContribution: Cents;
  conservativeContribution: Cents;
  contributionStartMonth: string;
  emergencyMilestone: Cents;
  usdPhp: number;
  usdPhpUpdated: string;
  theme: 'system' | 'light' | 'dark';
  checkIns: CheckInSettings;
  sidebarCollapsed: boolean;
}

export interface AppState {
  schemaVersion: number;
  createdAt: string;
  settings: Settings;
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  budgetPlans: BudgetPlan[];
  paydays: Payday[];
  expectedIncome: ExpectedIncome[];
  earmarks: Earmark[];
  wishlist: WishItem[];
  rewards: Reward[];
  trips: Trip[];
  subscriptions: Subscription[];
  holdings: Holding[];
  trades: Trade[];
  achievements: Record<string, string>;
  checkInLog: CheckInLog[];
  lastCheckInPromptAt?: string;
  snoozedUntil?: string;
}
