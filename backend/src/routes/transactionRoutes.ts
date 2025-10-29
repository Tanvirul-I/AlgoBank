import { Router } from "express";
import { body, param } from "express-validator";

import { db } from "../db/pool";
import { requireAuth } from "../middlewares/authMiddleware";
import { listTransactionsForAccount } from "../repositories/transactionRepository";
import { createTransfer } from "../services/transactionService";
import { ForbiddenError } from "../utils/errors";

const router = Router();

router.post(
	"/transfer",
	requireAuth,
	body("sourceAccountId").isUUID(),
	body("destinationAccountId").isUUID(),
	body("amount").isFloat({ gt: 0 }),
	body("currency").isString().isLength({ min: 3, max: 3 }),
	body("memo").optional().isString(),
	async (req, res, next) => {
		try {
			const result = await createTransfer(req, req.user!);
			res.status(201).json(result);
		} catch (error) {
			next(error);
		}
	}
);

router.get(
	"/account/:accountId",
	requireAuth,
	param("accountId").isUUID(),
	async (req, res, next) => {
		try {
			const { accountId } = req.params as { accountId: string };
			const account = await db.query<{ user_id: string }>(
				"SELECT user_id FROM accounts WHERE id = $1",
				[accountId]
			);
			const ownerId = account.rows[0]?.user_id;
			if (!ownerId) {
				return res.status(404).json({ message: "Account not found." });
			}

			if (req.user!.role === "client" && req.user!.id !== ownerId) {
				throw new ForbiddenError("You may only view transactions for your accounts.");
			}

			const transactions = await listTransactionsForAccount(accountId);
			res.json(transactions);
		} catch (error) {
			next(error);
		}
	}
);

export default router;
