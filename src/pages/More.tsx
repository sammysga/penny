import { useStore } from '../lib/store';
import { NAV } from '../components/Layout';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/ui';

export default function More() {
  const { go } = useStore();
  return (
    <div>
      <PageHeader title="Everything" subtitle="All of Penny in one place." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {NAV.filter((n) => !['dashboard', 'transactions', 'payday', 'savings'].includes(n.route)).map((n) => (
          <button key={n.route} onClick={() => go(n.route)} className="card flex flex-col items-start gap-3 p-4 text-left transition hover:-translate-y-0.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-sunken text-forest"><Icon name={n.icon} size={19} /></div>
            <span className="text-[14px] font-semibold">{n.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
