# Penny — Every peso has a purpose

A personal finance, savings & habit companion. React + TypeScript + Tailwind + Recharts + Lucide, stored locally, installable as a PWA.

**Live app:** https://sammysga.github.io/penny/. Every push to `main` runs the tests and redeploys (`.github/workflows/deploy.yml`).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # ledger & integrity tests (vitest)
npm run build && npm run preview   # production build (service worker / offline)
```

## Structure

```
src/lib/        pure logic — no React
  money.ts        integer-centavo parsing/formatting (no floats)
  date.ts         Asia/Manila wall-clock dates ("YYYY-MM-DDTHH:mm")
  types.ts        data model (maps 1:1 to future Supabase tables)
  seed.ts         your starting profile, accounts, January 2027 plan
  ledger.ts       balances, budgets, net worth, streaks
  actions.ts      every state mutation (validated, auditable)
  projections.ts  savings forecasts — confirmed balances only
  invest.ts       average-cost portfolio math
  achievements.ts derived achievements
  checkins.ts     spending check-in schedule
  storage.ts      StorageAdapter (localStorage now, Supabase later)
src/components/ UI kit, layout, quick-add sheet, charts, overlays
src/pages/      one file per section
public/sw.js    offline cache + notification actions + push-ready handler
```

## Financial integrity

All amounts are integer centavos. Rules are enforced in `ledger.ts`/`actions.ts` and covered by `ledger.test.ts`:

- Transfers between your accounts are never income or expense.
- Salary is recorded once per month (duplicates are rejected).
- Budget reservations never change bank balances; payday transfers do, only when ticked.
- Card purchases raise the card's liability and count as spending; card payments are transfers, so spending isn't counted twice.
- The ₱9,954.74 November 2026 Maya payment is shown in history but never posted to the ledger.
- Pending income and pending transactions don't affect balances.
- Investments are valued separately from cash. Prices are entered manually, never fetched.
- Net worth = assets − liabilities.
- Budget plans apply from a month forward; each payday keeps a snapshot of its plan, so later edits never rewrite past months.
- Edits are kept in each transaction's history. Deletes are soft and can be restored. Reconciliation posts an explicit adjustment.
- Rewards are paid from money set aside out of the wants budget. Achievements never create money.

## Notifications: what works

- **Works:** in-app check-ins while Penny is open, plus system notifications (with Log / Nothing spent / Later actions) when Penny is in a background tab and you've allowed them.
- **Doesn't work:** reminders while Penny is fully closed. Browsers don't run web-app timers once the app is closed. That needs a Web Push backend (VAPID keys plus a server that sends on a schedule). `sw.js` already handles `push` events, so a backend can be added without UI changes.

## Adding Supabase later

Implement `StorageAdapter` in `src/lib/storage.ts` with Supabase auth plus tables named after the `AppState` arrays. Keep local-first writes for offline logging, and sync after.
