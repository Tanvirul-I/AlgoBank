import { useEffect, useRef } from "react";
import * as d3 from "d3";

export interface RiskHeatmapDatum {
	factor: string;
	assetClass: string;
	exposure: number;
}

interface RiskHeatmapProps {
	data: RiskHeatmapDatum[];
}

const formatExposure = (value: number) => {
	if (value >= 1_000_000) {
		return `${(value / 1_000_000).toFixed(1)}M`;
	}

	if (value >= 1_000) {
		return `${Math.round(value / 1_000)}K`;
	}

	return value.toFixed(0);
};

export const RiskHeatmap = ({ data }: RiskHeatmapProps) => {
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!containerRef.current) {
			return;
		}

		const container = containerRef.current;
		const width = container.clientWidth || 640;
		const height = container.clientHeight || 320;
		const margin = { top: 12, right: 20, bottom: 96, left: 110 };
		const innerWidth = width - margin.left - margin.right;
		const innerHeight = height - margin.top - margin.bottom;

		const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

		const content = svg
			.append("g")
			.attr("transform", `translate(${margin.left},${margin.top})`);

		const assetClasses = Array.from(new Set(data.map((item) => item.assetClass)));
		const factors = Array.from(new Set(data.map((item) => item.factor)));

		const xScale = d3.scaleBand().domain(assetClasses).range([0, innerWidth]).padding(0.2);
		const yScale = d3.scaleBand().domain(factors).range([0, innerHeight]).padding(0.2);

		const maxExposure = d3.max(data, (item) => item.exposure) ?? 1;
		const colorScale = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxExposure]);

		content
			.append("g")
			.attr("transform", `translate(0,${innerHeight})`)
			.call(d3.axisBottom(xScale).tickSize(0))
			.call((g) => g.select(".domain").remove())
			.selectAll("text")
			.attr("fill", "#64748b")
			.attr("font-size", 12)
			.attr("dy", "1.1em");

		content
			.append("g")
			.call(d3.axisLeft(yScale).tickSize(0))
			.call((g) => g.select(".domain").remove())
			.selectAll("text")
			.attr("fill", "#64748b")
			.attr("font-size", 12)
			.attr("dx", "-0.4em");

		const cells = content
			.selectAll("g.cell")
			.data(data)
			.join("g")
			.attr("class", "cell")
			.attr(
				"transform",
				(item) => `translate(${xScale(item.assetClass) ?? 0},${yScale(item.factor) ?? 0})`
			);

		cells
			.append("rect")
			.attr("rx", 8)
			.attr("width", xScale.bandwidth())
			.attr("height", yScale.bandwidth())
			.attr("fill", (item) => colorScale(item.exposure));

		const textColorThreshold = maxExposure * 0.55;

		cells
			.append("text")
			.attr("x", xScale.bandwidth() / 2)
			.attr("y", yScale.bandwidth() / 2)
			.attr("text-anchor", "middle")
			.attr("dominant-baseline", "central")
			.attr("font-size", 12)
			.attr("font-weight", 600)
			.attr("fill", (item) => (item.exposure > textColorThreshold ? "#f8fafc" : "#1f2937"))
			.text((item) => formatExposure(item.exposure));

		const defs = svg.append("defs");
		const gradientId = "risk-heatmap-gradient";

		const gradient = defs
			.append("linearGradient")
			.attr("id", gradientId)
			.attr("x1", "0%")
			.attr("x2", "100%");

		const gradientStops = d3.range(0, 1.01, 0.2);

		gradientStops.forEach((stop) => {
			gradient
				.append("stop")
				.attr("offset", `${stop * 100}%`)
				.attr("stop-color", colorScale(maxExposure * stop));
		});

		const legendWidth = Math.min(180, innerWidth);
		const legendHeight = 12;
		const legendScale = d3.scaleLinear().domain([0, maxExposure]).range([0, legendWidth]);

		const legendOffset = height - margin.bottom + 60;

		const legend = svg
			.append("g")
			.attr("transform", `translate(${margin.left},${legendOffset})`);

		legend
			.append("rect")
			.attr("width", legendWidth)
			.attr("height", legendHeight)
			.attr("rx", 6)
			.attr("fill", `url(#${gradientId})`);

		legend
			.append("g")
			.attr("transform", `translate(0,${legendHeight})`)
			.call(
				d3
					.axisBottom(legendScale)
					.ticks(4)
					.tickFormat((value) => formatExposure(Number(value)))
			)
			.call((g) => g.select(".domain").remove())
			.selectAll("text")
			.attr("fill", "#64748b")
			.attr("font-size", 11)
			.attr("dy", "1.2em");

		legend
			.append("text")
			.attr("x", legendWidth / 2)
			.attr("y", -10)
			.attr("text-anchor", "middle")
			.attr("fill", "#475569")
			.attr("font-size", 12)
			.text("VaR contribution");

		return () => {
			svg.remove();
		};
	}, [data]);

	return <div ref={containerRef} className="h-full w-full" />;
};
