import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { Badge, Button, Card, Field, MoneyInput, Notice, PageHeader, Segmented, Toggle, useConfirm } from '../components/ui';
import { download, transactionsCsv } from '../lib/csv';
import { migrate } from '../lib/storage';
import { createInitialState } from '../lib/seed';
import { nextSlotLabel, notificationsSupported, showSystemCheckIn, slotHours } from '../lib/checkins';
import { today } from '../lib/date';
import type { CheckInSettings } from '../lib/types';

type BIPEvent = Event & { prompt: () => Promise<void> };

export default function SettingsPage() {
  const { state, commit, replaceState, toast } = useStore();
  const [confirmDialog, ask] = useConfirm();
  const s = state.settings;
  const c = s.checkIns;
  const fileRef = useRef<HTMLInputElement>(null);
  const [perm, setPerm] = useState(notificationsSupported() ? Notification.permission : 'unsupported');
  const [install, setInstall] = useState<BIPEvent | null>(null);
  const standalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;

  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setInstall(e as BIPEvent); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  const set = (patch: Partial<typeof s>) => commit(null, (d) => Object.assign(d.settings, patch), { undo: false });
  const setC = (patch: Partial<CheckInSettings>) => commit(null, (d) => Object.assign(d.settings.checkIns, patch), { undo: false });

  const requestPerm = async () => {
    if (!notificationsSupported()) return;
    const p = await Notification.requestPermission();
    setPerm(p);
    setC({ browserNotifications: p === 'granted' });
    if (p === 'granted') toast('Notifications allowed', 'success');
  };

  const importFile = async (f: File) => {
    try {
      const data = migrate(JSON.parse(await f.text()));
      const ok = await ask('Restore this backup?', { body: `This replaces everything in Penny with the backup (${data.transactions.length} transactions, ${data.accounts.length} accounts). Export a backup of your current data first if you might need it.`, confirm: 'Restore' });
      if (ok) { replaceState(data); toast('Backup restored', 'success'); }
    } catch (e) { toast(`Couldn't import: ${(e as Error).message}`, 'error'); }
  };

  const hours = slotHours(c);
  const hourOpts = Array.from({ length: 25 }, (_, h) => ({ v: h, l: h === 24 ? '12:00 AM (midnight)' : `${h % 12 || 12}:00 ${h < 12 ? 'AM' : 'PM'}` }));

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="Make Penny yours." />

      <Card title="Profile & salary">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name">{(id) => <input id={id} className="input" value={s.name} onChange={(e) => set({ name: e.target.value })} />}</Field>
          <Field label="Employer">{(id) => <input id={id} className="input" value={s.employer} onChange={(e) => set({ employer: e.target.value })} />}</Field>
          <Field label="Monthly gross salary">{(id) => <MoneyInput id={id} value={s.grossMonthly} onChange={(v) => v !== null && set({ grossMonthly: v })} />}</Field>
          <Field label="Planning take-home (net)" hint="A baseline only — you enter the actual amount each payday.">{(id) => <MoneyInput id={id} value={s.netMonthly} onChange={(v) => v !== null && set({ netMonthly: v })} />}</Field>
          <Field label="Payday (on or before)">{(id) => <input id={id} type="number" min={1} max={31} className="input" value={s.payDay} onChange={(e) => set({ payDay: Math.min(31, Math.max(1, Number(e.target.value))) })} />}</Field>
          <Field label="Emergency fund milestone">{(id) => <MoneyInput id={id} value={s.emergencyMilestone} onChange={(v) => v !== null && set({ emergencyMilestone: v })} />}</Field>
        </div>
        <p className="mt-3 text-[12.5px] text-muted">Currency: Philippine peso (PHP) · Timezone: Asia/Manila</p>
      </Card>

      <Card title="Appearance">
        <Segmented label="Theme" value={s.theme} onChange={(v) => set({ theme: v })} options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
      </Card>

      <Card title="Spending check-ins" subtitle="Gentle nudges to log expenses while they're fresh.">
        <div className="space-y-4">
          <Toggle checked={c.enabled} onChange={(v) => setC({ enabled: v })} label="Check-ins" description={c.enabled && hours.length ? `Next: ${nextSlotLabel(state)} · ${hours.length} possible per day` : 'Off'} />
          {c.enabled && <>
            <Field label="How often">{(id) => (
              <select id={id} className="input" value={c.frequency} onChange={(e) => setC({ frequency: e.target.value as CheckInSettings['frequency'] })}>
                <option value="hourly">Every hour</option><option value="2h">Every 2 hours</option><option value="4h">Every 4 hours</option><option value="daily">Once a day (end of window)</option><option value="custom">Custom times</option><option value="off">Off</option>
              </select>
            )}</Field>
            {c.frequency === 'custom' ? (
              <div>
                <div className="label">Times</div>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: 24 }, (_, h) => (
                    <button key={h} type="button" aria-pressed={c.customHours.includes(h)} className={`chip !px-2.5 !py-1 ${c.customHours.includes(h) ? 'chip-on' : ''}`}
                      onClick={() => setC({ customHours: c.customHours.includes(h) ? c.customHours.filter((x) => x !== h) : [...c.customHours, h].sort((a, b) => a - b) })}>
                      {h % 12 || 12}{h < 12 ? 'a' : 'p'}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Active from">{(id) => <select id={id} className="input" value={c.startHour} onChange={(e) => setC({ startHour: Number(e.target.value) })}>{hourOpts.slice(0, 24).map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>}</Field>
                <Field label="Until" hint="Oracle shift 3 PM–12 AM by default fits inside this.">{(id) => <select id={id} className="input" value={c.endHour} onChange={(e) => setC({ endHour: Number(e.target.value) })}>{hourOpts.slice(1).map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>}</Field>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Quiet hours from">{(id) => <select id={id} className="input" value={c.quietStart} onChange={(e) => setC({ quietStart: Number(e.target.value) })}>{hourOpts.slice(0, 24).map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>}</Field>
              <Field label="Quiet hours until">{(id) => <select id={id} className="input" value={c.quietEnd} onChange={(e) => setC({ quietEnd: Number(e.target.value) })}>{hourOpts.slice(0, 24).map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>}</Field>
              <Field label="Daily limit">{(id) => <input id={id} type="number" min={1} max={24} className="input" value={c.dailyLimit} onChange={(e) => setC({ dailyLimit: Math.max(1, Number(e.target.value)) })} />}</Field>
            </div>

            <div className="rounded-xl border border-line/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[14.5px] font-medium">Browser notifications</div>
                  <div className="text-[13px] text-muted">Permission: <Badge tone={perm === 'granted' ? 'good' : perm === 'denied' ? 'danger' : 'neutral'}>{perm}</Badge></div>
                </div>
                {perm === 'default' && <Button size="sm" onClick={requestPerm}>Allow notifications</Button>}
                {perm === 'granted' && <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={async () => { const ok = await showSystemCheckIn(); toast(ok ? 'Test notification sent' : 'Couldn\'t show a notification', ok ? 'success' : 'error'); }}>Send test</Button>
                  <Toggle checked={c.browserNotifications} onChange={(v) => setC({ browserNotifications: v })} label="Use" /></div>}
              </div>
              {perm === 'denied' && <p className="mt-2 text-[12.5px] text-muted">Notifications are blocked for this site. You can re-enable them in your browser's site settings. In-app check-ins still work.</p>}
            </div>
          </>}
          <Notice>
            <b>How check-ins work (honestly):</b> while Penny is open — on screen or in a background tab — you'll get an in-app prompt, plus a system notification if allowed and Penny isn't in front. Browsers don't let web apps run timers once they're fully closed, so <b>Penny can't remind you when it's closed</b>. Doing that needs a push server (Web Push); Penny's service worker is already wired to receive pushes, so this can be added with a backend later. Tip: install Penny and keep it open in the background during your shift.
          </Notice>
        </div>
      </Card>

      <Card title="Install Penny">
        {standalone ? <Notice tone="good">Penny is installed and running as an app.</Notice> : install
          ? <div className="flex items-center justify-between gap-3"><p className="text-[14px] text-muted">Add Penny to your home screen or dock. It works offline for logging.</p><Button onClick={async () => { await install.prompt(); setInstall(null); }}>Install</Button></div>
          : <p className="text-[14px] text-muted">On iPhone: Share → Add to Home Screen. On Android/desktop Chrome: use "Install app" in the browser menu. Penny keeps working offline; data stays on this device.</p>}
      </Card>

      <Card title="Your data" subtitle="Everything is stored on this device only. Back it up regularly.">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon="Download" onClick={() => download(`penny-backup-${today()}.json`, JSON.stringify(state, null, 2), 'application/json')}>Export backup (JSON)</Button>
          <Button variant="secondary" icon="Download" onClick={() => download(`penny-transactions-${today()}.csv`, transactionsCsv(state), 'text/csv')}>Export transactions (CSV)</Button>
          <Button variant="secondary" icon="Upload" onClick={() => fileRef.current?.click()}>Restore from backup</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ''; }} />
        </div>
        <div className="mt-5 border-t border-line pt-4">
          <Button variant="ghost" className="!text-danger" icon="Trash2" onClick={async () => {
            if (await ask('Reset Penny?', { body: 'This erases every transaction, account change and setting on this device and starts over from your original profile. Export a backup first if you want to keep anything.', confirm: 'Erase everything' })) { replaceState(createInitialState()); toast('Penny has been reset'); }
          }}>Reset all data</Button>
        </div>
      </Card>
      <p className="pb-4 text-center text-[12px] text-faint">Penny · Every peso has a purpose · Data stored locally · Ready for Supabase sync</p>
      {confirmDialog}
    </div>
  );
}
