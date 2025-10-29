import { ReactNode } from "react";
import { clsx } from "clsx";
import { InfoTooltip } from "./InfoTooltip";

interface D3CardProps {
	title: string;
	description?: string;
	actionSlot?: ReactNode;
	children: ReactNode;
	contentClassName?: string;
	tooltip?: string;
}

export const D3Card = ({
	title,
	description,
	actionSlot,
	children,
	contentClassName,
	tooltip
}: D3CardProps) => (
	<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
		<div className="flex items-start justify-between gap-4">
			<div className="min-w-0">
				<div className="flex items-center gap-2">
					<h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
						{title}
					</h3>
					<InfoTooltip content={tooltip} />
				</div>
				{description ? (
					<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
				) : null}
			</div>
			{actionSlot}
		</div>
		<div className={clsx("mt-4", contentClassName ?? "h-72")}>{children}</div>
	</div>
);
