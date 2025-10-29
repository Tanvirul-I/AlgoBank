import { createUser, findUserByEmail, findUserById } from "../repositories/userRepository";
import { UserRole } from "../types";
import { AppError, UnauthorizedError } from "../utils/errors";
import { hashPassword, verifyPassword } from "../utils/password";

import { generateTokens, revokeTokensForUser, rotateRefreshToken, TokenPair } from "./tokenService";

export const registerUser = async ({
	email,
	password,
	role
}: {
	email: string;
	password: string;
	role: UserRole;
}): Promise<{ accessToken: string; refreshToken: string }> => {
	const existing = await findUserByEmail(email);
	if (existing) {
		throw new AppError("Email already registered.", 409);
	}

	const passwordHash = await hashPassword(password);
	const user = await createUser(email, passwordHash, role);
	return generateTokens({ id: user.id, email: user.email, role: user.role });
};

export const loginUser = async ({
	email,
	password
}: {
	email: string;
	password: string;
}): Promise<{ accessToken: string; refreshToken: string }> => {
	const user = await findUserByEmail(email);
	if (!user) {
		throw new UnauthorizedError("Invalid credentials.");
	}

	const matches = await verifyPassword(password, user.password_hash);
	if (!matches) {
		throw new UnauthorizedError("Invalid credentials.");
	}

	return generateTokens({ id: user.id, email: user.email, role: user.role });
};

export const refreshUserToken = async (token: string): Promise<TokenPair> => {
	const tokens = await rotateRefreshToken(token);
	if (!tokens) {
		throw new UnauthorizedError("Invalid refresh token.");
	}
	return tokens;
};

export const logoutUser = async (userId: string): Promise<void> => {
	await revokeTokensForUser(userId);
};

export const getUserProfile = async (userId: string) => {
	const user = await findUserById(userId);
	if (!user) {
		throw new UnauthorizedError();
	}
	return { id: user.id, email: user.email, role: user.role };
};
