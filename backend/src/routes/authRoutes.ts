import { Router } from "express";
import type { Request } from "express";
import { body, validationResult } from "express-validator";

import { requireAuth, requireRoles } from "../middlewares/authMiddleware";
import {
	getUserProfile,
	loginUser,
	logoutUser,
	refreshUserToken,
	registerUser
} from "../services/authService";
import { AppError } from "../utils/errors";

const router = Router();

type ValidatableRequest = Request<
	Record<string, unknown> | undefined,
	unknown,
	Record<string, unknown>,
	Record<string, unknown> | undefined,
	Record<string, unknown>
>;

const assertValid = (req: ValidatableRequest) => {
	const result = validationResult(req);
	if (!result.isEmpty()) {
		throw new AppError(
			`Validation failed: ${result
				.array()
				.map((error) => error.msg)
				.join(", ")}`,
			422
		);
	}
};

router.post(
	"/register",
	body("email").isEmail(),
	body("password").isLength({ min: 8 }),
	body("role").optional().isIn(["admin", "auditor", "client"]),
	async (req, res, next) => {
		try {
			assertValid(req);
			const role = (req.body.role as "admin" | "auditor" | "client" | undefined) ?? "client";
			if (role !== "client") {
				return next(new AppError("Only client self-registration is allowed."));
			}
			const { email, password } = req.body as { email: string; password: string };
			const tokens = await registerUser({ email, password, role });
			res.status(201).json(tokens);
		} catch (error) {
			next(error);
		}
	}
);

router.post(
	"/admin/register",
	requireAuth,
	requireRoles("admin"),
	body("email").isEmail(),
	body("password").isLength({ min: 12 }),
	body("role").isIn(["admin", "auditor", "client"]),
	async (req, res, next) => {
		try {
			assertValid(req);
			const role = req.body.role as "admin" | "auditor" | "client";
			const { email, password } = req.body as { email: string; password: string };
			const tokens = await registerUser({ email, password, role });
			res.status(201).json(tokens);
		} catch (error) {
			next(error);
		}
	}
);

router.post(
	"/login",
	body("email").isEmail(),
	body("password").isLength({ min: 8 }),
	async (req, res, next) => {
		try {
			assertValid(req);
			const { email, password } = req.body as { email: string; password: string };
			const tokens = await loginUser({ email, password });
			res.json(tokens);
		} catch (error) {
			next(error);
		}
	}
);

router.post("/refresh", body("refreshToken").isString(), async (req, res, next) => {
	try {
		assertValid(req);
		const { refreshToken } = req.body as { refreshToken: string };
		const tokens = await refreshUserToken(refreshToken);
		res.json(tokens);
	} catch (error) {
		next(error);
	}
});

router.post("/logout", requireAuth, async (req, res, next) => {
	try {
		const userId = req.user!.id;
		await logoutUser(userId);
		res.status(204).send();
	} catch (error) {
		next(error);
	}
});

router.get("/me", requireAuth, async (req, res, next) => {
	try {
		const profile = await getUserProfile(req.user!.id);
		res.json(profile);
	} catch (error) {
		next(error);
	}
});

export default router;
