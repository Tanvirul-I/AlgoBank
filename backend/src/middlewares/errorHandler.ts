import { NextFunction, Request, Response } from "express";

import { AppError } from "../utils/errors";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
	if (error instanceof AppError) {
		return res.status(error.status).json({ message: error.message });
	}

	// eslint-disable-next-line no-console
	console.error(error);
	return res.status(500).json({ message: "Internal server error." });
};
