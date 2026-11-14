import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './Icon';
import { parseMoney, peso, toDecimalString, type Cents } from '../lib/money';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ───────── Layout primitives ───────── */

export function Card({ title, subtitle, action, children, className, pad = true, as: Tag = 'section' }: {
  title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children?: ReactNode; className?: string; pad?: boolean; as?: 'section' | 'div';
}) {
  return (
    <Tag className={cx('card animate-rise', pad && 'p-5 sm:p-6', className)}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </Tag>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="serif text-[28px] sm:text-[32px] font-medium leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/* ───────── Buttons ───────── */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet'; size?: 'sm' | 'md' | 'lg'; icon?: string };
export function Button({ variant = 'primary', size = 'md', icon, className, children, ...p }: BtnProps) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none',
        size === 'sm' && 'h-8 px-3 text-[13px]', size === 'md' && 'h-10 px-4 text-[14px]', size === 'lg' && 'h-12 px-5 text-[15px]',
        variant === 'primary' && 'bg-accent text-accent-ink hover:opacity-90',
        variant === 'secondary' && 'border border-line bg-surface text-ink hover:border-accent/40 hover:bg-sunken',
        variant === 'ghost' && 'text-muted hover:text-ink hover:bg-sunken',
        variant === 'quiet' && 'bg-sunken text-ink hover:bg-beige',
        variant === 'danger' && 'bg-danger text-white hover:opacity-90',
        className,
      )}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} />}
      {children}
    </button>
  );
}

export function IconButton({ icon, label, className, size = 18, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string; size?: number }) {
  return (
    <button {...p} aria-label={label} title={label}
      className={cx('inline-grid h-9 w-9 place-items-center rounded-xl text-muted transition hover:bg-sunken hover:text-ink active:scale-95 disabled:opacity-40', className)}>
      <Icon name={icon} size={size} />
    </button>
  );
}

/* ───────── Data display ───────── */

export function Money({ value, className, serif, sign, compact }: { value: Cents; className?: string; serif?: boolean; sign?: boolean; compact?: boolean }) {
  return <span className={cx('num whitespace-nowrap', serif && 'serif', className)}>{peso(value, { sign, compact })}</span>;
}

export function Progress({ value, tone = 'accent', className, label, thin }: { value: number; tone?: 'accent' | 'gold' | 'warn' | 'danger' | 'sage'; className?: string; label?: string; thin?: boolean }) {
  const v = Math.max(0, Math.min(100, value));
  const bar = { accent: 'bg-forest', gold: 'bg-gold', warn: 'bg-warn', danger: 'bg-danger', sage: 'bg-sage' }[tone];
  return (
    <div className={cx('w-full overflow-hidden rounded-full bg-sunken', thin ? 'h-1.5' : 'h-2', className)}
      role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cx('h-full rounded-full transition-[width] duration-700 ease-out', bar)} style={{ width: `${v}%` }} />
    </div>
  );
}

export function budgetTone(pct: number): 'accent' | 'warn' | 'danger' {
  return pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : 'accent';
}

export function Ring({ value, size = 120, stroke = 9, children, tone = 'forest', label }: { value: number; size?: number; stroke?: number; children?: ReactNode; tone?: 'forest' | 'gold'; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(v)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--sunken))" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`rgb(var(--${tone}))`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: 'stroke-dashoffset 900ms ease-out' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'danger' | 'gold' | 'accent'; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap',
      tone === 'neutral' && 'bg-sunken text-muted', tone === 'good' && 'bg-good/10 text-good', tone === 'warn' && 'bg-warn/10 text-warn',
      tone === 'danger' && 'bg-danger/10 text-danger', tone === 'gold' && 'bg-gold/20 text-ink', tone === 'accent' && 'bg-accent/10 text-forest', className)}>
      {children}
    </span>
  );
}

export function Stat({ label, value, hint, className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[12.5px] font-medium text-muted">{label}</div>
      <div className="mt-1 text-[20px] font-semibold tracking-tight num">{value}</div>
      {hint && <div className="mt-0.5 text-[12.5px] text-muted">{hint}</div>}
    </div>
  );
}

export function Empty({ icon = 'Sparkles', title, body, action }: { icon?: string; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-sunken text-forest"><Icon name={icon} size={22} /></div>
      <div className="font-semibold">{title}</div>
      {body && <p className="mt-1 max-w-sm text-[14px] text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({ tone = 'info', children, icon }: { tone?: 'info' | 'warn' | 'good' | 'danger'; children: ReactNode; icon?: string }) {
  const ic = icon ?? (tone === 'good' ? 'CheckCircle2' : tone === 'info' ? 'Info' : 'AlertCircle');
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cx('flex gap-2.5 rounded-xl px-3.5 py-3 text-[13.5px] leading-snug',
      tone === 'info' && 'bg-sunken text-ink', tone === 'warn' && 'bg-warn/10 text-ink', tone === 'good' && 'bg-good/10 text-ink', tone === 'danger' && 'bg-danger/10 text-ink')}>
      <Icon name={ic} size={17} className={cx('mt-px shrink-0', tone === 'warn' && 'text-warn', tone === 'good' && 'text-good', tone === 'danger' && 'text-danger', tone === 'info' && 'text-muted')} />
      <div>{children}</div>
    </div>
  );
}

/* ───────── Forms ───────── */

export function Field({ label, children, hint, error, className }: { label: string; children: (id: string) => ReactNode; hint?: ReactNode; error?: string; className?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}</label>
      {children(id)}
      {hint && !error && <p className="mt-1 text-[12.5px] text-muted">{hint}</p>}
      {error && <p className="mt-1 text-[12.5px] text-danger" role="alert">{error}</p>}
    </div>
  );
}

/** Money input that edits a decimal string and reports centavos (null while invalid/empty). */
export function MoneyInput({ value, onChange, id, autoFocus, placeholder = '0.00', large, allowNegative, className }: {
  value: Cents | null; onChange: (c: Cents | null) => void; id?: string; autoFocus?: boolean; placeholder?: string; large?: boolean; allowNegative?: boolean; className?: string;
}) {
  const [text, setText] = useState(value === null ? '' : toDecimalString(value).replace(/\.00$/, ''));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) { setText(value === null ? '' : toDecimalString(value).replace(/\.00$/, '')); last.current = value; }
  }, [value]);
  return (
    <div className={cx('relative', className)}>
      <span className={cx('pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted', large && 'text-[22px] left-4')}>₱</span>
      <input id={id} inputMode="decimal" autoComplete="off" autoFocus={autoFocus} placeholder={placeholder}
        className={cx('input num', large ? 'pl-10 py-3.5 text-[26px] font-semibold serif' : 'pl-8')}
        value={text}
        onChange={(e) => {
          const raw = e.target.value.replace(allowNegative ? /[^\d.,-]/g : /[^\d.,]/g, '');
          setText(raw);
          const c = parseMoney(raw);
          last.current = c;
          onChange(c);
        }}
      />
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-1">
      <span>
        <span className="block text-[14.5px] font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-muted">{description}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-accent' : 'bg-line')}>
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-sunken p-1">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cx('rounded-lg font-semibold transition', size === 'sm' ? 'px-2.5 py-1 text-[12.5px]' : 'px-3.5 py-1.5 text-[13.5px]',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ───────── Overlays ───────── */

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      const el = ref.current?.querySelector<HTMLElement>('[autofocus], input, select, textarea, button:not([data-close])');
      el?.focus();
    }, 30);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
      <div className="absolute inset-0 bg-[#141614]/40 backdrop-blur-[2px] animate-[rise_.2s_ease-out]" onClick={onClose} />
      <div ref={ref} className={cx('relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-surface shadow-2xl sm:rounded-3xl animate-rise', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line sm:hidden" />
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4 sm:px-6 sm:pt-5">
          <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
          <IconButton icon="X" label="Close" onClick={onClose} data-close />
        </div>
        <div className="overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>
        {footer && <div className="flex gap-2 border-t border-line/70 px-5 py-4 pb-safe sm:px-6">{footer}</div>}
      </div>
    </div>
  );
}

/** Promise-based confirmation for destructive actions. */
export function useConfirm() {
  const [req, setReq] = useState<{ title: string; body?: ReactNode; confirm: string; danger?: boolean; resolve: (v: boolean) => void } | null>(null);
  const ask = (title: string, opts: { body?: ReactNode; confirm?: string; danger?: boolean } = {}) =>
    new Promise<boolean>((resolve) => setReq({ title, body: opts.body, confirm: opts.confirm ?? 'Confirm', danger: opts.danger ?? true, resolve }));
  const close = (v: boolean) => { req?.resolve(v); setReq(null); };
  const dialog = (
    <Modal open={!!req} onClose={() => close(false)} title={req?.title ?? ''}
      footer={<><Button variant="secondary" className="flex-1" onClick={() => close(false)}>Cancel</Button>
        <Button variant={req?.danger ? 'danger' : 'primary'} className="flex-1" onClick={() => close(true)}>{req?.confirm}</Button></>}>
      {req?.body && <div className="text-[14px] text-muted">{req.body}</div>}
    </Modal>
  );
  return [dialog, ask] as const;
}
