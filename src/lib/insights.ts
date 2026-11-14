import type { AppState } from './types';
import { peso } from './money';
import { addMonths, daysInMonth, monthLabel, thisMonth, today } from './date';
import { accountByRole, availableToSpend, budgetRows, contributionsByMonth, live, trackingDays } from './ledger';
import { mainSavings, reachMonth, requiredMonthly } from './projections';

/** Short, calm, factual insights. Every sentence is computed from your data — nothing is guessed. */
export function monthInsights(s: AppState, month: string): string[] {
  const out: string[] = [];
  const cat = (id: string) => s.categories.find((c) => c.id === id)?.name.toLowerCase() ?? id;
  const main = accountByRole(s, 'main_savings');
  const saved = main ? contributionsByMonth(s, main.id)[month] ?? 0 : 0;
  const rows = budgetRows(s, month).filter((r) => r.budget > 0);
  const within = rows.filter((r) => r.spent <= r.budget);
  const over = rows.filter((r) => r.spent > r.budget);

  if (saved > 0) {
    const ok = within.find((r) => ['skincare', 'food', 'sports', 'wants'].includes(r.categoryId));
    out.push(`You saved ${peso(saved, { compact: true })} to ${main!.name} this month${ok ? ` and stayed within your ${cat(ok.categoryId)} budget` : ''}.`);
  }

  // Compare each over-budget category with the average of the previous 3 months.
  for (const r of over.slice(0, 2)) {
    const prev = [1, 2, 3].map((i) => budgetRows(s, addMonths(month, -i)).find((x) => x.categoryId === r.categoryId)?.spent ?? 0);
    const avg = prev.reduce((a, b) => a + b, 0) / 3;
    const essentialsOk = rows.filter((x) => ['transport', 'health', 'dogs'].includes(x.categoryId)).every((x) => x.spent <= x.budget);
    out.push(`Your ${cat(r.categoryId)} spending was ${avg > 0 && r.spent > avg * 1.15 ? 'higher than usual' : 'over budget'} (${peso(r.spent, { compact: true })} of ${peso(r.budget, { compact: true })})${essentialsOk ? ', but your essential expenses remained covered' : ''}.`);
  }
  if (rows.length && !over.length && month < thisMonth()) out.push(`Every category stayed within budget in ${monthLabel(month)}.`);

  const days = [...trackingDays(s)].filter((d) => d.startsWith(month)).length;
  const span = month === thisMonth() ? Number(today().slice(8, 10)) : daysInMonth(month);
  if (days > 0) out.push(`You logged expenses or checked in on ${days} of ${span} days.`);

  const target = s.settings.goal2;
  const by = s.settings.goalTargetMonth;
  const reach = reachMonth(s, target, s.settings.monthlyContribution);
  if (mainSavings(s) < target && reach && reach > by) {
    const need = requiredMonthly(s, target, by);
    out.push(`Your savings goal is progressing, but reaching ${peso(target, { compact: true })} by ${monthLabel(by)} would take about ${need ? peso(need, { compact: true }) : 'more'} a month. At ${peso(s.settings.monthlyContribution, { compact: true })}/month you'd get there around ${monthLabel(reach)}.`);
  }
  return out;
}

export function todayInsight(s: AppState): string | null {
  const a = availableToSpend(s);
  if (a && a.remaining > 0) return `You can spend about ${peso(a.perDay, { compact: true })} a day for the rest of ${monthLabel(thisMonth()).split(' ')[0]} and stay on plan.`;
  if (a && a.remaining <= 0) return 'This month\'s spending plan is fully used. Essentials first — anything else can wait for payday.';
  const spentToday = live(s).filter((t) => t.kind === 'expense' && t.datetime.startsWith(today())).reduce((x, t) => x + t.amount, 0);
  if (spentToday > 0) return `You've logged ${peso(spentToday)} today.`;
  return null;
}
