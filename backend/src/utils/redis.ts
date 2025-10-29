import { createClient, RedisClientType } from "redis";

import { env } from "../config/env";

let client: RedisClientType | null = null;
let connectionFailed = false;

export const getRedisClient = async (): Promise<RedisClientType | null> => {
	if (!env.enableRedisStreams) {
		return null;
	}

	if (client) {
		return client;
	}

	if (connectionFailed) {
		return null;
	}

	try {
		client = createClient({ url: env.redisUrl });
		client.on("error", (error) => {
			// eslint-disable-next-line no-console
			console.error("Redis client error", error);
		});
		await client.connect();
		return client;
	} catch (error) {
		client = null;
		connectionFailed = true;
		// eslint-disable-next-line no-console
		console.error("Unable to connect to Redis, risk events will be logged locally.", error);
		return null;
	}
};

export const publishToStream = async (
	stream: string,
	payload: Record<string, string>
): Promise<void> => {
	if (!env.enableRedisStreams) {
		return;
	}

	const redis = await getRedisClient();
	if (!redis) {
		// eslint-disable-next-line no-console
		console.warn(`Redis unavailable, skipping publish to ${stream}.`);
		return;
	}

	await redis.xAdd(stream, "*", payload);
};
