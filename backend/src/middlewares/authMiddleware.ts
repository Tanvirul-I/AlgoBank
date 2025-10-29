import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env";
import { AuthenticatedUser, UserRole } from "../types";
import { ForbiddenError, UnauthorizedError } from "../utils/errors";

export const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
	const header = req.headers.authorization;
	if (!header) {
		return next(new UnauthorizedError("Authorization header missing."));
	}

	const [, token] = header.split(" ");
	if (!token) {
		return next(new UnauthorizedError("Bearer token missing."));
	}

	try {
		const payload = jwt.verify(token, env.jwtAccessSecret) as jwt.JwtPayload & {
			sub: string;
			role: UserRole;
		};

		const user: AuthenticatedUser = {
			id: payload.sub,
			email: "",
			role: payload.role
		};
		req.user = user;
		next();
	} catch (error) {
		next(new UnauthorizedError("Invalid or expired token."));
	}
};

export const requireRoles = (...roles: UserRole[]) => {
	return (req: Request, _res: Response, next: NextFunction) => {
		const user = req.user;
		if (!user) {
			return next(new UnauthorizedError());
		}

		if (!roles.includes(user.role)) {
			return next(new ForbiddenError("Insufficient privileges."));
		}

		return next();
	};
};
