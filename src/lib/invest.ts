import type { AppState, Holding, Trade } from './types';

/**
 * Investment math — average-cost method. Prices are entered manually; Penny never fetches quotes.
 * Holding-currency amounts are minor units (centavos or US cents). PHP results are centavos.
 */
export interface HoldingStats {
  holding: Holding;
  shares: number;
  /** cost basis in holding currency minor units */
  cost: number;
  /** cost basis in PHP centavos (at historical fx) */
  costPhp: number;
  valueLocal: number | null;
  valuePhp: number;
  unrealizedPhp: number;
  realizedPhp: number;
  dividendsPhp: number;
  contributedPhp: number;
  hasPrice: boolean;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function holdingStats(h: Holding, trades: Trade[], usdPhp: number): HoldingStats {
  const ts = trades.filter((t) => t.holdingId === h.id).sort((a, b) => a.date.localeCompare(b.date));
  let shares = 0, cost = 0, costPhp = 0, realizedPhp = 0, dividendsPhp = 0, contributedPhp = 0;
  for (const t of ts) {
    const fx = h.currency === 'USD' ? t.fxRate : 1;
    if (t.kind === 'buy') {
      const gross = Math.round(t.shares * t.price) + t.fees;
      cost += gross;
      costPhp += Math.round(gross * fx);
      contributedPhp += Math.round(gross * fx);
      shares = round6(shares + t.shares);
    } else if (t.kind === 'sell') {
      if (shares <= 0) continue;
      const frac = Math.min(1, t.shares / shares);
      const costOut = Math.round(cost * frac);
      const costOutPhp = Math.round(costPhp * frac);
      const proceeds = Math.round(t.shares * t.price) - t.fees;
      realizedPhp += Math.round(proceeds * fx) - costOutPhp;
      cost -= costOut; costPhp -= costOutPhp;
      shares = round6(shares - t.shares);
    } else {
      dividendsPhp += Math.round(t.price * fx);
    }
  }
  const hasPrice = h.lastPrice !== undefined && h.lastPrice !== null;
  const valueLocal = hasPrice ? Math.round(shares * (h.lastPrice as number)) : null;
  // Without a price, value at cost (and say so in the UI) — never invent a market value.
  const valuePhp = valueLocal === null ? costPhp : Math.round(valueLocal * (h.currency === 'USD' ? usdPhp : 1));
  return { holding: h, shares, cost, costPhp, valueLocal, valuePhp, unrealizedPhp: hasPrice ? valuePhp - costPhp : 0, realizedPhp, dividendsPhp, contributedPhp, hasPrice };
}

export function portfolioSummary(s: AppState) {
  const stats = s.holdings.map((h) => holdingStats(h, s.trades, s.settings.usdPhp));
  const sum = (k: keyof HoldingStats) => stats.reduce((a, x) => a + (x[k] as number), 0);
  return {
    stats,
    valuePhp: sum('valuePhp'),
    costPhp: sum('costPhp'),
    unrealizedPhp: sum('unrealizedPhp'),
    realizedPhp: sum('realizedPhp'),
    dividendsPhp: sum('dividendsPhp'),
    contributedPhp: sum('contributedPhp'),
  };
}

export const ASSET_LABEL: Record<string, string> = {
  us_stock: 'US stock', etf: 'ETF', ph_reit: 'PH REIT', ph_stock: 'PH stock', other: 'Other',
};
