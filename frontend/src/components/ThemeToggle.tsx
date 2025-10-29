import { Switch } from '@headlessui/react';
import { useThemeMode } from '@/hooks/useThemeMode';
import { clsx } from 'clsx';

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useThemeMode();
  const enabled = theme === 'dark';

  return (
    <Switch
      checked={enabled}
      onChange={toggleTheme}
      className={clsx(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
        enabled ? 'bg-slate-700' : 'bg-slate-300'
      )}
    >
      <span className="sr-only">Toggle theme</span>
      <span
        aria-hidden="true"
        className={clsx(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          enabled ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </Switch>
  );
};
