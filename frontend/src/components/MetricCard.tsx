import { InfoTooltip } from './InfoTooltip';

interface MetricCardProps {
  label: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  tooltip?: string;
}

const trendColors: Record<NonNullable<MetricCardProps['trend']>, string> = {
  up: 'text-emerald-500',
  down: 'text-rose-500',
  neutral: 'text-slate-500'
};

export const MetricCard = ({ label, value, change, trend = 'neutral', tooltip }: MetricCardProps) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
      <span>{label}</span>
      <InfoTooltip content={tooltip} />
    </div>
    <div className="mt-2 flex items-baseline justify-between">
      <p className="text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
      {change ? <span className={`text-xs font-semibold ${trendColors[trend]}`}>{change}</span> : null}
    </div>
  </div>
);
