import { Router } from "express";
import { param, query, validationResult } from "express-validator";

import { db } from "../db/pool";
import { requireAuth, requireRoles } from "../middlewares/authMiddleware";
import { fetchLatestMetricsForAccount } from "../repositories/riskRepository";
import { listTransactionsForAccount } from "../repositories/transactionRepository";
import { fetchRecentAlerts } from "../services/alertService";
import { evaluateAccountRisk } from "../services/riskMonitoringService";
import { AppError } from "../utils/errors";

const router = Router();

router.get(
	"/alerts",
	requireAuth,
	requireRoles("admin", "auditor"),
	query("limit").optional().isInt({ gt: 0, lt: 500 }),
	async (req, res, next) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(422).json({
					errors: errors.array()
				});
			}

			const limit = req.query.limit ? Number(req.query.limit) : 100;
			const alerts = await fetchRecentAlerts(limit);
			res.json(alerts);
		} catch (error) {
			next(error);
		}
	}
);

router.get(
	"/accounts/:accountId/metrics",
	requireAuth,
	param("accountId").isUUID(),
	async (req, res, next) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(422).json({
					errors: errors.array()
				});
			}

			const { accountId } = req.params as { accountId: string };
			const requester = req.user!;

			const accountResult = await db.query<{ user_id: string }>(
				"SELECT user_id FROM accounts WHERE id = $1",
				[accountId]
			);
			const ownerId = accountResult.rows[0]?.user_id;
			if (!ownerId) {
				throw new AppError("Account not found.", 404);
			}

			if (requester.role === "client" && requester.id !== ownerId) {
				throw new AppError("You may only access metrics for your accounts.", 403);
			}

			const metrics = await fetchLatestMetricsForAccount(accountId, 10);

			if (metrics.length === 0) {
				const transactions = await listTransactionsForAccount(accountId, 10);
				if (transactions.length === 0) {
					return res.json({ metrics: [], latestEvaluation: null });
				}
				const evaluation = await evaluateAccountRisk(accountId);
				const snapshot = {
					id: null,
					accountId,
					exposure: evaluation.exposure,
					leverage: evaluation.leverage,
					lossRatio: evaluation.lossRatio,
					observationWindow: 90,
					createdAt: new Date()
				};
				return res.json({ metrics: [snapshot], latestEvaluation: snapshot });
			}

			const normalized = metrics.map((metric) => ({
				id: metric.id,
				accountId: metric.account_id,
				exposure: Number(metric.exposure),
				leverage: Number(metric.leverage),
				lossRatio: Number(metric.loss_ratio),
				observationWindow: metric.observation_window,
				createdAt: metric.created_at
			}));

			res.json({ metrics: normalized, latestEvaluation: normalized[0] ?? null });
		} catch (error) {
			next(error);
		}
	}
);

export default router;
