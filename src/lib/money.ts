/**
 * All money in Penny is stored as integer centavos (1 PHP = 100 centavos).
 * Never multiply user input by 100 as a float — parse the decimal string instead.
 */
export type Cents = number;

/** Parse "1,234.56", "₱1234.5", "250" → integer centavos. Returns null if invalid. */
export function parseMoney(input: string | number | null | undefined): Cents | null {
  if (input === null || input === undefined) return null;
  let s = String(input).trim().replace(/[₱,\s]/g, '').replace(/^PHP/i, '');
  if (s === '') return null;
  let neg = false;
  if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  if (!/^\d*(\.\d*)?$/.test(s) || s === '.') return null;
  const [whole, frac = ''] = s.split('.');
  if (frac.length > 2) {
    // round half-up on the third decimal, using integer math only
    const base = BigInt((whole || '0') + frac.slice(0, 2));
    const roundUp = Number(frac[2]) >= 5 ? 1n : 0n;
    const v = Number(base + roundUp);
    return neg ? -v : v;
  }
  const v = Number(whole || '0') * 100 + Number(frac.padEnd(2, '0'));
  return neg ? -v : v;
}

const fmt = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 });

/** Format centavos → "₱1,234.56". `compact` drops centavos when zero. */
export function peso(c: Cents, opts: { compact?: boolean; sign?: boolean; currency?: 'PHP' | 'USD' } = {}): string {
  const neg = c < 0;
  const abs = Math.abs(c);
  const sym = opts.currency === 'USD' ? '$' : '₱';
  const body = opts.compact && abs % 100 === 0 ? fmt0.format(abs / 100) : fmt.format(abs / 100);
  const sign = neg ? '−' : opts.sign && c > 0 ? '+' : '';
  return `${sign}${sym}${body}`;
}

/** Short form: ₱12.5k, ₱1.2M — for chart axes only. */
export function pesoShort(c: Cents): string {
  const v = c / 100;
  if (Math.abs(v) >= 1_000_000) return `₱${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`;
  if (Math.abs(v) >= 1000) return `₱${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return `₱${Math.round(v)}`;
}

/** Plain decimal string for inputs/CSV: 123456 → "1234.56" */
export function toDecimalString(c: Cents): string {
  const neg = c < 0;
  const a = Math.abs(c);
  return `${neg ? '-' : ''}${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`;
}

export const sum = (xs: Cents[]) => xs.reduce((a, b) => a + b, 0);

/** Safe percentage (0–∞). */
export const pct = (part: number, whole: number) => (whole <= 0 ? 0 : (part / whole) * 100);

/** Multiply centavos by a decimal factor (e.g. shares × price, USD × fx) and round to the centavo. */
export const mulRound = (c: Cents, factor: number): Cents => Math.round(c * factor);
