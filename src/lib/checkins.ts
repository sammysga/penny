import type { AppState, CheckInSettings } from './types';
import { nowLocal, today } from './date';

/**
 * Spending check-ins.
 * HONEST LIMITS: a web app/PWA can only run timers while it is open (foreground or a
 * background tab the browser hasn't frozen). Penny fires in-app prompts and, if you
 * allow it, system notifications while the app is open. Reminders while Penny is fully
 * closed would need a push server (Web Push + VAPID) — the service worker already handles
 * `push` events, so a backend can be added later without changing the UI.
 */

const inQuiet = (h: number, c: CheckInSettings) =>
  c.quietStart === c.quietEnd ? false : c.quietStart < c.quietEnd ? h >= c.quietStart && h < c.quietEnd : h >= c.quietStart || h < c.quietEnd;

export function slotHours(c: CheckInSettings): number[] {
  if (!c.enabled || c.frequency === 'off') return [];
  let hours: number[];
  const end = c.endHour <= c.startHour ? c.endHour + 24 : c.endHour;
  const range = (step: number) => { const r: number[] = []; for (let h = c.startHour + (step === 1 ? 0 : step); h < end; h += step) r.push(h % 24); return r; };
  switch (c.frequency) {
    case 'hourly': hours = range(1); break;
    case '2h': hours = range(2); break;
    case '4h': hours = range(4); break;
    case 'daily': hours = [((end - 1) % 24)]; break;
    case 'custom': hours = [...c.customHours]; break;
    default: hours = [];
  }
  return [...new Set(hours)].filter((h) => !inQuiet(h, c)).sort((a, b) => a - b);
}

export function promptsToday(s: AppState) {
  const d = today();
  return s.checkInLog.filter((x) => x.response === 'shown' && x.at.startsWith(d)).length;
}

/** Returns the slot key ("YYYY-MM-DDTHH") that is due now, or null. */
export function dueSlot(s: AppState): string | null {
  const c = s.settings.checkIns;
  const now = nowLocal();
  const h = Number(now.slice(11, 13));
  if (!slotHours(c).includes(h)) return null;
  const slot = now.slice(0, 13);
  if (s.lastCheckInPromptAt && s.lastCheckInPromptAt.slice(0, 13) >= slot) return null;
  if (s.snoozedUntil && s.snoozedUntil > now) return null;
  if (promptsToday(s) >= c.dailyLimit) return null;
  // Skip if you logged something in the last 45 minutes — you're already on top of it.
  const recent = s.transactions.some((t) => !t.deletedAt && t.kind === 'expense' && minutesBetween(t.createdAt, now) < 45);
  if (recent) return null;
  return slot;
}

export function nextSlotLabel(s: AppState): string | null {
  const hours = slotHours(s.settings.checkIns);
  if (!hours.length) return null;
  const h = Number(nowLocal().slice(11, 13));
  const next = hours.find((x) => x > h) ?? hours[0];
  const ap = next >= 12 ? 'PM' : 'AM';
  return `${next % 12 || 12}:00 ${ap}${next <= h ? ' tomorrow' : ''}`;
}

function minutesBetween(a: string, b: string) {
  return Math.abs(Date.parse(b + ':00Z') - Date.parse(a + ':00Z')) / 60000;
}

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export async function showSystemCheckIn() {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false;
  const body = 'Spent anything since your last check-in? Log it while it\'s fresh.';
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification('Penny check-in', {
        body, tag: 'penny-checkin', icon: './icon-192.png', badge: './icon-192.png',
        // @ts-expect-error actions are supported in SW notifications on Chromium
        actions: [{ action: 'log', title: 'Yes, log expense' }, { action: 'nothing', title: 'Nothing spent' }, { action: 'later', title: 'Later' }],
      });
      return true;
    }
    new Notification('Penny check-in', { body, tag: 'penny-checkin', icon: './icon-192.png' });
    return true;
  } catch { return false; }
}
