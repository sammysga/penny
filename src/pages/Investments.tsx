import { useState } from 'react';
import { useStore } from '../lib/store';
import { Badge, Button, Card, Empty, Field, Modal, Money, MoneyInput, Notice, PageHeader, Progress, Segmented, useConfirm } from '../components/ui';
import { Icon } from '../components/Icon';
import { accountBalance, accountByRole } from '../lib/ledger';
import { ASSET_LABEL, portfolioSummary } from '../lib/invest';
import { dateLabel, today } from '../lib/date';
import { parseMoney, peso, type Cents } from '../lib/money';
import { deleteTrade, recordTrade, uid } from '../lib/actions';
import type { AssetType, Holding, Trade } from '../lib/types';

const fmtLocal = (v: number, cur: 'PHP' | 'USD') => peso(v, { currency: cur });

export default function Investments() {
  const { state, commit } = useStore();
  const [hEdit, setHEdit] = useState<Holding | 'new' | null>(null);
  const [trade, setTrade] = useState<string | null>(null);
  const [fxOpen, setFxOpen] = useState(false);
  const [confirmDialog, ask] = useConfirm();
  const p = portfolioSummary(state);
  const cashAccs = (['investment_cash', 'brokerage'] as const).map((r) => accountByRole(state, r)).filter(Boolean);
  const byType = Object.entries(p.stats.reduce<Record<string, number>>((a, s) => ({ ...a, [s.holding.assetType]: (a[s.holding.assetType] ?? 0) + s.valuePhp }), {}));
  const trades = [...state.trades].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-5">
      <PageHeader title="Investments" subtitle="A simple, honest tracker. Prices are entered by you — Penny never fetches quotes or trades."
        actions={<><Button variant="secondary" onClick={() => setFxOpen(true)}>USD/PHP {state.settings.usdPhp.toFixed(2)}</Button><Button icon="Plus" onClick={() => setHEdit('new')}>Holding</Button></>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[['Current value', p.valuePhp], ['Total contributed', p.contributedPhp], ['Unrealized gain/loss', p.unrealizedPhp], ['Realized gain/loss', p.realizedPhp], ['Dividends', p.dividendsPhp]].map(([l, v], i) => (
          <Card key={l as string} as="div" className="!p-4"><div className="text-[12.5px] text-muted">{l}</div>
            <Money value={v as number} sign={i === 2 || i === 3} serif className={`mt-1 block text-[20px] ${i >= 2 && (v as number) < 0 ? 'text-danger' : i >= 2 && (v as number) > 0 ? 'text-good' : ''}`} /></Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Holdings">
          {state.holdings.length === 0 ? <Empty icon="LineChart" title="No holdings yet" body="Add a US stock, ETF or Philippine REIT, then record your first buy." action={<Button onClick={() => setHEdit('new')}>Add holding</Button>} /> : (
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13.5px]">
                <thead><tr className="text-left text-[12px] text-muted"><th className="px-2 py-2 font-medium">Holding</th><th className="px-2 font-medium text-right">Shares</th><th className="px-2 font-medium text-right">Avg cost</th><th className="px-2 font-medium text-right">Last price</th><th className="px-2 font-medium text-right">Value (PHP)</th><th className="px-2 font-medium text-right">Gain/loss</th><th /></tr></thead>
                <tbody className="divide-y divide-line/60">
                  {p.stats.map((s) => (
                    <tr key={s.holding.id}>
                      <td className="px-2 py-3"><div className="font-semibold">{s.holding.symbol}</div><div className="text-[12px] text-muted">{ASSET_LABEL[s.holding.assetType]} · {s.holding.currency}</div></td>
                      <td className="num px-2 text-right">{s.shares}</td>
                      <td className="num px-2 text-right">{s.shares > 0 ? fmtLocal(Math.round(s.cost / s.shares), s.holding.currency) : '—'}</td>
                      <td className="num px-2 text-right">{s.hasPrice ? <>{fmtLocal(s.holding.lastPrice!, s.holding.currency)}<div className="text-[11px] text-muted">{s.holding.lastPriceDate ? dateLabel(s.holding.lastPriceDate) : ''}</div></> : <span className="text-muted">Not set</span>}</td>
                      <td className="num px-2 text-right">{peso(s.valuePhp)}{!s.hasPrice && <div className="text-[11px] text-muted">at cost</div>}</td>
                      <td className={`num px-2 text-right ${s.unrealizedPhp < 0 ? 'text-danger' : s.unrealizedPhp > 0 ? 'text-good' : ''}`}>{s.hasPrice ? peso(s.unrealizedPhp, { sign: true }) : '—'}</td>
                      <td className="px-2 text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => setTrade(s.holding.id)}>Record</Button>
                        <button aria-label={`Edit ${s.holding.symbol}`} className="p-1.5 text-muted hover:text-ink" onClick={() => setHEdit(s.holding)}><Icon name="Pencil" size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <div className="space-y-4">
          <Card title="Asset allocation">
            {p.valuePhp === 0 ? <p className="text-[13.5px] text-muted">Allocation appears after your first buy.</p> : (
              <ul className="space-y-3">
                {byType.map(([k, v]) => (
                  <li key={k}><div className="flex justify-between text-[13.5px]"><span>{ASSET_LABEL[k]}</span><span className="num text-muted">{Math.round((v / p.valuePhp) * 100)}% · {peso(v, { compact: true })}</span></div>
                    <Progress value={(v / p.valuePhp) * 100} thin className="mt-1" label={`${ASSET_LABEL[k]} share`} /></li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Investment cash" subtitle="Kept separate from emergency funds and protected savings.">
            <ul className="space-y-2 text-[13.5px]">
              {cashAccs.map((a) => <li key={a!.id} className="flex justify-between"><span>{a!.name} {a!.status === 'planned' && <Badge>Planned</Badge>}</span><Money value={a!.status === 'active' ? accountBalance(state, a!.id) : 0} /></li>)}
            </ul>
          </Card>
        </div>
      </div>

      <Card title="Investment history">
        {trades.length === 0 ? <p className="text-[13.5px] text-muted">Buys, sells and dividends you record appear here.</p> : (
          <ul className="divide-y divide-line/60">
            {trades.map((t) => { const h = state.holdings.find((x) => x.id === t.holdingId); return (
              <li key={t.id} className="flex items-center gap-3 py-2.5 text-[13.5px]">
                <Badge tone={t.kind === 'buy' ? 'accent' : t.kind === 'sell' ? 'gold' : 'good'}>{t.kind}</Badge>
                <span className="flex-1"><b>{h?.symbol}</b> {t.kind !== 'dividend' && <>· {t.shares} @ {fmtLocal(t.price, h?.currency ?? 'PHP')}</>} <span className="text-muted">· {dateLabel(t.date, { year: true })}</span></span>
                <span className="num">{fmtLocal(t.kind === 'dividend' ? t.price : Math.round(t.shares * t.price), h?.currency ?? 'PHP')}</span>
                <button aria-label="Delete trade" className="p-1 text-muted hover:text-danger" onClick={async () => { if (await ask('Delete this record?', { body: 'Its linked cash entry is removed too.', confirm: 'Delete' })) commit('Trade deleted', (d) => deleteTrade(d, t.id)); }}><Icon name="Trash2" size={14} /></button>
              </li>
            ); })}
          </ul>
        )}
      </Card>
      <Notice>Penny does not provide investment advice, live prices, automated trading or leveraged products. Values update only when you enter a new price or FX rate.</Notice>

      {hEdit && <HoldingEditor h={hEdit} onClose={() => setHEdit(null)} />}
      {trade && <TradeModal holdingId={trade} onClose={() => setTrade(null)} />}
      {fxOpen && <FxModal onClose={() => setFxOpen(false)} />}
      {confirmDialog}
    </div>
  );
}

function FxModal({ onClose }: { onClose: () => void }) {
  const { state, commit } = useStore();
  const [v, setV] = useState(String(state.settings.usdPhp));
  const n = Number(v);
  return (
    <Modal open onClose={onClose} title="USD → PHP rate"
      footer={<><Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button><Button className="flex-1" disabled={!(n > 0)} onClick={() => { if (commit('Exchange rate updated', (d) => { d.settings.usdPhp = n; d.settings.usdPhpUpdated = today(); })) onClose(); }}>Save</Button></>}>
      <Field label="₱ per US$1" hint={`Last updated ${dateLabel(state.settings.usdPhpUpdated, { year: true })}. Check your broker or bank for the current rate.`}>{(id) => <input id={id} className="input num" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} />}</Field>
    </Modal>
  );
}

function HoldingEditor({ h, onClose }: { h: Holding | 'new'; onClose: () => void }) {
  const { state, commit } = useStore();
  const isNew = h === 'new';
  const [x, setX] = useState<Holding>(() => isNew ? { id: uid('h_'), symbol: '', name: '', assetType: 'etf', currency: 'USD' } : { ...h });
  const [price, setPrice] = useState<Cents | null>(isNew ? null : h.lastPrice ?? null);
  const hasTrades = !isNew && state.trades.some((t) => t.holdingId === x.id);
  return (
    <Modal open onClose={onClose} title={isNew ? 'Add holding' : `Edit ${x.symbol}`}
      footer={<>{!isNew && !hasTrades && <Button variant="ghost" icon="Trash2" onClick={() => { if (commit('Holding removed', (d) => { d.holdings = d.holdings.filter((y) => y.id !== x.id); })) onClose(); }}>Remove</Button>}
        <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" onClick={() => { if (!x.symbol.trim()) return; const next = { ...x, symbol: x.symbol.trim().toUpperCase(), lastPrice: price ?? undefined, lastPriceDate: price !== (isNew ? null : h.lastPrice ?? null) ? today() : x.lastPriceDate }; if (commit('Holding saved', (d) => { const i = d.holdings.findIndex((y) => y.id === x.id); if (i >= 0) d.holdings[i] = next; else d.holdings.push(next); })) onClose(); }}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ticker">{(id) => <input id={id} className="input uppercase" value={x.symbol} onChange={(e) => setX({ ...x, symbol: e.target.value })} placeholder="VOO, AREIT" />}</Field>
        <Field label="Name">{(id) => <input id={id} className="input" value={x.name} onChange={(e) => setX({ ...x, name: e.target.value })} />}</Field>
        <Field label="Type">{(id) => <select id={id} className="input" value={x.assetType} onChange={(e) => { const t = e.target.value as AssetType; setX({ ...x, assetType: t, currency: t === 'ph_reit' || t === 'ph_stock' ? 'PHP' : x.currency }); }}>{Object.entries(ASSET_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}</Field>
        <Field label="Currency">{(id) => <select id={id} className="input" disabled={hasTrades} value={x.currency} onChange={(e) => setX({ ...x, currency: e.target.value as 'PHP' | 'USD' })}><option value="USD">USD</option><option value="PHP">PHP</option></select>}</Field>
        <Field label={`Latest price per share (${x.currency})`} className="sm:col-span-2" hint="Enter from your broker. Leave empty to value at cost.">{(id) => <MoneyInput id={id} value={price} onChange={setPrice} />}</Field>
      </div>
    </Modal>
  );
}

function TradeModal({ holdingId, onClose }: { holdingId: string; onClose: () => void }) {
  const { state, commit } = useStore();
  const h = state.holdings.find((x) => x.id === holdingId)!;
  const [kind, setKind] = useState<Trade['kind']>('buy');
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState<Cents | null>(h.lastPrice ?? null);
  const [fees, setFees] = useState<Cents | null>(0);
  const [fx, setFx] = useState(String(state.settings.usdPhp));
  const [date, setDate] = useState(today());
  const [cashAcc, setCashAcc] = useState(accountByRole(state, 'brokerage')?.status === 'active' ? accountByRole(state, 'brokerage')!.id : '');
  const sh = Number(shares);
  const gross = kind === 'dividend' ? price ?? 0 : Math.round(sh * (price ?? 0)) + (kind === 'buy' ? fees ?? 0 : -(fees ?? 0));
  const php = Math.round(gross * (h.currency === 'USD' ? Number(fx) || 0 : 1));
  const save = () => {
    if (commit(`${kind === 'dividend' ? 'Dividend' : kind === 'buy' ? 'Buy' : 'Sell'} recorded`, (d) => recordTrade(d, { holdingId, kind, date, shares: kind === 'dividend' ? 0 : sh, price: price ?? 0, fees: fees ?? 0, fxRate: h.currency === 'USD' ? Number(fx) : 1, cashAccountId: cashAcc || undefined }))) onClose();
  };
  return (
    <Modal open onClose={onClose} title={`Record · ${h.symbol}`}
      footer={<><Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button><Button className="flex-1" disabled={!price || (kind !== 'dividend' && !(sh > 0)) || parseMoney(fx) === null} onClick={save}>Save</Button></>}>
      <div className="space-y-4">
        <Segmented label="Type" value={kind} onChange={setKind} options={[{ value: 'buy', label: 'Buy' }, { value: 'sell', label: 'Sell' }, { value: 'dividend', label: 'Dividend' }]} />
        <div className="grid gap-3 sm:grid-cols-2">
          {kind !== 'dividend' && <Field label="Shares">{(id) => <input id={id} className="input num" inputMode="decimal" value={shares} onChange={(e) => setShares(e.target.value.replace(/[^\d.]/g, ''))} />}</Field>}
          <Field label={kind === 'dividend' ? `Amount received (${h.currency})` : `Price per share (${h.currency})`}>{(id) => <MoneyInput id={id} value={price} onChange={setPrice} />}</Field>
          {kind !== 'dividend' && <Field label={`Fees (${h.currency})`}>{(id) => <MoneyInput id={id} value={fees} onChange={setFees} />}</Field>}
          {h.currency === 'USD' && <Field label="FX rate (₱ per $1)">{(id) => <input id={id} className="input num" inputMode="decimal" value={fx} onChange={(e) => setFx(e.target.value)} />}</Field>}
          <Field label="Date">{(id) => <input id={id} type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
          <Field label="Cash account" hint="Optional — records the PHP cash moving in or out.">{(id) => (
            <select id={id} className="input" value={cashAcc} onChange={(e) => setCashAcc(e.target.value)}>
              <option value="">Don't record cash movement</option>
              {state.accounts.filter((a) => a.status === 'active' && a.type !== 'credit').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}</Field>
        </div>
        {gross > 0 && <p className="text-[13px] text-muted">Total: <b className="num text-ink">{fmtLocal(gross, h.currency)}</b>{h.currency === 'USD' && <> ≈ <b className="num text-ink">{peso(php)}</b></>}{cashAcc && (kind === 'buy' ? ' leaves' : ' goes into')} {cashAcc && state.accounts.find((a) => a.id === cashAcc)?.name}</p>}
        <p className="text-[12.5px] text-muted">Buying converts cash into holdings — it isn't counted as spending, and your net worth doesn't drop.</p>
      </div>
    </Modal>
  );
}
