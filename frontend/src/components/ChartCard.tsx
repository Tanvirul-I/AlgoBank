import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend, TimeScale, BarElement } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { Line, Pie, Bar } from 'react-chartjs-2';
import { ReactNode, useMemo } from 'react';
import { InfoTooltip } from './InfoTooltip';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend, TimeScale, BarElement);

type ChartType = 'line' | 'pie' | 'bar';

interface ChartCardProps {
  title: string;
  description?: string;
  chartType: ChartType;
  data: any;
  options?: any;
  actionSlot?: ReactNode;
  tooltip?: string;
}

const ChartComponentMap: Record<ChartType, typeof Line | typeof Pie | typeof Bar> = {
  line: Line,
  pie: Pie,
  bar: Bar
};

export const ChartCard = ({ title, description, chartType, data, options, actionSlot, tooltip }: ChartCardProps) => {
  const ChartComponent = ChartComponentMap[chartType];
  const mergedOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      ...options
    }),
    [options]
  );

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            <InfoTooltip content={tooltip} />
          </div>
          {description ? (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
          ) : null}
        </div>
        {actionSlot}
      </div>
      <div className="mt-4 flex-1 min-h-[18rem]">
        <ChartComponent className="h-full" data={data} options={mergedOptions} />
      </div>
    </div>
  );
};
