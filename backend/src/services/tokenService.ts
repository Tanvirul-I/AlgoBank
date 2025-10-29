import jwt, { Secret, SignOptions } from "jsonwebtoken";
import { v4 as uuid } from "uuid";

import { env } from "../config/env";
import { db } from "../db/pool";
import { findUserById } from "../repositories/userRepository";
import { AuthenticatedUser } from "../types";

export interface TokenPair {
	accessToken: string;
	refreshToken: string;
}

export const generateTokens = async (user: AuthenticatedUser): Promise<TokenPair> => {
	const tokenId = uuid();
	const accessToken = jwt.sign({ sub: user.id, role: user.role }, env.jwtAccessSecret as Secret, {
		expiresIn: env.jwtAccessTtl as SignOptions["expiresIn"],
		jwtid: tokenId
	});
	const refreshToken = jwt.sign(
		{ sub: user.id, role: user.role, tokenId },
		env.jwtRefreshSecret as Secret,
		{
			expiresIn: env.jwtRefreshTtl as SignOptions["expiresIn"]
		}
	);

	await db.query(
		`INSERT INTO refresh_tokens (id, user_id, token_id, expires_at)
     VALUES ($1, $2, $3, NOW() + $4::interval)`,
		[uuid(), user.id, tokenId, env.jwtRefreshTtl]
	);

	return { accessToken, refreshToken };
};

export const rotateRefreshToken = async (token: string): Promise<TokenPair | null> => {
	try {
		const payload = jwt.verify(token, env.jwtRefreshSecret as Secret) as jwt.JwtPayload & {
			sub: string;
			tokenId: string;
			role: AuthenticatedUser["role"];
		};

		const existing = await db.query(
			"SELECT id FROM refresh_tokens WHERE user_id = $1 AND token_id = $2 AND revoked_at IS NULL",
			[payload.sub, payload.tokenId]
		);

		if (existing.rowCount === 0) {
			return null;
		}

		await db.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_id = $1", [
			payload.tokenId
		]);

		const user = await findUserById(payload.sub);
		if (!user) {
			return null;
		}

		return generateTokens({
			id: user.id,
			email: user.email,
			role: user.role
		});
	} catch (error) {
		return null;
	}
};

export const revokeTokensForUser = async (userId: string): Promise<void> => {
	await db.query(
		"UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL",
		[userId]
	);
};
