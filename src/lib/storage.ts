import type { AppState } from './types';
import { SCHEMA_VERSION, createInitialState } from './seed';

/**
 * Persistence is behind an adapter so Supabase can be added without touching UI code.
 *
 *   interface StorageAdapter { load(); save(state); }
 *
 * To add Supabase later: implement `SupabaseAdapter` (auth.getSession → upsert a
 * `penny_state` row keyed by user id, or normalise into tables named after the
 * AppState arrays: accounts, transactions, budget_plans, …), then compose it with
 * the local adapter so writes land locally first (offline-friendly) and sync after.
 */
export interface StorageAdapter {
  load(): Promise<AppState | null>;
  save(state: AppState): Promise<void>;
}

const KEY = 'penny:v1';

export class LocalStorageAdapter implements StorageAdapter {
  async load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? migrate(JSON.parse(raw)) : null;
    } catch { return null; }
  }
  async save(state: AppState) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.error('Penny: could not save', e); throw e; }
  }
}

/** Upgrade older saved data. Fills any missing top-level keys from a fresh state. */
export function migrate(data: unknown): AppState {
  if (!data || typeof data !== 'object') throw new Error('Not a Penny backup.');
  const d = data as Partial<AppState>;
  if (!Array.isArray(d.accounts) || !Array.isArray(d.transactions)) throw new Error('This file doesn\'t look like a Penny backup.');
  const base = createInitialState();
  const merged = { ...base, ...d, settings: { ...base.settings, ...d.settings, checkIns: { ...base.settings.checkIns, ...d.settings?.checkIns } } } as AppState;
  merged.schemaVersion = SCHEMA_VERSION;
  return merged;
}

export const storage: StorageAdapter = new LocalStorageAdapter();
