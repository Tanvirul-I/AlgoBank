import { useEffect, useRef } from "react";
import * as d3 from "d3";

export interface ComplianceSeverityDatum {
	status: string;
	high: number;
	medium: number;
	low: number;
}

interface ComplianceStatusChartProps {
	data: ComplianceSeverityDatum[];
}

type SeverityKey = "high" | "medium" | "low";

const severityKeys: SeverityKey[] = ["high", "medium", "low"];
const severityPalette: Record<SeverityKey, string> = {
	high: "#fb7185",
	medium: "#f97316",
	low: "#22d3ee"
};

const formatCount = (value: number) => `${value}`;

export const ComplianceStatusChart = ({ data }: ComplianceStatusChartProps) => {
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!containerRef.current) {
			return;
		}

		const container = containerRef.current;
		const width = container.clientWidth || 520;
		const height = container.clientHeight || Math.max(260, data.length * 72);

		const margin = { top: 12, right: 24, bottom: 64, left: 120 };
		const innerWidth = width - margin.left - margin.right;
		const innerHeight = height - margin.top - margin.bottom;

		const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

		const content = svg
			.append("g")
			.attr("transform", `translate(${margin.left},${margin.top})`);

		const totalByStatus = data.map((item) => item.high + item.medium + item.low);
		const maxTotal = d3.max(totalByStatus) ?? 1;

		const xScale = d3.scaleLinear().domain([0, maxTotal]).range([0, innerWidth]).nice();
		const yScale = d3
			.scaleBand()
			.domain(data.map((item) => item.status))
			.range([0, innerHeight])
			.padding(0.4);

		const stackGenerator = d3
			.stack<ComplianceSeverityDatum>()
			.keys(severityKeys)
			.order(d3.stackOrderNone)
			.offset(d3.stackOffsetNone);

		const stackedSeries = stackGenerator(data);

		const groups = content
			.selectAll("g.status")
			.data(stackedSeries)
			.join("g")
			.attr("class", "status")
			.attr("fill", (series) => severityPalette[series.key as SeverityKey]);

		groups
			.selectAll("rect")
			.data((series) =>
				series.map((segment) => ({
					key: series.key as SeverityKey,
					status: segment.data.status,
					value: segment.data[series.key as SeverityKey],
					x0: segment[0],
					x1: segment[1]
				}))
			)
			.join("rect")
			.attr("rx", 6)
			.attr("x", (segment) => xScale(segment.x0))
			.attr("y", (segment) => yScale(segment.status) ?? 0)
			.attr("width", (segment) => Math.max(0, xScale(segment.x1) - xScale(segment.x0)))
			.attr("height", yScale.bandwidth());

		content
			.append("g")
			.attr("transform", `translate(0,${innerHeight})`)
			.call(
				d3
					.axisBottom(xScale)
					.ticks(5)
					.tickFormat((value) => `${value}`)
			)
			.call((g) => g.select(".domain").remove())
			.selectAll("text")
			.attr("fill", "#64748b")
			.attr("font-size", 12)
			.attr("dy", "1.4em");

		content
			.append("g")
			.call(d3.axisLeft(yScale).tickSize(0))
			.call((g) => g.select(".domain").remove())
			.selectAll("text")
			.attr("fill", "#64748b")
			.attr("font-size", 12)
			.attr("dx", "-0.4em");

		const labelGroup = content.append("g");

		labelGroup
			.selectAll("text")
			.data(data)
			.join("text")
			.attr("x", (item) => xScale(item.high + item.medium + item.low) + 12)
			.attr("y", (item) => (yScale(item.status) ?? 0) + yScale.bandwidth() / 2)
			.attr("dominant-baseline", "central")
			.attr("fill", "#0f172a")
			.attr("font-size", 12)
			.attr("font-weight", 600)
			.text((item) => formatCount(item.high + item.medium + item.low));

		const legend = svg
			.append("g")
			.attr("transform", `translate(${margin.left},${height - margin.bottom + 24})`)
			.attr("font-size", 12);

		const legendItems = severityKeys.map((key) => ({
			key,
			label: key.charAt(0).toUpperCase() + key.slice(1)
		}));

		const legendGroup = legend
			.selectAll("g.legend-item")
			.data(legendItems)
			.join("g")
			.attr("class", "legend-item")
			.attr("transform", (_, index) => `translate(${index * 120},0)`);

		legendGroup
			.append("rect")
			.attr("width", 14)
			.attr("height", 14)
			.attr("rx", 4)
			.attr("fill", (item) => severityPalette[item.key as SeverityKey]);

		legendGroup
			.append("text")
			.attr("x", 20)
			.attr("y", 7)
			.attr("dominant-baseline", "middle")
			.attr("fill", "#475569")
			.text((item) => item.label);

		legend
			.append("text")
			.attr("x", 0)
			.attr("y", -10)
			.attr("fill", "#475569")
			.attr("font-size", 12)
			.text("Alerts by severity");

		return () => {
			svg.remove();
		};
	}, [data]);

	return <div ref={containerRef} className="h-full w-full" />;
};
