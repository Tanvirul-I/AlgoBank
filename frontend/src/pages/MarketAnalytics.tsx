import { useEffect, useMemo, useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { ChartCard } from '@/components/ChartCard';
import { MetricCard } from '@/components/MetricCard';
import { request } from '@/services/apiClient';
import { formatPercent } from '@/utils/formatters';
import { useRealtime } from '@/hooks/useRealtime';

interface StrategyMetric {
  sharpe: number;
  winRate: number;
  drawdown: number;
  turnover: number;
}

interface StrategyPerformancePoint {
  timestamp: string;
  alpha: number;
  beta: number;
}

interface MarketBreadthPoint {
  sector: string;
  positive: number;
  negative: number;
}

export const MarketAnalytics = () => {
  const [metrics, setMetrics] = useState<StrategyMetric | null>(null);
  const [performanceSeries, setPerformanceSeries] = useState<StrategyPerformancePoint[]>([]);
  const [breadth, setBreadth] = useState<MarketBreadthPoint[]>([]);
  const { client } = useRealtime();

  useEffect(() => {
    request<StrategyMetric>({ url: '/analytics/strategy-metrics' })
      .then(setMetrics)
      .catch(() => {
        setMetrics({ sharpe: 2.1, winRate: 0.62, drawdown: -0.08, turnover: 0.35 });
      });

    request<StrategyPerformancePoint[]>({ url: '/analytics/performance' })
      .then(setPerformanceSeries)
      .catch(() => {
        const now = new Date();
        setPerformanceSeries(
          Array.from({ length: 20 }).map((_, index) => ({
            timestamp: new Date(now.getTime() - (19 - index) * 60 * 60 * 1000).toISOString(),
            alpha: 1.2 + Math.sin(index / 2) * 0.2,
            beta: 0.8 + Math.cos(index / 3) * 0.15
          }))
        );
      });

    request<MarketBreadthPoint[]>({ url: '/analytics/market-breadth' })
      .then(setBreadth)
      .catch(() => {
        setBreadth([
          { sector: 'Technology', positive: 65, negative: 35 },
          { sector: 'Financials', positive: 58, negative: 42 },
          { sector: 'Energy', positive: 45, negative: 55 },
          { sector: 'Healthcare', positive: 52, negative: 48 }
        ]);
      });
  }, []);

  useEffect(() => {
    const handler = (payload: StrategyPerformancePoint) => {
      setPerformanceSeries((prev) => [...prev.slice(-99), payload]);
    };

    client.subscribe('analytics.performance', handler);

    return () => {
      client.unsubscribe('analytics.performance', handler);
    };
  }, [client]);

  const lineChartData = useMemo(
    () => ({
      labels: performanceSeries.map((point) => point.timestamp),
      datasets: [
        {
          label: 'Alpha',
          data: performanceSeries.map((point) => point.alpha),
          borderColor: '#5B8DEF',
          backgroundColor: 'rgba(91, 141, 239, 0.15)',
          fill: true,
          tension: 0.35
        },
        {
          label: 'Beta',
          data: performanceSeries.map((point) => point.beta),
          borderColor: '#7C3AED',
          backgroundColor: 'rgba(124, 58, 237, 0.1)',
          fill: true,
          tension: 0.35
        }
      ]
    }),
    [performanceSeries]
  );

  const lineChartOptions = useMemo(
    () => ({
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'hour' },
          grid: { display: false }
        },
        y: {
          ticks: {
            callback: (value: number) => `${value.toFixed(2)}%`
          }
        }
      },
      plugins: {
        legend: { position: 'bottom' }
      }
    }),
    []
  );

  const breadthChartData = useMemo(
    () => ({
      labels: breadth.map((item) => item.sector),
      datasets: [
        {
          label: 'Advancing',
          data: breadth.map((item) => item.positive),
          backgroundColor: '#22D3EE'
        },
        {
          label: 'Declining',
          data: breadth.map((item) => item.negative),
          backgroundColor: '#FB7185'
        }
      ]
    }),
    [breadth]
  );

  const breadthOptions = useMemo(
    () => ({
      responsive: true,
      indexAxis: 'y' as const,
      scales: {
        x: {
          beginAtZero: true,
          stacked: true
        },
        y: {
          stacked: true
        }
      },
      plugins: {
        legend: { position: 'bottom' }
      }
    }),
    []
  );

  return (
    <section className="space-y-8">
      <TopBar title="Market Analytics" subtitle="Live insight into strategy KPIs and market breadth." />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Strategy Sharpe"
          value={metrics ? metrics.sharpe.toFixed(2) : '--'}
          trend="up"
          tooltip="Risk-adjusted return of the strategy; higher values indicate better efficiency."
        />
        <MetricCard
          label="Win Rate"
          value={metrics ? formatPercent(metrics.winRate * 100, 1) : '--'}
          trend="up"
          tooltip="Percentage of trades closing positive over the measurement window."
        />
        <MetricCard
          label="Max Drawdown"
          value={metrics ? formatPercent(metrics.drawdown * 100, 1) : '--'}
          trend="down"
          tooltip="Largest peak-to-trough equity decline observed during the sample."
        />
        <MetricCard
          label="Turnover"
          value={metrics ? formatPercent(metrics.turnover * 100, 1) : '--'}
          trend="neutral"
          tooltip="Portion of the portfolio traded within the period, reflecting activity."
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChartCard
            title="Alpha / Beta"
            description="Real-time factor performance compared with targets."
            chartType="line"
            data={lineChartData}
            options={lineChartOptions}
            tooltip="Tracks intraday alpha and beta contribution versus objectives."
          />
        </div>
        <ChartCard
          title="Market Breadth"
          description="Advancing vs. declining securities by sector."
          chartType="bar"
          data={breadthChartData}
          options={breadthOptions}
          tooltip="Stacked bars show advancing versus declining securities for each sector."
        />
      </div>
    </section>
  );
};
