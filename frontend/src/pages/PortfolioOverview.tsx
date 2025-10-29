import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { TopBar } from "@/components/TopBar";
import { MetricCard } from "@/components/MetricCard";
import { ChartCard } from "@/components/ChartCard";
import { D3Card } from "@/components/D3Card";
import { RiskHeatmap, RiskHeatmapDatum } from "@/components/d3/RiskHeatmap";
import { DataTable } from "@/components/DataTable";
import { request } from "@/services/apiClient";
import { formatCurrency, formatPercent } from "@/utils/formatters";

interface PortfolioSummary {
	netAssetValue: number;
	dailyPnl: number;
	monthToDatePnl: number;
	valueAtRisk: number;
	exposure: number;
}

interface PositionRow {
	symbol: string;
	quantity: number;
	marketValue: number;
	pnl: number;
	risk: string;
}

interface PnlPoint {
	timestamp: string;
	value: number;
}

type PnlRange = "1W" | "1M" | "3M" | "1Y";

const pnlRangeSettings: Record<PnlRange, { days: number; timeUnit: "day" | "week" | "month" }> = {
	"1W": { days: 7, timeUnit: "day" },
	"1M": { days: 30, timeUnit: "day" },
	"3M": { days: 90, timeUnit: "week" },
	"1Y": { days: 252, timeUnit: "month" }
};

const generateFallbackSeries = (range: PnlRange): PnlPoint[] => {
	const { days } = pnlRangeSettings[range];
	const now = new Date();
	const amplitude = {
		"1W": 80_000,
		"1M": 150_000,
		"3M": 240_000,
		"1Y": 360_000
	}[range];

	return Array.from({ length: days }).map((_, index) => {
		const timestamp = new Date(now.getTime() - (days - 1 - index) * 24 * 60 * 60 * 1000);
		const trend =
			range === "1Y" ? index * 9_500 : range === "3M" ? index * 4_200 : index * 1_600;

		return {
			timestamp: timestamp.toISOString(),
			value: 3_000_000 + Math.sin(index / 4) * amplitude + trend
		};
	});
};

interface RiskMatrixCell extends RiskHeatmapDatum {}

export const PortfolioOverview = () => {
	const [summary, setSummary] = useState<PortfolioSummary | null>(null);
	const [positions, setPositions] = useState<PositionRow[]>([]);
	const [pnlSeries, setPnlSeries] = useState<PnlPoint[]>(() => generateFallbackSeries("1M"));
	const [pnlRange, setPnlRange] = useState<PnlRange>("1M");
	const [riskMatrix, setRiskMatrix] = useState<RiskMatrixCell[]>([]);

	useEffect(() => {
		request<PortfolioSummary>({ url: "/portfolio/summary" })
			.then(setSummary)
			.catch(() => {
				setSummary({
					netAssetValue: 125_000_000,
					dailyPnl: 1_250_000,
					monthToDatePnl: 6_800_000,
					valueAtRisk: 4_500_000,
					exposure: 0.58
				});
			});

		request<PositionRow[]>({ url: "/portfolio/positions" })
			.then(setPositions)
			.catch(() => {
				setPositions([
					{
						symbol: "AAPL",
						quantity: 24500,
						marketValue: 4_200_000,
						pnl: 145_000,
						risk: "Medium"
					},
					{
						symbol: "NVDA",
						quantity: 8500,
						marketValue: 3_750_000,
						pnl: 220_000,
						risk: "High"
					},
					{
						symbol: "TLT",
						quantity: 18000,
						marketValue: 1_950_000,
						pnl: -45_000,
						risk: "Low"
					},
					{
						symbol: "CL=F",
						quantity: 1200,
						marketValue: 960_000,
						pnl: 32_000,
						risk: "Medium"
					}
				]);
			});

		request<RiskMatrixCell[]>({ url: "/portfolio/risk-matrix" })
			.then(setRiskMatrix)
			.catch(() => {
				setRiskMatrix([
					{ factor: "Equity Delta", assetClass: "Equities", exposure: 4_200_000 },
					{ factor: "Equity Delta", assetClass: "Derivatives", exposure: 620_000 },
					{ factor: "Equity Gamma", assetClass: "Derivatives", exposure: 1_850_000 },
					{ factor: "Rates DV01", assetClass: "Rates", exposure: 3_150_000 },
					{ factor: "Rates DV01", assetClass: "Credit", exposure: 640_000 },
					{ factor: "Credit Spread", assetClass: "Credit", exposure: 2_450_000 },
					{ factor: "Commodity Beta", assetClass: "Commodities", exposure: 1_320_000 },
					{ factor: "FX Delta", assetClass: "FX", exposure: 980_000 },
					{ factor: "Volatility Vega", assetClass: "Derivatives", exposure: 1_120_000 },
					{ factor: "Inflation", assetClass: "Rates", exposure: 1_080_000 },
					{ factor: "Carry", assetClass: "FX", exposure: 730_000 },
					{ factor: "Basis", assetClass: "Commodities", exposure: 680_000 }
				]);
			});
	}, []);

	useEffect(() => {
		request<PnlPoint[]>({ url: "/portfolio/pnl-series", params: { range: pnlRange } })
			.then(setPnlSeries)
			.catch(() => {
				setPnlSeries(generateFallbackSeries(pnlRange));
			});
	}, [pnlRange]);

	useEffect(() => {
		request<PnlPoint[]>({ url: "/portfolio/pnl-series", params: { range: pnlRange } })
			.then(setPnlSeries)
			.catch(() => {
				setPnlSeries(generateFallbackSeries(pnlRange));
			});
	}, [pnlRange]);

	const pnlChartData = useMemo(
		() => ({
			labels: pnlSeries.map((point) => point.timestamp),
			datasets: [
				{
					label: "Daily P&L",
					data: pnlSeries.map((point) => point.value),
					borderColor: "#5B8DEF",
					backgroundColor: "rgba(91, 141, 239, 0.15)",
					fill: true,
					tension: 0.35
				}
			]
		}),
		[pnlSeries]
	);

	const pnlChartOptions = useMemo(
		() => ({
			responsive: true,
			interaction: { intersect: false, mode: "index" as const },
			maintainAspectRatio: false,
			scales: {
				x: {
					type: "time" as const,
					time: {
						unit: pnlRangeSettings[pnlRange].timeUnit
					},
					grid: {
						display: false
					},
					ticks: {
						maxTicksLimit: pnlRange === "1Y" ? 6 : pnlRange === "3M" ? 8 : 10
					}
				},
				y: {
					ticks: {
						callback: (value: number) => formatCurrency(value)
					},
					grid: {
						color: "rgba(148, 163, 184, 0.2)"
					}
				}
			},
			plugins: {
				legend: {
					display: false
				}
			}
		}),
		[pnlRange]
	);

	const riskAllocationData = useMemo(
		() => ({
			labels: ["Equities", "Fixed Income", "Commodities", "FX"],
			datasets: [
				{
					label: "Capital Allocation",
					data: [45, 25, 18, 12],
					backgroundColor: ["#5B8DEF", "#7C3AED", "#22D3EE", "#FB7185"],
					borderRadius: 12,
					barThickness: 24
				}
			]
		}),
		[]
	);

	const riskAllocationOptions = useMemo(
		() => ({
			indexAxis: "y" as const,
			maintainAspectRatio: false,
			scales: {
				x: {
					grid: { display: false },
					ticks: {
						callback: (value: number) => `${value}%`
					},
					suggestedMax: 60
				},
				y: {
					grid: { display: false }
				}
			},
			plugins: {
				legend: { display: false }
			}
		}),
		[]
	);

	const factorInsights = useMemo(
		() => [
			{
				factor: "Equity Delta",
				meaning: "Sensitivity to stock price movements.",
				example:
					"A 1% rise in the stock index increases portfolio value by about $42k when exposure is $4.2M per 100% move."
			},
			{
				factor: "Equity Gamma",
				meaning:
					"How delta itself changes as equity prices move — captures the curvature from options.",
				example:
					"Highlights non-linear exposure from options that amplifies gains or losses after large moves."
			},
			{
				factor: "Rates DV01",
				meaning: "Dollar value impact of a one basis-point move in interest rates.",
				example:
					"With $3.15M DV01, a 1 bp rise in rates would trim roughly $31.5k from the portfolio."
			},
			{
				factor: "Credit Spread",
				meaning: "Exposure to widening or tightening credit spreads.",
				example:
					"A 10 bp widening may reduce value by about $245k when spread exposure totals $2.45M."
			},
			{
				factor: "Commodity Beta",
				meaning: "Sensitivity to broad commodity price levels.",
				example:
					"Tracks how oil and metals swings move performance through a $1.32M equivalent exposure."
			},
			{
				factor: "FX Delta",
				meaning: "Impact from currency moves across the book.",
				example:
					"A 1% USD rally changes value proportionally to the $980k FX delta exposure."
			},
			{
				factor: "Volatility Vega",
				meaning: "Sensitivity to implied volatility changes, typically from options.",
				example:
					"Each 1% rise in volatility shifts portfolio value by roughly $11.2k on $1.12M vega."
			},
			{
				factor: "Inflation",
				meaning: "Exposure to inflation index changes and breakevens.",
				example:
					"Inflation-linked bonds add $1.08M of exposure to unexpected inflation jumps."
			},
			{
				factor: "Carry",
				meaning: "Income earned from holding a position, such as rate differentials.",
				example: "FX carry adds steady return potential tied to a $730k notional exposure."
			},
			{
				factor: "Basis",
				meaning: "Sensitivity to relative pricing between similar instruments.",
				example: "$680k basis exposure tracks divergences like futures versus spot moves."
			}
		],
		[]
	);

	return (
		<section className="space-y-8">
			<TopBar
				title="Portfolio Overview"
				subtitle="Positions, performance, and capital usage."
			/>
			<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
				<MetricCard
					label="Net Asset Value"
					value={formatCurrency(summary?.netAssetValue ?? 0)}
					tooltip="Total market value of the portfolio after liabilities."
					change={
						summary && summary.netAssetValue
							? formatPercent((summary.dailyPnl / summary.netAssetValue) * 100, 2)
							: undefined
					}
					trend={summary && summary.dailyPnl >= 0 ? "up" : "down"}
				/>
				<MetricCard
					label="Daily P&L"
					value={formatCurrency(summary?.dailyPnl ?? 0)}
					tooltip="Profit or loss realized since the previous trading day."
					trend={summary && summary.dailyPnl >= 0 ? "up" : "down"}
					change={
						summary && summary.netAssetValue
							? formatPercent((summary.dailyPnl / summary.netAssetValue) * 100)
							: undefined
					}
				/>
				<MetricCard
					label="MTD P&L"
					value={formatCurrency(summary?.monthToDatePnl ?? 0)}
					tooltip="Cumulative profit or loss generated since the start of the month."
					trend={summary && summary.monthToDatePnl >= 0 ? "up" : "down"}
				/>
				<MetricCard
					label="Value at Risk (95%)"
					value={formatCurrency(summary?.valueAtRisk ?? 0)}
					tooltip="Estimated one-day loss not expected to be exceeded 95% of the time."
					change={summary ? formatPercent(summary.exposure * 100) : undefined}
					trend="neutral"
				/>
			</div>
			<div className="grid gap-6 xl:grid-cols-3">
				<div className="xl:col-span-2">
					<ChartCard
						title="Daily P&L"
						description="Track the portfolio performance over the selected range."
						chartType="line"
						data={pnlChartData}
						options={pnlChartOptions}
						tooltip="Line chart showing how daily profit and loss evolves over the chosen window."
						actionSlot={
							<div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-medium text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
								{(Object.keys(pnlRangeSettings) as PnlRange[]).map((range) => (
									<button
										key={range}
										type="button"
										onClick={() => setPnlRange(range)}
										className={clsx(
											"rounded-full px-3 py-1 transition",
											pnlRange === range
												? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
												: "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
										)}
									>
										{range}
									</button>
								))}
							</div>
						}
					/>
				</div>
				<ChartCard
					title="Risk Allocation"
					description="Capital distribution by asset class."
					chartType="bar"
					data={riskAllocationData}
					options={riskAllocationOptions}
					tooltip="Bar chart illustrating where portfolio risk is concentrated by asset class."
				/>
			</div>
			<D3Card
				title="Factor Risk Heatmap"
				description="Visualise top factor exposures and how to interpret them."
				contentClassName="flex flex-col gap-6 lg:h-[24rem] lg:flex-row lg:items-stretch"
				tooltip="Heatmap comparing factor exposures across asset classes with contextual insights alongside."
			>
				<div className="flex-1">
					<div className="h-60 min-h-[16rem] lg:h-full">
						<RiskHeatmap data={riskMatrix} />
					</div>
				</div>
				<div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/60">
					<div className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
						Factor insights
					</div>
					<div className="flex-1 overflow-y-auto px-4 py-3 pr-3">
						<div className="space-y-3 text-sm">
							{factorInsights.map((insight) => (
								<div
									key={insight.factor}
									className="rounded-lg border border-slate-200 bg-white p-3 text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
									title={`How ${insight.factor} influences portfolio risk.`}
								>
									<h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
										{insight.factor}
									</h4>
									<p className="mt-1 leading-5">{insight.meaning}</p>
									<p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">
										{insight.example}
									</p>
								</div>
							))}
						</div>
					</div>
				</div>
			</D3Card>
			<div className="space-y-4">
				<h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
					Open Positions
				</h3>
				<DataTable
					columns={[
						{ key: "symbol", label: "Symbol" },
						{ key: "quantity", label: "Quantity" },
						{
							key: "marketValue",
							label: "Market Value",
							render: (value) => formatCurrency(value as number)
						},
						{
							key: "pnl",
							label: "Unrealized P&L",
							render: (value) => (
								<span
									className={
										(value as number) >= 0
											? "text-emerald-500"
											: "text-rose-500"
									}
								>
									{formatCurrency(value as number)}
								</span>
							)
						},
						{ key: "risk", label: "Risk" }
					]}
					data={positions}
				/>
			</div>
		</section>
	);
};
