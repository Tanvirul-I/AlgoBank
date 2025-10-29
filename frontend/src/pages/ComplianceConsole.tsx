import { useEffect, useMemo, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { DataTable } from "@/components/DataTable";
import { ChartCard } from "@/components/ChartCard";
import { request } from "@/services/apiClient";
import { formatCurrency } from "@/utils/formatters";

interface AlertRow {
	id: string;
	strategy: string;
	severity: "Low" | "Medium" | "High";
	description: string;
	status: "Open" | "Investigating" | "Resolved";
	amount: number;
}

interface AlertTrendPoint {
	timestamp: string;
	value: number;
}

export const ComplianceConsole = () => {
	const [alerts, setAlerts] = useState<AlertRow[]>([]);
	const [trend, setTrend] = useState<AlertTrendPoint[]>([]);

	useEffect(() => {
		request<AlertRow[]>({ url: "/compliance/alerts" })
			.then(setAlerts)
			.catch(() => {
				setAlerts([
					{
						id: "AL-5023",
						strategy: "Options Gamma",
						severity: "High",
						description: "Position concentration exceeded desk limits.",
						status: "Investigating",
						amount: 1_250_000
					},
					{
						id: "AL-4987",
						strategy: "FX Carry",
						severity: "Medium",
						description: "Swap exposure flagged by overnight risk.",
						status: "Open",
						amount: 640_000
					},
					{
						id: "AL-4931",
						strategy: "Commodities Momentum",
						severity: "Low",
						description: "Trade frequency anomaly detected.",
						status: "Resolved",
						amount: 210_000
					}
				]);
			});

		request<AlertTrendPoint[]>({ url: "/compliance/alert-trend" })
			.then(setTrend)
			.catch(() => {
				const now = new Date();
				setTrend(
					Array.from({ length: 12 }).map((_, index) => ({
						timestamp: new Date(
							now.getFullYear(),
							now.getMonth() - (11 - index)
						).toISOString(),
						value: Math.round(8 + Math.sin(index / 2) * 3 + index * 0.5)
					}))
				);
			});
	}, []);

	const chartData = useMemo(
		() => ({
			labels: trend.map((item) => item.timestamp),
			datasets: [
				{
					type: "bar" as const,
					label: "Flagged alerts",
					data: trend.map((item) => item.value),
					backgroundColor: "#FB7185",
					borderRadius: 12
				}
			]
		}),
		[trend]
	);

	const chartOptions = useMemo(
		() => ({
			responsive: true,
			scales: {
				x: {
					type: "time",
					time: { unit: "month" },
					grid: { display: false }
				},
				y: {
					beginAtZero: true,
					ticks: {
						stepSize: 2
					}
				}
			},
			plugins: {
				legend: { display: false }
			}
		}),
		[]
	);

	const severityTotals = useMemo(
		() =>
			alerts.reduce(
				(accumulator, alert) => {
					if (alert.severity === "High") {
						accumulator.high += 1;
					}
					if (alert.severity === "Medium") {
						accumulator.medium += 1;
					}
					if (alert.severity === "Low") {
						accumulator.low += 1;
					}

					return accumulator;
				},
				{ high: 0, medium: 0, low: 0 }
			),
		[alerts]
	);

	const severityChartData = useMemo(
		() => ({
			labels: ["High", "Medium", "Low"],
			datasets: [
				{
					label: "Alerts",
					data: [severityTotals.high, severityTotals.medium, severityTotals.low],
					backgroundColor: ["#fb7185", "#f97316", "#22d3ee"],
					borderColor: "#ffffff",
					borderWidth: 2
				}
			]
		}),
		[severityTotals]
	);

	const severityChartOptions = useMemo(
		() => ({
			plugins: {
				legend: { position: "bottom" }
			}
		}),
		[]
	);

	return (
		<section className="space-y-8">
			<TopBar
				title="Compliance Console"
				subtitle="Monitor flagged transactions and audit trails."
			/>
			<div className="space-y-6">
				<DataTable
					columns={[
						{ key: "id", label: "Alert ID" },
						{ key: "strategy", label: "Strategy" },
						{ key: "severity", label: "Severity" },
						{ key: "status", label: "Status" },
						{
							key: "amount",
							label: "Value",
							render: (value) => formatCurrency(value as number)
						}
					]}
					data={alerts}
					emptyLabel="No alerts triggered"
				/>
				<div className="grid gap-6 xl:grid-cols-3">
					<div className="xl:col-span-2">
						<ChartCard
							title="Monthly Alert Volume"
							description="Aggregate count of compliance alerts raised per month."
							chartType="bar"
							data={chartData}
							options={chartOptions}
						/>
					</div>
					<ChartCard
						title="Alert Severity Breakdown"
						description="Share of alerts by severity across the compliance queue."
						chartType="pie"
						data={severityChartData}
						options={severityChartOptions}
					/>
				</div>
			</div>
		</section>
	);
};
