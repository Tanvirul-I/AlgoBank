import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export const SignUp = () => {
	const { register } = useAuth();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (password !== confirmPassword) {
			setError("Passwords do not match.");
			return;
		}

		setIsSubmitting(true);
		setError(null);

		try {
			await register({ email, password });
		} catch (err) {
			setError("Registration failed. Try a different email or try again later.");
			setIsSubmitting(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-12 dark:bg-slate-950">
			<div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
				<div>
					<p className="text-sm font-semibold uppercase tracking-wide text-brand-500">
						AlgoBank
					</p>
					<h2 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
						Create your account
					</h2>
					<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
						Sign up to explore the trading dashboard and simulated banking tools.
					</p>
				</div>
				<form className="mt-8 space-y-6" onSubmit={handleSubmit}>
					<div className="space-y-2">
						<label
							className="block text-sm font-medium text-slate-700 dark:text-slate-200"
							htmlFor="email"
						>
							Work email
						</label>
						<input
							id="email"
							type="email"
							autoComplete="email"
							className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							required
						/>
					</div>
					<div className="space-y-2">
						<label
							className="block text-sm font-medium text-slate-700 dark:text-slate-200"
							htmlFor="password"
						>
							Password
						</label>
						<input
							id="password"
							type="password"
							autoComplete="new-password"
							minLength={8}
							className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							required
						/>
					</div>
					<div className="space-y-2">
						<label
							className="block text-sm font-medium text-slate-700 dark:text-slate-200"
							htmlFor="confirmPassword"
						>
							Confirm password
						</label>
						<input
							id="confirmPassword"
							type="password"
							autoComplete="new-password"
							minLength={8}
							className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
							value={confirmPassword}
							onChange={(event) => setConfirmPassword(event.target.value)}
							required
						/>
					</div>
					<p className="text-xs text-slate-500 dark:text-slate-400">
						Use at least 8 characters with a mix of letters and numbers.
					</p>
					{error ? <p className="text-sm text-rose-500">{error}</p> : null}
					<button
						type="submit"
						disabled={isSubmitting}
						className="w-full rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:bg-brand-300"
					>
						{isSubmitting ? "Creating account…" : "Create account"}
					</button>
				</form>
				<p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
					Already have an account?{" "}
					<Link className="font-semibold text-brand-500 hover:text-brand-400" to="/login">
						Sign in
					</Link>
					.
				</p>
			</div>
		</div>
	);
};
