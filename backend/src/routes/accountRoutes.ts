import { Router } from "express";
import { body } from "express-validator";

import { requireAuth } from "../middlewares/authMiddleware";
import { createAccountForUser, getAccounts } from "../services/accountService";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
	try {
		const accounts = await getAccounts(req.user!);
		res.json(accounts);
	} catch (error) {
		next(error);
	}
});

router.post(
	"/",
	requireAuth,
	body("name").isString().isLength({ min: 3 }),
	body("currency").isString().isLength({ min: 3, max: 3 }),
	body("userId").optional().isString(),
	async (req, res, next) => {
		try {
			const account = await createAccountForUser(req, req.user!);
			res.status(201).json(account);
		} catch (error) {
			next(error);
		}
	}
);

export default router;
