import { useId, useState } from "react";
import { clsx } from "clsx";

interface InfoTooltipProps {
	content?: string;
	className?: string;
}

export const InfoTooltip = ({ content, className }: InfoTooltipProps) => {
	const [isVisible, setIsVisible] = useState(false);
	const tooltipId = useId();

	if (!content) {
		return null;
	}

	return (
		<span className="relative inline-flex">
			<button
				type="button"
				className={clsx(
					"inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/80 dark:focus-visible:ring-slate-500/80",
					className
				)}
				aria-describedby={isVisible ? tooltipId : undefined}
				onFocus={() => setIsVisible(true)}
				onBlur={() => setIsVisible(false)}
				onMouseEnter={() => setIsVisible(true)}
				onMouseLeave={() => setIsVisible(false)}
				onTouchStart={() => setIsVisible((prev) => !prev)}
			>
				<span className="sr-only">{content}</span>
				<span aria-hidden="true">?</span>
			</button>
			<div
				id={tooltipId}
				role="tooltip"
				className={clsx(
					"pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white opacity-0 shadow-lg ring-1 ring-black/5 transition-all duration-150 ease-out dark:bg-slate-700",
					isVisible ? "translate-y-0 scale-100 opacity-100" : "-translate-y-1 scale-95"
				)}
				aria-hidden={!isVisible}
			>
				{content}
			</div>
		</span>
	);
};
