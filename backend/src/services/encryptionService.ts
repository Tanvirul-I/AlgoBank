import crypto from "crypto";

import { env } from "../config/env";

import { decryptWithVault, encryptWithVault } from "./vaultService";

export interface EncryptedPayload {
	encryptedKey: string;
	iv: string;
	authTag: string;
	ciphertext: string;
	vaultCiphertext?: string;
}

export const encryptPayload = async (payload: unknown): Promise<EncryptedPayload> => {
	if (!env.rsaPublicKey || !env.rsaPrivateKey) {
		throw new Error("RSA key pair is not configured.");
	}

	const aesKey = crypto.randomBytes(32);
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
	const serialized = Buffer.from(JSON.stringify(payload), "utf8");
	const encrypted = Buffer.concat([cipher.update(serialized), cipher.final()]);
	const authTag = cipher.getAuthTag();

	const encryptedKey = crypto.publicEncrypt(
		{
			key: Buffer.from(env.rsaPublicKey, "base64").toString("utf8"),
			padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
			oaepHash: "sha256"
		},
		aesKey
	);

	const vaultCiphertext = await encryptWithVault(aesKey);

	return {
		encryptedKey: encryptedKey.toString("base64"),
		iv: iv.toString("base64"),
		authTag: authTag.toString("base64"),
		ciphertext: encrypted.toString("base64"),
		vaultCiphertext
	};
};

export const decryptPayload = async (input: EncryptedPayload): Promise<unknown> => {
	let aesKey: Buffer | null = null;

	if (input.vaultCiphertext) {
		try {
			aesKey = await decryptWithVault(input.vaultCiphertext);
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error("Vault decryption failed, falling back to RSA key unwrap.", error);
		}
	}

	if (!aesKey) {
		const privateKey = Buffer.from(env.rsaPrivateKey, "base64").toString("utf8");
		aesKey = crypto.privateDecrypt(
			{
				key: privateKey,
				padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
				oaepHash: "sha256"
			},
			Buffer.from(input.encryptedKey, "base64")
		);
	}

	const decipher = crypto.createDecipheriv(
		"aes-256-gcm",
		aesKey,
		Buffer.from(input.iv, "base64")
	);
	decipher.setAuthTag(Buffer.from(input.authTag, "base64"));
	const decrypted = Buffer.concat([
		decipher.update(Buffer.from(input.ciphertext, "base64")),
		decipher.final()
	]);
	return JSON.parse(decrypted.toString("utf8"));
};
