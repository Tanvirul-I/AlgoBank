import { Request } from "express";
import { validationResult } from "express-validator";

import { createAccount, findAccountsByUser, listAccounts } from "../repositories/accountRepository";
import { AuthenticatedUser } from "../types";
import { AppError, ForbiddenError } from "../utils/errors";

export const createAccountForUser = async (req: Request, requester: AuthenticatedUser) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		throw new AppError(
			`Validation failed: ${errors
				.array()
				.map((e) => e.msg)
				.join(", ")}`,
			422
		);
	}

	const { userId, name, currency } = req.body as {
		userId?: string;
		name: string;
		currency: string;
	};

	if (requester.role !== "admin" && userId && requester.id !== userId) {
		throw new ForbiddenError("Insufficient privileges to create accounts for other users.");
	}

	const targetUserId = userId ?? requester.id;
	return createAccount(targetUserId, name, currency);
};

export const getAccounts = async (requester: AuthenticatedUser) => {
	if (requester.role === "admin" || requester.role === "auditor") {
		return listAccounts();
	}
	return findAccountsByUser(requester.id);
};
