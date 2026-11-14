/**
 * Dates in Penny are stored as Manila wall-clock strings:
 *   date: "YYYY-MM-DD", datetime: "YYYY-MM-DDTHH:mm", month: "YYYY-MM".
 * This avoids UTC drift — Asia/Manila has no DST (fixed UTC+8).
 */
export const TZ = 'Asia/Manila';

function parts(d: Date) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return { y: g('year'), m: g('month'), d: g('day'), h: g('hour'), min: g('minute') };
}

/** Allows tests / demos to pin "now". */
let nowOverride: Date | null = null;
export const setNow = (d: Date | null) => { nowOverride = d; };
export const realNow = () => nowOverride ?? new Date();

export function nowLocal(): string {
  const p = parts(realNow());
  return `${p.y}-${p.m}-${p.d}T${p.h}:${p.min}`;
}
export const today = () => nowLocal().slice(0, 10);
export const thisMonth = () => nowLocal().slice(0, 7);
export const currentHour = () => Number(nowLocal().slice(11, 13));

export const monthOf = (dt: string) => dt.slice(0, 7);

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}
export function monthDiff(a: string, b: string): number {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb * 12 + mb) - (ya * 12 + ma);
}
export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
/** Pure calendar arithmetic on "YYYY-MM-DD". */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
export function dayDiff(a: string, b: string): number {
  const ta = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const tb = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((tb - ta) / 86_400_000);
}
/** Add a frequency step to a date, clamping day-of-month (Jan 31 + 1 month → Feb 28). */
export function addPeriod(date: string, freq: 'weekly' | 'monthly' | 'quarterly' | 'yearly'): string {
  if (freq === 'weekly') return addDays(date, 7);
  const months = freq === 'monthly' ? 1 : freq === 'quarterly' ? 3 : 12;
  const target = addMonths(date.slice(0, 7), months);
  const day = Math.min(Number(date.slice(8, 10)), daysInMonth(target));
  return `${target}-${String(day).padStart(2, '0')}`;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export function monthLabel(month: string, short = false): string {
  const [y, m] = month.split('-').map(Number);
  const name = MONTHS[m - 1];
  return short ? `${name.slice(0, 3)} ${y}` : `${name} ${y}`;
}
export function dateLabel(date: string, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('en-PH', {
    timeZone: 'UTC', month: 'short', day: 'numeric',
    ...(opts.weekday ? { weekday: 'long' } : {}), ...(opts.year ? { year: 'numeric' } : {}),
  });
}
export function timeLabel(dt: string): string {
  if (dt.length < 16) return '';
  let h = Number(dt.slice(11, 13));
  const m = dt.slice(14, 16);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}
export function relativeDay(date: string): string {
  const diff = dayDiff(today(), date.slice(0, 10));
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  return dateLabel(date, { year: date.slice(0, 4) !== today().slice(0, 4) });
}
export function greeting(): string {
  const h = currentHour();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
