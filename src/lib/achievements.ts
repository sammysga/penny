import type { AppState } from './types';
import type { Cents } from './money';
import { accountBalance, accountByRole, availableToSpend, bestTrackingStreak, budgetRows, live, savingsStreak } from './ledger';
import { dayDiff, thisMonth, today } from './date';
import { mainSavings } from './projections';
import { peso } from './money';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  kind: 'milestone' | 'habit';
  /** progress 0..1 and whether unlocked, computed from real data */
  check: (s: AppState) => { done: boolean; progress: number; detail?: string };
}

const MILESTONES: Cents[] = [7_500_000, 10_000_000, 15_000_000, 20_000_000, 25_000_000, 30_000_000, 40_000_000, 50_000_000];


export const ACHIEVEMENTS: AchievementDef[] = [
  ...MILESTONES.map<AchievementDef>((amt) => ({
    id: `save_${amt / 100}`,
    title: `${peso(amt, { compact: true })} saved`,
    description: `BPI Passbook reaches ${peso(amt, { compact: true })}.`,
    kind: 'milestone',
    check: (s) => { const cur = mainSavings(s); return { done: cur >= amt, progress: Math.min(1, cur / amt) }; },
  })),
  {
    id: 'first_payday', title: 'First Payday Organized', description: 'Complete every item on a payday checklist.', kind: 'habit',
    check: (s) => { const done = s.paydays.some((p) => p.completedAt); const pd = s.paydays[s.paydays.length - 1];
      return { done, progress: done ? 1 : pd ? pd.items.filter((i) => i.done).length / Math.max(1, pd.items.length) : 0 }; },
  },
  {
    id: 'track_7', title: '7 Days of Tracking', description: 'Log an expense or a "nothing spent" check-in 7 days in a row.', kind: 'habit',
    check: (s) => { const b = bestTrackingStreak(s); return { done: b >= 7, progress: Math.min(1, b / 7), detail: `${Math.min(b, 7)}/7 days` }; },
  },
  {
    id: 'month_in_budget', title: 'First Month Within Budget', description: 'Finish a full month with every category at or under budget.', kind: 'habit',
    check: (s) => {
      const months = [...new Set(s.paydays.map((p) => p.month))].filter((m) => m < thisMonth());
      const ok = months.some((m) => { const a = availableToSpend(s, m); return a && a.remaining >= 0 && budgetRows(s, m).every((r) => r.budget === 0 ? r.spent <= 0 : r.spent <= r.budget); });
      return { done: ok, progress: ok ? 1 : 0 };
    },
  },
  {
    id: 'deposits_3', title: 'Three Consecutive Deposits', description: 'Contribute to main savings three months in a row.', kind: 'habit',
    check: (s) => { const n = savingsStreak(s); return { done: n >= 3, progress: Math.min(1, n / 3), detail: `${Math.min(n, 3)}/3 months` }; },
  },
  {
    id: 'deposits_6', title: 'Six Months of Consistency', description: 'Contribute to main savings six months in a row.', kind: 'habit',
    check: (s) => { const n = savingsStreak(s); return { done: n >= 6, progress: Math.min(1, n / 6), detail: `${Math.min(n, 6)}/6 months` }; },
  },
  {
    id: 'first_investment', title: 'First Investment', description: 'Record your first buy in the investment tracker.', kind: 'habit',
    check: (s) => { const d = s.trades.some((t) => t.kind === 'buy'); return { done: d, progress: d ? 1 : 0 }; },
  },
  {
    id: 'emergency', title: 'Emergency Fund Milestone', description: 'Emergency fund reaches your milestone (Settings).', kind: 'habit',
    check: (s) => { const a = accountByRole(s, 'emergency'); const bal = a && a.status === 'active' ? accountBalance(s, a.id) : 0; const t = s.settings.emergencyMilestone;
      return { done: t > 0 && bal >= t, progress: t > 0 ? Math.min(1, bal / t) : 0, detail: `${peso(bal, { compact: true })} of ${peso(t, { compact: true })}` }; },
  },
  {
    id: 'no_withdraw_30', title: '30 Days, No Unplanned Withdrawals', description: 'Nothing taken out of BPI Passbook for 30 days.', kind: 'habit',
    check: (s) => {
      const a = accountByRole(s, 'main_savings');
      if (!a) return { done: false, progress: 0 };
      const outs = live(s).filter((t) => t.accountId === a.id && t.status === 'cleared' && ['transfer', 'expense', 'invest_buy'].includes(t.kind)).map((t) => t.datetime.slice(0, 10)).sort();
      const since = outs.length ? outs[outs.length - 1] : a.openingDate;
      const days = Math.max(0, dayDiff(since, today()));
      return { done: days >= 30, progress: Math.min(1, days / 30), detail: `${Math.min(days, 30)}/30 days` };
    },
  },
];

export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);

/** Returns ids that are now satisfied but not yet recorded as unlocked. */
export function newlyUnlocked(s: AppState): string[] {
  return ACHIEVEMENTS.filter((a) => !s.achievements[a.id] && a.check(s).done).map((a) => a.id);
}

