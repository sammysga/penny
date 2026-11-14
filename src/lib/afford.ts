import type { AppState, WishItem } from './types';
import { budgetRows, categoryBudgets, wishSaved } from './ledger';
import { thisMonth } from './date';
import { peso } from './money';

export function wantsRemaining(s: AppState) {
  const r = budgetRows(s, thisMonth()).find((x) => x.categoryId === 'wants');
  return { remaining: r ? r.remaining : 0, monthly: categoryBudgets(s, thisMonth())?.byCategory.wants ?? 0 };
}

/** Affordability using only the wants fund + money already set aside. Never touches protected savings. */
export function affordability(s: AppState, w: WishItem): { tone: 'good' | 'warn' | 'info'; text: string } {
  const saved = wishSaved(s, w.id);
  const { remaining, monthly } = wantsRemaining(s);
  if (saved >= w.price) return { tone: 'good', text: 'Fully saved. You can buy this without touching protected savings.' };
  if (saved + Math.max(0, remaining) >= w.price) return { tone: 'good', text: 'You can buy this using your wants fund without touching protected savings.' };
  const plan = monthly > 0 ? monthly : 0;
  if (!plan) return { tone: 'info', text: 'Set a wants budget to see when this fits.' };
  const n = Math.ceil((w.price - saved - Math.max(0, remaining)) / plan);
  return { tone: 'warn', text: `This purchase exceeds your available wants budget. Save for ${n} more payday${n === 1 ? '' : 's'} (${peso(plan, { compact: true })}/month wants budget).` };
}
