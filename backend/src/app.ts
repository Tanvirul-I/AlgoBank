import cors, { type CorsOptions } from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env";
import { errorHandler } from "./middlewares/errorHandler";
import accountRoutes from "./routes/accountRoutes";
import authRoutes from "./routes/authRoutes";
import healthRoutes from "./routes/healthRoutes";
import riskRoutes from "./routes/riskRoutes";
import transactionRoutes from "./routes/transactionRoutes";

export const createApp = () => {
	const app = express();

	const allowedOrigins = new Set(
		env.cors.allowedOrigins.map((origin) => origin.toLowerCase().replace(/\/$/, ""))
	);

	const corsOptions: CorsOptions = {
		origin(origin, callback) {
			if (!origin) {
				callback(null, true);
				return;
			}

			const normalizedOrigin = origin.toLowerCase().replace(/\/$/, "");

			if (allowedOrigins.has(normalizedOrigin)) {
				callback(null, true);
				return;
			}

			callback(null, false);
		},
		methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
		credentials: true,
		optionsSuccessStatus: 204
	};

	app.use(helmet());
	app.use(cors(corsOptions));
	app.options("*", cors(corsOptions));
	app.use(express.json());

	app.use("/auth", authRoutes);
	app.use("/health", healthRoutes);
	app.use("/accounts", accountRoutes);
	app.use("/transactions", transactionRoutes);
	app.use("/risk", riskRoutes);

	app.use(errorHandler);

	return app;
};
