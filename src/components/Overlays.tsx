import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { Icon } from './Icon';
import { cx } from './ui';
import { dueSlot, showSystemCheckIn } from '../lib/checkins';
import { nowLocal } from '../lib/date';

export function Toasts() {
  const { toasts, dismissToast, undo } = useStore();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-16 z-[70] flex flex-col items-center gap-2 px-4 sm:top-auto sm:bottom-24">
      {toasts.map((t) => (
        <div key={t.id} className={cx('pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-[14px] shadow-xl animate-rise',
          t.kind === 'error' ? 'bg-danger text-white' : t.kind === 'achievement' ? 'bg-forest text-[#F8F7F3] ring-1 ring-gold dark:bg-[#244B3C]' : 'bg-[#292B29] text-[#F8F7F3] dark:bg-[#ECE9E1] dark:text-[#292B29]')}>
          <Icon name={t.kind === 'error' ? 'AlertCircle' : t.kind === 'achievement' ? 'Award' : 'CheckCircle2'} size={18} className={t.kind === 'achievement' ? 'text-gold animate-pop' : ''} />
          <span className="flex-1">{t.message}</span>
          {t.undo && <button onClick={undo} className="rounded-lg px-2 py-1 text-[13px] font-semibold underline-offset-2 hover:underline">Undo</button>}
          <button onClick={() => dismissToast(t.id)} aria-label="Dismiss" className="opacity-70 hover:opacity-100"><Icon name="X" size={15} /></button>
        </div>
      ))}
    </div>
  );
}

/** Subtle celebration: a few gold sparks float up. Respects reduced motion via CSS. */
export function Celebration() {
  const { celebrate } = useStore();
  const [burst, setBurst] = useState(0);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } if (celebrate) setBurst((b) => b + 1); }, [celebrate]);
  useEffect(() => { if (!burst) return; const h = setTimeout(() => setBurst(0), 2000); return () => clearTimeout(h); }, [burst]);
  if (!burst) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[65] overflow-hidden" aria-hidden>
      {Array.from({ length: 14 }).map((_, i) => (
        <span key={`${burst}-${i}`} className="absolute bottom-1/3 animate-floatUp text-gold"
          style={{ left: `${30 + ((i * 37) % 40)}%`, animationDelay: `${(i % 7) * 90}ms`, fontSize: 10 + (i % 4) * 4 }}>✦</span>
      ))}
    </div>
  );
}

/** Runs the check-in schedule while Penny is open, and handles notification actions. */
export function CheckInManager() {
  const { state, commit, openAdd, ready } = useStore();
  const [visible, setVisible] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const respond = (response: 'logged' | 'nothing' | 'later') => {
    setVisible(false);
    if (response === 'logged') { openAdd({ kind: 'expense', source: 'checkin' }); return; }
    commit(response === 'nothing' ? 'Nice — noted that you spent nothing.' : 'I\'ll check in again in 30 minutes.', (d) => {
      d.checkInLog.push({ at: nowLocal(), response });
      if (response === 'later') {
        const t = new Date(Date.parse(nowLocal() + ':00Z') + 30 * 60_000).toISOString().slice(0, 16);
        d.snoozedUntil = t;
        d.lastCheckInPromptAt = undefined;
      }
      d.checkInLog = d.checkInLog.slice(-1000);
    }, { undo: false });
  };

  useEffect(() => {
    if (!ready) return;
    const tick = () => {
      const s = stateRef.current;
      const slot = dueSlot(s);
      if (!slot) return;
      commit(null, (d) => { d.lastCheckInPromptAt = nowLocal(); d.checkInLog.push({ at: nowLocal(), response: 'shown' }); }, { undo: false });
      setVisible(true);
      if (s.settings.checkIns.browserNotifications && document.visibilityState !== 'visible') showSystemCheckIn();
    };
    // Give you a minute after opening Penny before the first check-in.
    const first = setTimeout(tick, 60_000);
    const h = setInterval(tick, 30_000);
    return () => { clearTimeout(first); clearInterval(h); };
  }, [ready, commit]);

  // Notification action buttons → service worker → here. Also ?checkin= / ?add= deep links.
  useEffect(() => {
    if (!ready) return;
    const onMsg = (e: MessageEvent) => { if (e.data?.type === 'penny-checkin') respond(e.data.action === 'log' ? 'logged' : e.data.action); };
    navigator.serviceWorker?.addEventListener('message', onMsg);
    const q = new URLSearchParams(window.location.search);
    const a = q.get('checkin');
    if (a) respond(a === 'log' ? 'logged' : (a as 'nothing' | 'later'));
    if (q.get('add')) openAdd({ kind: 'expense' });
    if (a || q.get('add')) history.replaceState(null, '', window.location.pathname + window.location.hash);
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!visible) return null;
  return (
    <div role="dialog" aria-label="Penny check-in" className="fixed inset-x-3 bottom-[152px] z-40 mx-auto max-w-md card p-4 shadow-xl animate-rise sm:bottom-24 sm:right-6 sm:left-auto sm:mx-0 sm:w-[380px]">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-forest/10 text-forest"><Icon name="Clock" size={18} /></div>
        <div className="flex-1">
          <div className="text-[14px] font-semibold">Penny check-in</div>
          <p className="mt-0.5 text-[13.5px] text-muted">Spent anything since your last check-in? Log it while it's fresh.</p>
        </div>
        <button aria-label="Dismiss" onClick={() => setVisible(false)} className="text-muted hover:text-ink"><Icon name="X" size={16} /></button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="h-9 flex-1 rounded-xl bg-accent px-3 text-[13px] font-semibold text-accent-ink" onClick={() => respond('logged')}>Yes, log expense</button>
        <button className="h-9 flex-1 rounded-xl bg-sunken px-3 text-[13px] font-semibold" onClick={() => respond('nothing')}>Nothing spent</button>
        <button className="h-9 rounded-xl px-3 text-[13px] font-semibold text-muted hover:text-ink" onClick={() => respond('later')}>Later</button>
      </div>
    </div>
  );
}
