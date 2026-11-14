import { useStore } from './lib/store';
import { Layout } from './components/Layout';
import { AddTransaction } from './components/AddTransaction';
import { CheckInManager, Celebration, Toasts } from './components/Overlays';
import Dashboard from './pages/Dashboard';
import PaydayPage from './pages/Payday';
import Transactions from './pages/Transactions';
import Accounts from './pages/Accounts';
import Budgets from './pages/Budgets';
import Savings from './pages/Savings';
import Wishlist from './pages/Wishlist';
import Rewards from './pages/Rewards';
import Travel from './pages/Travel';
import Investments from './pages/Investments';
import Cards from './pages/Cards';
import Subscriptions from './pages/Subscriptions';
import Review from './pages/Review';
import SettingsPage from './pages/Settings';
import More from './pages/More';

const PAGES = {
  dashboard: Dashboard, payday: PaydayPage, transactions: Transactions, accounts: Accounts, budgets: Budgets, savings: Savings,
  wishlist: Wishlist, rewards: Rewards, travel: Travel, investments: Investments, cards: Cards, subscriptions: Subscriptions,
  review: Review, settings: SettingsPage, more: More,
};

export default function App() {
  const { ready, route } = useStore();
  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="flex flex-col items-center gap-3 animate-shimmer">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-forest text-[#F8F7F3]"><span className="serif text-2xl">P</span></div>
          <span className="text-[13px] text-muted">Opening Penny…</span>
        </div>
      </div>
    );
  }
  const Page = PAGES[route] ?? Dashboard;
  return (
    <Layout>
      <div key={route} className="animate-rise"><Page /></div>
      <AddTransaction />
      <CheckInManager />
      <Toasts />
      <Celebration />
    </Layout>
  );
}
