import { NavLink } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ThemeToggle } from '@/components/ThemeToggle';
import { clsx } from 'clsx';

const navItems = [
  { to: '/portfolio', label: 'Portfolio Overview' },
  { to: '/compliance', label: 'Compliance Console' },
  { to: '/analytics', label: 'Market Analytics' }
];

export const Sidebar = () => {
  const { user, logout } = useAuth();

  return (
    <aside className="flex h-full w-72 flex-col border-r border-slate-200 bg-white px-6 py-8 dark:border-slate-800 dark:bg-slate-950">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-500">AlgoBank</p>
        <h1 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">Risk & Trading</h1>
      </div>
      <nav className="mt-10 flex-1 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                'flex items-center rounded-xl px-4 py-3 text-sm font-medium transition-all',
                isActive
                  ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-200'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900/60 dark:hover:text-slate-200'
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Signed in</p>
          <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">{user?.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
        </div>
        <div className="flex items-center justify-between">
          <ThemeToggle />
          <button
            onClick={logout}
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            Log out
          </button>
        </div>
      </div>
    </aside>
  );
};
