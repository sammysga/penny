import { useState } from 'react';
import { useStore } from '../lib/store';
import { Badge, Button, Card, Empty, Field, Modal, Money, MoneyInput, Notice, PageHeader, Progress, Segmented, useConfirm } from '../components/ui';
import { Icon } from '../components/Icon';
import { wishSaved } from '../lib/ledger';
import { affordability, wantsRemaining } from '../lib/afford';
import { dateLabel, nowLocal } from '../lib/date';
import { peso, type Cents } from '../lib/money';
import { addTxn, earmark, uid } from '../lib/actions';
import type { WishItem } from '../lib/types';

export default function Wishlist() {
  const { state } = useStore();
  const [filter, setFilter] = useState<'active' | 'purchased' | 'all'>('active');
  const [edit, setEdit] = useState<WishItem | 'new' | null>(null);
  const [aside, setAside] = useState<WishItem | null>(null);
  const [buy, setBuy] = useState<WishItem | null>(null);
  const items = state.wishlist.filter((w) => filter === 'all' || (filter === 'active' ? w.status === 'wishing' || w.status === 'saving' : w.status === 'purchased'))
    .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]));
  const { remaining } = wantsRemaining(state);

  return (
    <div>
      <PageHeader title="Wishlist" subtitle="Plan the things you love, and buy them guilt-free when they fit."
        actions={<Button icon="Plus" onClick={() => setEdit('new')}>Add item</Button>} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented size="sm" label="Filter" value={filter} onChange={setFilter} options={[{ value: 'active', label: 'Wishing' }, { value: 'purchased', label: 'Purchased' }, { value: 'all', label: 'All' }]} />
        <span className="text-[13px] text-muted">Wants fund left this month: <b className="num text-ink">{peso(Math.max(0, remaining))}</b></span>
      </div>
      {items.length === 0 ? <Card><Empty icon="Heart" title="Nothing here" body="Add something you're dreaming about — Penny will tell you honestly when it fits." /></Card> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((w) => {
            const saved = wishSaved(state, w.id);
            const aff = affordability(state, w);
            return (
              <article key={w.id} className="card flex flex-col overflow-hidden animate-rise">
                <div className="relative aspect-[16/9] bg-gradient-to-br from-beige to-sunken">
                  {w.imageUrl ? <img src={w.imageUrl} alt="" className="h-full w-full object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} /> : <div className="grid h-full place-items-center text-forest/60"><Icon name="ShoppingBag" size={34} /></div>}
                  <div className="absolute left-3 top-3 flex gap-1"><Badge tone={w.priority === 'high' ? 'gold' : 'neutral'} className="bg-surface/90">{w.priority} priority</Badge>{w.status === 'purchased' && <Badge tone="good" className="bg-surface/90">Purchased</Badge>}</div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{w.name}</h3>
                    <Money value={w.price} className="font-semibold" />
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-muted">{w.targetDate ? `Target ${dateLabel(w.targetDate, { year: true })}` : 'No target date'}{w.link && <> · <a href={w.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-forest hover:underline">Link <Icon name="ExternalLink" size={11} /></a></>}</div>
                  {w.status !== 'purchased' && <>
                    <div className="mt-3 flex justify-between text-[12.5px]"><span className="text-muted">Set aside</span><span className="num">{peso(saved, { compact: true })} of {peso(w.price, { compact: true })}</span></div>
                    <Progress value={(saved / w.price) * 100} tone="gold" thin className="mt-1" label={`${w.name} savings`} />
                    <p className={`mt-3 text-[13px] ${aff.tone === 'good' ? 'text-good' : aff.tone === 'warn' ? 'text-warn' : 'text-muted'}`}>{aff.text}</p>
                  </>}
                  {w.notes && <p className="mt-2 text-[12.5px] text-muted">{w.notes}</p>}
                  <div className="mt-auto flex gap-2 pt-4">
                    {w.status !== 'purchased' ? <>
                      <Button size="sm" variant="secondary" className="flex-1" onClick={() => setAside(w)}>Set aside</Button>
                      <Button size="sm" className="flex-1" onClick={() => setBuy(w)}>I bought it</Button>
                    </> : null}
                    <Button size="sm" variant="ghost" aria-label={`Edit ${w.name}`} onClick={() => setEdit(w)}><Icon name="Pencil" size={15} /></Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {edit && <WishEditor item={edit} onClose={() => setEdit(null)} />}
      {aside && <SetAside item={aside} onClose={() => setAside(null)} />}
      {buy && <Purchase item={buy} onClose={() => setBuy(null)} />}
    </div>
  );
}

function SetAside({ item, onClose }: { item: WishItem; onClose: () => void }) {
  const { state, commit } = useStore();
  const { remaining } = wantsRemaining(state);
  const saved = wishSaved(state, item.id);
  const [amt, setAmt] = useState<Cents | null>(Math.min(Math.max(0, remaining), item.price - saved) || null);
  const over = (amt ?? 0) > remaining;
  return (
    <Modal open onClose={onClose} title={`Set aside for ${item.name}`}
      footer={<><Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button><Button className="flex-1" disabled={!amt} onClick={() => { if (amt && commit(`${peso(amt)} set aside for ${item.name}`, (d) => { earmark(d, { wishId: item.id }, amt); const w = d.wishlist.find((x) => x.id === item.id)!; w.status = 'saving'; })) onClose(); }}>Set aside</Button></>}>
      <div className="space-y-4">
        <p className="text-[14px] text-muted">This earmarks money from this month's wants budget. It stays in your account — it just has a job now.</p>
        <Field label="Amount" hint={`Wants budget left: ${peso(Math.max(0, remaining))}`}>{(id) => <MoneyInput id={id} value={amt} onChange={setAmt} large />}</Field>
        {over && <Notice tone="warn">That's more than your wants budget has left this month. Consider setting aside the rest next payday.</Notice>}
      </div>
    </Modal>
  );
}

function Purchase({ item, onClose }: { item: WishItem; onClose: () => void }) {
  const { state, commit } = useStore();
  const saved = wishSaved(state, item.id);
  const [amt, setAmt] = useState<Cents | null>(item.price);
  const [acc, setAcc] = useState(state.accounts.find((a) => a.role === 'spending' && a.status === 'active')?.id ?? state.accounts.find((a) => a.role === 'salary')?.id ?? '');
  return (
    <Modal open onClose={onClose} title={`Record purchase: ${item.name}`}
      footer={<><Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button><Button className="flex-1" disabled={!amt} onClick={() => {
        if (amt && commit(`${item.name} purchased — enjoy it`, (d) => {
          const t = addTxn(d, { kind: 'expense', amount: amt, datetime: nowLocal(), accountId: acc, categoryId: item.category || 'wants', merchant: item.name, wishId: item.id, earmarkUse: Math.min(Math.max(0, saved), amt), source: 'wishlist' });
          const w = d.wishlist.find((x) => x.id === item.id)!; w.status = 'purchased'; w.purchaseTxnId = t.id;
        })) onClose();
      }}>Record purchase</Button></>}>
      <div className="space-y-4">
        <Field label="Actual price paid">{(id) => <MoneyInput id={id} value={amt} onChange={setAmt} large />}</Field>
        <Field label="Paid with">{(id) => <select id={id} className="input" value={acc} onChange={(e) => setAcc(e.target.value)}>{state.accounts.filter((a) => a.status === 'active' && a.role !== 'main_savings').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}</Field>
        <Notice>{saved > 0 ? `${peso(Math.min(saved, amt ?? 0))} comes from what you set aside (already counted in past wants budgets). ` : ''}{(amt ?? 0) > saved ? `${peso((amt ?? 0) - saved)} counts toward this month's wants budget.` : ''}</Notice>
      </div>
    </Modal>
  );
}

function WishEditor({ item, onClose }: { item: WishItem | 'new'; onClose: () => void }) {
  const { commit } = useStore();
  const [confirmDialog, ask] = useConfirm();
  const isNew = item === 'new';
  const [w, setW] = useState<WishItem>(() => isNew ? { id: uid('w_'), name: '', price: 0, priority: 'medium', category: 'wants', status: 'wishing', createdAt: nowLocal() } : { ...item });
  const set = <K extends keyof WishItem>(k: K, v: WishItem[K]) => setW((x) => ({ ...x, [k]: v }));
  const save = () => { if (w.name.trim() && w.price > 0 && commit(isNew ? 'Added to wishlist' : 'Saved', (d) => { const i = d.wishlist.findIndex((x) => x.id === w.id); if (i >= 0) d.wishlist[i] = w; else d.wishlist.push(w); })) onClose(); };
  const del = async () => { if (await ask(`Remove ${w.name}?`, { body: 'Any money set aside for it returns to being unassigned (past budgets aren\'t changed).', confirm: 'Remove' }) && commit('Removed from wishlist', (d) => { d.wishlist = d.wishlist.filter((x) => x.id !== w.id); d.earmarks = d.earmarks.filter((e) => !(typeof e.target === 'object' && e.target.wishId === w.id)); })) onClose(); };
  return (
    <Modal open wide onClose={onClose} title={isNew ? 'Add to wishlist' : `Edit ${w.name}`}
      footer={<>{!isNew && <Button variant="ghost" icon="Trash2" onClick={del}>Remove</Button>}<Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button><Button className="flex-1" onClick={save}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Item">{(id) => <input id={id} className="input" value={w.name} onChange={(e) => set('name', e.target.value)} />}</Field>
        <Field label="Estimated price">{(id) => <MoneyInput id={id} value={w.price} onChange={(v) => set('price', v ?? 0)} />}</Field>
        <Field label="Priority">{(id) => <select id={id} className="input" value={w.priority} onChange={(e) => set('priority', e.target.value as WishItem['priority'])}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>}</Field>
        <Field label="Target date">{(id) => <input id={id} type="date" className="input" value={w.targetDate ?? ''} onChange={(e) => set('targetDate', e.target.value || undefined)} />}</Field>
        <Field label="Category">{(id) => <select id={id} className="input" value={w.category} onChange={(e) => set('category', e.target.value)}><option value="wants">Wants & shopping</option><option value="sports">Golf & pickleball</option><option value="skincare">Skincare</option><option value="other">Other</option></select>}</Field>
        <Field label="Status">{(id) => <select id={id} className="input" value={w.status} onChange={(e) => set('status', e.target.value as WishItem['status'])}><option value="wishing">Wishing</option><option value="saving">Saving</option><option value="dropped">Decided against</option>{w.purchaseTxnId && <option value="purchased">Purchased</option>}</select>}</Field>
        <Field label="Product link" className="sm:col-span-2">{(id) => <input id={id} className="input" type="url" value={w.link ?? ''} onChange={(e) => set('link', e.target.value || undefined)} placeholder="https://" />}</Field>
        <Field label="Image URL" className="sm:col-span-2">{(id) => <input id={id} className="input" type="url" value={w.imageUrl ?? ''} onChange={(e) => set('imageUrl', e.target.value || undefined)} placeholder="https://…jpg" />}</Field>
        <Field label="Notes" className="sm:col-span-2">{(id) => <textarea id={id} rows={2} className="input" value={w.notes ?? ''} onChange={(e) => set('notes', e.target.value || undefined)} />}</Field>
      </div>
      {confirmDialog}
    </Modal>
  );
}
