import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppState, Transaction } from './types';
import { storage } from './storage';
import { createInitialState } from './seed';
import { newlyUnlocked, achievementById } from './achievements';
import { nowLocal } from './date';

export type Route =
  | 'dashboard' | 'payday' | 'transactions' | 'accounts' | 'budgets' | 'savings' | 'wishlist'
  | 'rewards' | 'travel' | 'investments' | 'cards' | 'subscriptions' | 'review' | 'settings' | 'more';

export interface Toast { id: number; message: string; kind: 'info' | 'success' | 'error' | 'achievement'; undo?: boolean }

export interface AddPrefill { kind?: Transaction['kind']; editId?: string; amount?: number; merchant?: string; categoryId?: string; accountId?: string; toAccountId?: string; tripId?: string; source?: Transaction['source'] }

interface Store {
  state: AppState;
  ready: boolean;
  route: Route;
  go: (r: Route) => void;
  /** Apply a mutation to a cloned draft. Returns false (and shows the reason) if it throws. */
  commit: (label: string | null, fn: (draft: AppState) => void, opts?: { undo?: boolean }) => boolean;
  undo: () => void;
  replaceState: (s: AppState) => void;
  toast: (message: string, kind?: Toast['kind']) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;
  addOpen: AddPrefill | null;
  openAdd: (p?: AddPrefill) => void;
  closeAdd: () => void;
  celebrate: number;
}

const Ctx = createContext<Store | null>(null);

const routeFromHash = (): Route => (window.location.hash.replace('#/', '') || 'dashboard') as Route;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => createInitialState());
  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [addOpen, setAddOpen] = useState<AddPrefill | null>(null);
  const [celebrate, setCelebrate] = useState(0);
  const undoStack = useRef<{ label: string; prev: AppState }[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;
  const toastId = useRef(0);

  useEffect(() => {
    storage.load().then((s) => { if (s) setState(s); setReady(true); });
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Persist (debounced) — local first, so logging works offline.
  useEffect(() => {
    if (!ready) return;
    const h = setTimeout(() => storage.save(state).catch(() => toast('Couldn\'t save — your browser storage may be full.', 'error')), 150);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, ready]);

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback((message: string, kind: Toast['kind'] = 'info', undo = false) => {
    const id = ++toastId.current;
    // Undo always reverts the most recent action, so only the newest toast may offer it.
    setToasts((t) => [...t.slice(-2).map((x) => (undo ? { ...x, undo: false } : x)), { id, message, kind, undo }]);
    setTimeout(() => dismissToast(id), kind === 'achievement' ? 7000 : undo ? 6000 : 3500);
  }, [dismissToast]);

  const commit = useCallback<Store['commit']>((label, fn, opts = {}) => {
    const prev = stateRef.current;
    const draft = structuredClone(prev);
    try { fn(draft); } catch (e) { toast((e as Error).message, 'error'); return false; }
    stateRef.current = draft;
    setState(draft);
    if (opts.undo !== false && label) {
      undoStack.current = [...undoStack.current.slice(-19), { label, prev }];
      toast(label, 'success', true);
    } else if (label) toast(label, 'success');
    return true;
  }, [toast]);

  const undo = useCallback(() => {
    const last = undoStack.current.pop();
    if (!last) return;
    stateRef.current = last.prev;
    setState(last.prev);
    setToasts([]);
    toast(`Undone: ${last.label}`);
  }, [toast]);

  // Achievements are derived from real data, then stamped once.
  useEffect(() => {
    if (!ready) return;
    const ids = newlyUnlocked(state);
    if (!ids.length) return;
    const draft = structuredClone(state);
    for (const id of ids) draft.achievements[id] = nowLocal();
    stateRef.current = draft;
    setState(draft);
    setCelebrate((c) => c + 1);
    for (const id of ids) toast(`Achievement unlocked · ${achievementById(id)?.title}`, 'achievement');
  }, [state, ready, toast]);

  // Theme
  useEffect(() => {
    const apply = () => {
      const t = state.settings.theme;
      const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#171917' : '#F8F7F3');
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [state.settings.theme]);

  const value = useMemo<Store>(() => ({
    state, ready, route,
    go: (r) => { window.location.hash = `#/${r}`; window.scrollTo({ top: 0 }); },
    commit, undo, toast: (m, k) => toast(m, k), toasts, dismissToast,
    replaceState: (s) => { undoStack.current = []; stateRef.current = s; setState(s); },
    addOpen, openAdd: (p = {}) => setAddOpen(p), closeAdd: () => setAddOpen(null),
    celebrate,
  }), [state, ready, route, commit, undo, toast, toasts, dismissToast, addOpen, celebrate]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStore outside provider');
  return c;
}
