import { useState } from 'react';
import { useStore } from '../lib/store';
import { Badge, Button, Card, Field, Modal, MoneyInput, Notice, PageHeader, Ring, cx, useConfirm } from '../components/ui';
import { Icon } from '../components/Icon';
import { ACHIEVEMENTS, achievementById } from '../lib/achievements';
import { bestTrackingStreak, rewardFundBalance, savingsStreak, trackingStreak } from '../lib/ledger';
import { mainSavings } from '../lib/projections';
import { wantsRemaining } from '../lib/afford';
import { dateLabel, nowLocal } from '../lib/date';
import { peso, type Cents } from '../lib/money';
import { addTxn, earmark, uid } from '../lib/actions';
import type { AppState, Reward } from '../lib/types';

function rewardStatus(s: AppState, r: Reward, fund: Cents) {
  if (r.redeemedTxnId) return 'redeemed' as const;
  const met = r.condition.type === 'none' ? true : r.condition.type === 'savings' ? mainSavings(s) >= r.condition.amount : !!s.achievements[r.condition.achievementId];
  if (!met) return 'locked' as const;
  return fund >= r.cost ? ('ready' as const) : ('eligible' as const);
}

const condText = (r: Reward) => r.condition.type === 'none' ? 'No condition' : r.condition.type === 'savings' ? `Savings reach ${peso(r.condition.amount, { compact: true })}` : `Unlock "${achievementById(r.condition.achievementId)?.title}"`;

export default function Rewards() {
  const { state } = useStore();
  const fund = rewardFundBalance(state);
  const [fundOpen, setFundOpen] = useState(false);
  const [edit, setEdit] = useState<Reward | 'new' | null>(null);
  const [redeem, setRedeem] = useState<Reward | null>(null);
  const unlocked = ACHIEVEMENTS.filter((a) => state.achievements[a.id]).sort((a, b) => state.achievements[a.id].localeCompare(state.achievements[b.id]));

  return (
    <div className="space-y-5">
      <PageHeader title="Rewards" subtitle="Celebrate progress — funded by money you've already set aside, never by your savings." />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="relative overflow-hidden rounded-2xl bg-[#292B29] p-6 text-[#F8F7F3] shadow-soft lg:col-span-1">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full border border-gold/40" aria-hidden />
          <div className="text-[13px] text-[#F8F7F3]/70">Rewards Wallet</div>
          <div className="serif num mt-1 text-[34px]">{peso(fund)}</div>
          <p className="mt-1 text-[13px] text-[#F8F7F3]/70">Set aside from your wants budget. Achievements unlock permission to spend it — they don't create money.</p>
          <button onClick={() => setFundOpen(true)} className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-xl bg-gold px-3.5 text-[13.5px] font-semibold text-[#292B29] hover:opacity-90"><Icon name="Plus" size={15} /> Add to fund</button>
        </section>
        <Card className="lg:col-span-2" title="Streaks">
          <div className="grid grid-cols-3 gap-4 text-center">
            {[['Flame', trackingStreak(state), 'day tracking streak'], ['Star', bestTrackingStreak(state), 'best tracking streak'], ['PiggyBank', savingsStreak(state), 'month savings streak']].map(([ic, n, l]) => (
              <div key={l as string}>
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-gold/15"><Icon name={ic as string} size={19} /></div>
                <div className="serif num mt-2 text-[26px]">{n as number}</div>
                <div className="text-[12px] text-muted">{l}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="My rewards" subtitle="Locked until the milestone is reached; ready once the wallet can cover it." action={<Button size="sm" variant="secondary" icon="Plus" onClick={() => setEdit('new')}>Reward</Button>}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {state.rewards.map((r) => {
            const st = rewardStatus(state, r, fund);
            return (
              <div key={r.id} className={cx('rounded-2xl border p-4 transition', st === 'ready' ? 'border-gold bg-gold/5' : 'border-line/70', st === 'locked' && 'opacity-80')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-sunken"><Icon name={st === 'locked' ? 'Lock' : st === 'redeemed' ? 'CheckCircle2' : 'Gift'} size={17} className={st === 'ready' ? 'text-gold' : 'text-muted'} /></div>
                  <Badge tone={st === 'ready' ? 'gold' : st === 'redeemed' ? 'good' : st === 'eligible' ? 'accent' : 'neutral'}>{{ locked: 'Locked', eligible: 'Unlocked · needs funding', ready: 'Ready to enjoy', redeemed: 'Enjoyed' }[st]}</Badge>
                </div>
                <div className="mt-3 font-semibold">{r.name}</div>
                <div className="text-[13px] text-muted">Up to <span className="num">{peso(r.cost)}</span> · {condText(r)}</div>
                {st === 'eligible' && <p className="mt-2 text-[12.5px] text-muted">Add {peso(r.cost - fund)} more to the wallet to redeem.</p>}
                {st === 'redeemed' && r.redeemedAt && <p className="mt-2 text-[12.5px] text-muted">Enjoyed {dateLabel(r.redeemedAt, { year: true })}</p>}
                <div className="mt-3 flex gap-2">
                  {st === 'ready' && <Button size="sm" onClick={() => setRedeem(r)}>Redeem</Button>}
                  <Button size="sm" variant="ghost" onClick={() => setEdit(r)}>Edit</Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Achievements" subtitle={`${unlocked.length} of ${ACHIEVEMENTS.length} collected`}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {ACHIEVEMENTS.map((a) => {
            const c = a.check(state);
            const at = state.achievements[a.id];
            return (
              <div key={a.id} className={cx('flex flex-col items-center rounded-2xl border p-4 text-center', at ? 'border-gold/60 bg-gold/5' : 'border-line/60')}>
                <Ring value={(at ? 1 : c.progress) * 100} size={64} stroke={5} tone={at ? 'gold' : 'forest'} label={`${a.title}: ${Math.round(c.progress * 100)}%`}>
                  <Icon name={at ? 'Award' : a.kind === 'milestone' ? 'Target' : 'Star'} size={20} className={at ? 'text-gold' : 'text-faint'} />
                </Ring>
                <div className={cx('mt-2 text-[13px] font-semibold leading-tight', !at && 'text-muted')}>{a.title}</div>
                <div className="mt-0.5 text-[11.5px] text-muted">{at ? `Unlocked ${dateLabel(at, { year: true })}` : c.detail ?? a.description}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {unlocked.length > 0 && (
        <Card title="Your timeline">
          <ol className="relative ml-2 border-l border-line pl-5">
            {unlocked.map((a) => (
              <li key={a.id} className="mb-4 last:mb-0">
                <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-gold" />
                <div className="text-[14px] font-medium">{a.title}</div>
                <div className="text-[12.5px] text-muted">{dateLabel(state.achievements[a.id], { year: true })} · {a.description}</div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {fundOpen && <FundModal onClose={() => setFundOpen(false)} />}
      {edit && <RewardEditor reward={edit} onClose={() => setEdit(null)} />}
      {redeem && <RedeemModal reward={redeem} fund={fund} onClose={() => setRedeem(null)} />}
    </div>
  );
}

function FundModal({ onClose }: { onClose: () => void }) {
  const { state, commit } = useStore();
  const { remaining } = wantsRemaining(state);
  const [amt, setAmt] = useState<Cents | null>(null);
  return (
    <Modal open onClose={onClose} title="Add to Rewards Wallet"
      footer={<><Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button><Button className="flex-1" disabled={!amt} onClick={() => { if (amt && commit(`${peso(amt)} added to your rewards wallet`, (d) => earmark(d, 'reward_fund', amt))) onClose(); }}>Add</Button></>}>
      <div className="space-y-4">
        <p className="text-[14px] text-muted">Moves part of this month's wants budget into your Rewards Wallet. The cash stays in your account; it's simply reserved for celebrating.</p>
        <Field label="Amount" hint={`Wants budget left this month: ${peso(Math.max(0, remaining))}`}>{(id) => <MoneyInput id={id} value={amt} onChange={setAmt} large />}</Field>
        {(amt ?? 0) > remaining && <Notice tone="warn">That's more than this month's wants budget has left — it would push wants over budget.</Notice>}
      </div>
    </Modal>
  );
}

function RedeemModal({ reward, fund, onClose }: { reward: Reward; fund: Cents; onClose: () => void }) {
  const { state, commit } = useStore();
  const [amt, setAmt] = useState<Cents | null>(reward.cost);
  const [acc, setAcc] = useState(state.accounts.find((a) => a.role === 'spending' && a.status === 'active')?.id ?? state.accounts.find((a) => a.role === 'salary')?.id ?? '');
  return (
    <Modal open onClose={onClose} title={`Enjoy: ${reward.name}`}
      footer={<><Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button><Button className="flex-1" disabled={!amt} onClick={() => {
        if (amt && commit(`Enjoy your ${reward.name.toLowerCase()} — you earned it.`, (d) => {
          const t = addTxn(d, { kind: 'expense', amount: amt, datetime: nowLocal(), accountId: acc, categoryId: 'rewards', merchant: reward.name, rewardId: reward.id, earmarkUse: Math.min(amt, fund), source: 'reward' });
          const r = d.rewards.find((x) => x.id === reward.id)!; r.redeemedTxnId = t.id; r.redeemedAt = nowLocal();
        })) onClose();
      }}>Record & celebrate</Button></>}>
      <div className="space-y-4">
        <Field label="What it actually cost">{(id) => <MoneyInput id={id} value={amt} onChange={setAmt} large />}</Field>
        <Field label="Paid with">{(id) => <select id={id} className="input" value={acc} onChange={(e) => setAcc(e.target.value)}>{state.accounts.filter((a) => a.status === 'active' && a.role !== 'main_savings').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}</Field>
        {(amt ?? 0) > fund && <Notice tone="warn">{peso((amt ?? 0) - fund)} is beyond the wallet and will count as regular rewards spending this month.</Notice>}
      </div>
    </Modal>
  );
}

function RewardEditor({ reward, onClose }: { reward: Reward | 'new'; onClose: () => void }) {
  const { commit } = useStore();
  const [confirmDialog, ask] = useConfirm();
  const isNew = reward === 'new';
  const [r, setR] = useState<Reward>(() => isNew ? { id: uid('r_'), name: '', cost: 50_000, condition: { type: 'savings', amount: 10_000_000 }, createdAt: nowLocal() } : structuredClone(reward));
  return (
    <Modal open onClose={onClose} title={isNew ? 'New reward' : 'Edit reward'}
      footer={<>{!isNew && <Button variant="ghost" icon="Trash2" onClick={async () => { if (await ask('Delete this reward?', { confirm: 'Delete' }) && commit('Reward deleted', (d) => { d.rewards = d.rewards.filter((x) => x.id !== r.id); })) onClose(); }}>Delete</Button>}
        <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" onClick={() => { if (r.name.trim() && commit('Reward saved', (d) => { const i = d.rewards.findIndex((x) => x.id === r.id); if (i >= 0) d.rewards[i] = r; else d.rewards.push(r); })) onClose(); }}>Save</Button></>}>
      <div className="space-y-4">
        <Field label="Reward">{(id) => <input id={id} className="input" value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} placeholder="e.g. Perfume, new golf glove" />}</Field>
        <Field label="Spend up to">{(id) => <MoneyInput id={id} value={r.cost} onChange={(v) => setR({ ...r, cost: v ?? 0 })} />}</Field>
        <Field label="Unlocks when">{(id) => (
          <select id={id} className="input" value={r.condition.type === 'achievement' ? `a:${r.condition.achievementId}` : r.condition.type}
            onChange={(e) => { const v = e.target.value; setR({ ...r, condition: v === 'none' ? { type: 'none' } : v === 'savings' ? { type: 'savings', amount: 10_000_000 } : { type: 'achievement', achievementId: v.slice(2) } }); }}>
            <option value="savings">Main savings reach an amount</option>
            <option value="none">Anytime (wallet funded)</option>
            {ACHIEVEMENTS.filter((a) => a.kind === 'habit').map((a) => <option key={a.id} value={`a:${a.id}`}>Achievement: {a.title}</option>)}
          </select>
        )}</Field>
        {r.condition.type === 'savings' && <Field label="Savings amount">{(id) => <MoneyInput id={id} value={r.condition.type === 'savings' ? r.condition.amount : 0} onChange={(v) => setR({ ...r, condition: { type: 'savings', amount: v ?? 0 } })} />}</Field>}
        <p className="text-[12.5px] text-muted">Rewards are always paid from your Rewards Wallet — never from protected savings.</p>
      </div>
      {confirmDialog}
    </Modal>
  );
}
