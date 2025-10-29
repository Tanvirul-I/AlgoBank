import { type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

interface TopBarProps {
	title: string;
	subtitle?: string;
	actionSlot?: ReactNode;
}

export const TopBar = ({ title, subtitle, actionSlot }: TopBarProps) => {
	const { user } = useAuth();

	return (
		<header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
			<div>
				<h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
					{title}
				</h2>
				<p className="text-sm text-slate-500 dark:text-slate-400">
					{subtitle ??
						`Stay on top of your exposure, ${user?.name?.split(" ")[0] ?? "team"}.`}
				</p>
			</div>
			{actionSlot ? <div className="flex items-center gap-3">{actionSlot}</div> : null}
		</header>
	);
};
