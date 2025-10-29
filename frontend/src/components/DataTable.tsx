import { ReactNode } from "react";

interface Column<T> {
	key: keyof T;
	label: string;
	render?: (_value: T[keyof T], _row: T) => ReactNode;
}

interface DataTableProps<T> {
	columns: Column<T>[];
	data: T[];
	emptyLabel?: string;
}

export const DataTable = <T extends object>({ columns, data, emptyLabel }: DataTableProps<T>) => {
	return (
		<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
			<table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
				<thead className="bg-slate-50 dark:bg-slate-900/60">
					<tr>
						{columns.map((column) => (
							<th
								key={String(column.key)}
								scope="col"
								className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
							>
								{column.label}
							</th>
						))}
					</tr>
				</thead>
				<tbody className="divide-y divide-slate-200 bg-white text-sm dark:divide-slate-800 dark:bg-slate-950/30">
					{data.length === 0 ? (
						<tr>
							<td
								colSpan={columns.length}
								className="px-4 py-6 text-center text-slate-500 dark:text-slate-400"
							>
								{emptyLabel ?? "No records found"}
							</td>
						</tr>
					) : (
						data.map((row, index) => (
							<tr
								key={index}
								className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40"
							>
								{columns.map((column) => (
									<td
										key={String(column.key)}
										className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-200"
									>
										{column.render
											? column.render(row[column.key], row)
											: (row[column.key] as ReactNode)}
									</td>
								))}
							</tr>
						))
					)}
				</tbody>
			</table>
		</div>
	);
};
