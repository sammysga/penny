import type { AppState } from './types';
import type { Cents } from './money';
import { addMonths, monthDiff, thisMonth } from './date';
import { accountBalance, accountByRole, contributionsByMonth } from './ledger';

/**
 * Savings projections use ONLY confirmed balances + a flat monthly contribution.
 * No investment returns, no pending income, no assumed bonuses.
 */
export function mainSavings(s: AppState): Cents {
  const a = accountByRole(s, 'main_savings');
  return a ? accountBalance(s, a.id) : 0;
}

/** First month a future contribution can land in. */
export function nextContributionMonth(s: AppState): string {
  const a = accountByRole(s, 'main_savings');
  const cur = thisMonth();
  const done = a ? (contributionsByMonth(s, a.id)[cur] ?? 0) > 0 : false;
  let m = done ? addMonths(cur, 1) : cur;
  if (m < s.settings.contributionStartMonth) m = s.settings.contributionStartMonth;
  return m;
}

export function monthsToReach(current: Cents, target: Cents, monthly: Cents): number | null {
  if (current >= target) return 0;
  if (monthly <= 0) return null;
  return Math.ceil((target - current) / monthly);
}

export function reachMonth(s: AppState, target: Cents, monthly: Cents): string | null {
  const cur = mainSavings(s);
  const n = monthsToReach(cur, target, monthly);
  if (n === null) return null;
  if (n === 0) return thisMonth();
  return addMonths(nextContributionMonth(s), n - 1);
}

/** Monthly amount needed to hit `target` by the end of `byMonth` (inclusive). */
export function requiredMonthly(s: AppState, target: Cents, byMonth: string): Cents | null {
  const cur = mainSavings(s);
  if (cur >= target) return 0;
  const months = monthDiff(nextContributionMonth(s), byMonth) + 1;
  if (months <= 0) return null;
  return Math.ceil((target - cur) / months);
}

export interface Scenario { key: 'conservative' | 'standard' | 'stretch'; label: string; monthly: Cents }

export function scenarios(s: AppState): Scenario[] {
  return [
    { key: 'conservative', label: 'Conservative', monthly: s.settings.conservativeContribution },
    { key: 'standard', label: 'Standard', monthly: s.settings.monthlyContribution },
    { key: 'stretch', label: 'Stretch', monthly: s.settings.stretchContribution },
  ];
}

/** Month-by-month projected balance for chart (values in pesos for Recharts). */
export function projectionSeries(s: AppState, horizonMonths?: number) {
  const cur = mainSavings(s);
  const start = nextContributionMonth(s);
  const sc = scenarios(s);
  const slowest = Math.min(...sc.map((x) => x.monthly).filter((x) => x > 0));
  const need = Number.isFinite(slowest) ? Math.ceil(Math.max(0, s.settings.goal2 - cur) / slowest) : 36;
  const horizon = horizonMonths ?? Math.min(Math.max(need + 1, 12), 72);
  const now = thisMonth();
  const rows: Record<string, number | string>[] = [];
  const offset = monthDiff(now, start); // months before contributions begin
  for (let i = 0; i <= horizon; i++) {
    const m = addMonths(now, i);
    const k = Math.max(0, i - offset + (i >= offset ? 1 : 0));
    const row: Record<string, number | string> = { month: m };
    for (const x of sc) {
      const v = cur + x.monthly * k;
      const prev = cur + x.monthly * Math.max(0, k - 1);
      // Stop each line the month after it reaches the long-term goal, so the axis stays readable.
      if (k === 0 || prev < s.settings.goal2) row[x.key] = v / 100;
    }
    rows.push(row);
  }
  return rows;
}
