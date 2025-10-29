import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';

export const DashboardLayout = () => {
  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-y-auto px-10 py-8">
        <Outlet />
      </main>
    </div>
  );
};
