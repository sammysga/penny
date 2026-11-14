import { useState, type ReactNode } from 'react';
import { useStore, type Route } from '../lib/store';
import { Icon } from './Icon';
import { cx, IconButton } from './ui';
import { monthLabel, thisMonth } from '../lib/date';
import { attention } from '../lib/alerts';

export const NAV: { route: Route; label: string; icon: string }[] = [
  { route: 'dashboard', label: 'Dashboard', icon: 'Home' },
  { route: 'payday', label: 'Payday', icon: 'CalendarCheck' },
  { route: 'transactions', label: 'Transactions', icon: 'Receipt' },
  { route: 'accounts', label: 'Accounts', icon: 'Wallet' },
  { route: 'budgets', label: 'Budgets', icon: 'LayoutGrid' },
  { route: 'savings', label: 'Savings Goals', icon: 'Target' },
  { route: 'wishlist', label: 'Wishlist', icon: 'Heart' },
  { route: 'rewards', label: 'Rewards', icon: 'Award' },
  { route: 'travel', label: 'Travel', icon: 'Plane' },
  { route: 'investments', label: 'Investments', icon: 'LineChart' },
  { route: 'cards', label: 'Credit Cards', icon: 'CreditCard' },
  { route: 'subscriptions', label: 'Subscriptions', icon: 'Repeat' },
  { route: 'review', label: 'Monthly Review', icon: 'BarChart3' },
  { route: 'settings', label: 'Settings', icon: 'Settings' },
];

const MOBILE: { route: Route; label: string; icon: string }[] = [
  { route: 'dashboard', label: 'Home', icon: 'Home' },
  { route: 'transactions', label: 'Activity', icon: 'Receipt' },
  { route: 'payday', label: 'Payday', icon: 'CalendarCheck' },
  { route: 'savings', label: 'Goals', icon: 'Target' },
  { route: 'more', label: 'More', icon: 'LayoutGrid' },
];

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-forest text-[#F8F7F3] ring-1 ring-gold/60 dark:bg-[#244B3C]">
        <span className="serif text-[18px] leading-none">P</span>
      </div>
      {!compact && <span className="serif text-[21px] font-medium tracking-tight">Penny</span>}
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { route, go, state, commit, openAdd } = useStore();
  const collapsed = state.settings.sidebarCollapsed;
  const [bellOpen, setBellOpen] = useState(false);
  const items = attention(state);
  const toggle = () => commit(null, (d) => { d.settings.sidebarCollapsed = !d.settings.sidebarCollapsed; }, { undo: false });

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">Skip to content</a>

      {/* Desktop sidebar */}
      <aside className={cx('fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line/70 bg-bg/80 backdrop-blur lg:flex transition-[width] duration-300', collapsed ? 'w-[76px]' : 'w-[244px]')}>
        <div className={cx('flex h-16 items-center', collapsed ? 'justify-center' : 'justify-between px-5')}>
          <button onClick={() => go('dashboard')} aria-label="Penny home"><Logo compact={collapsed} /></button>
          {!collapsed && <IconButton icon="PanelLeftClose" label="Collapse sidebar" onClick={toggle} />}
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-none">
          <ul className="space-y-0.5">
            {NAV.map((n) => (
              <li key={n.route}>
                <button onClick={() => go(n.route)} title={collapsed ? n.label : undefined} aria-current={route === n.route ? 'page' : undefined}
                  className={cx('group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition',
                    collapsed && 'justify-center px-0',
                    route === n.route ? 'bg-surface text-ink shadow-soft ring-1 ring-line/70' : 'text-muted hover:bg-sunken hover:text-ink')}>
                  <Icon name={n.icon} size={18} className={route === n.route ? 'text-forest' : ''} />
                  {!collapsed && n.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        {collapsed && <div className="flex justify-center pb-4"><IconButton icon="PanelLeftOpen" label="Expand sidebar" onClick={toggle} /></div>}
        {!collapsed && <p className="px-6 pb-5 text-[12px] text-faint">Every peso has a purpose.</p>}
      </aside>

      <div className={cx('transition-[padding] duration-300', collapsed ? 'lg:pl-[76px]' : 'lg:pl-[244px]')}>
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-line/50 bg-bg/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
            <div className="flex items-center gap-3">
              <button className="lg:hidden" onClick={() => go('dashboard')} aria-label="Penny home"><Logo /></button>
              <span className="hidden rounded-full bg-sunken px-3 py-1 text-[13px] font-medium text-muted sm:inline lg:inline">{monthLabel(thisMonth())}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => openAdd({ kind: 'expense' })}
                className="hidden h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-[13.5px] font-semibold text-accent-ink transition hover:opacity-90 sm:inline-flex">
                <Icon name="Plus" size={16} /> Add expense
              </button>
              <div className="relative">
                <IconButton icon="Bell" label={`Notifications${items.length ? ` (${items.length})` : ''}`} onClick={() => setBellOpen((v) => !v)} aria-expanded={bellOpen} />
                {items.length > 0 && <span className="pointer-events-none absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-gold ring-2 ring-bg" />}
                {bellOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setBellOpen(false)} />
                    <div className="absolute right-0 z-40 mt-2 w-[min(340px,calc(100vw-2rem))] card p-2 animate-rise" role="menu">
                      <div className="px-3 py-2 text-[13px] font-semibold">For your attention</div>
                      {items.length === 0 && <p className="px-3 pb-3 text-[13.5px] text-muted">All clear. Nothing needs you right now.</p>}
                      {items.map((a) => (
                        <button key={a.id} role="menuitem" onClick={() => { setBellOpen(false); go(a.route as Route); }}
                          className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13.5px] hover:bg-sunken">
                          <span className={cx('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', a.tone === 'warn' ? 'bg-warn' : 'bg-forest')} />
                          {a.message}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button onClick={() => go('settings')} aria-label="Profile & settings"
                className="grid h-9 w-9 place-items-center rounded-full bg-beige text-[13px] font-semibold text-ink ring-1 ring-line hover:ring-accent/40">
                {state.settings.name.slice(0, 1).toUpperCase() || 'P'}
              </button>
            </div>
          </div>
        </header>

        <main id="main" className="mx-auto max-w-6xl px-4 pb-32 pt-5 sm:px-6 sm:pt-8 lg:pb-16">{children}</main>
      </div>

      {/* Floating add button */}
      <button onClick={() => openAdd({ kind: 'expense' })} aria-label="Add expense"
        className="fixed bottom-[84px] right-4 z-30 grid h-14 w-14 place-items-center rounded-2xl bg-accent text-accent-ink shadow-lg shadow-forest/25 transition hover:scale-105 active:scale-95 sm:hidden">
        <Icon name="Plus" size={24} />
      </button>
      <button onClick={() => openAdd({ kind: 'expense' })}
        className="fixed bottom-6 right-6 z-30 hidden items-center gap-2 rounded-2xl bg-accent px-5 py-3.5 text-[14px] font-semibold text-accent-ink shadow-lg shadow-forest/25 transition hover:-translate-y-0.5 active:scale-95 sm:flex">
        <Icon name="Plus" size={18} /> Add Expense
      </button>

      {/* Mobile bottom nav */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-surface/90 backdrop-blur pb-safe lg:hidden">
        <ul className="mx-auto flex max-w-md justify-around">
          {MOBILE.map((n) => {
            const active = route === n.route || (n.route === 'more' && !MOBILE.some((m) => m.route === route));
            return (
              <li key={n.route} className="flex-1">
                <button onClick={() => go(n.route)} aria-current={active ? 'page' : undefined}
                  className={cx('flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition', active ? 'text-forest' : 'text-muted')}>
                  <Icon name={n.icon} size={21} strokeWidth={active ? 2.2 : 1.75} />
                  {n.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
