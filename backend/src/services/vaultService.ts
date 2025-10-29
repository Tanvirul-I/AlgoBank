import { env } from "../config/env";

interface VaultTransitResponse {
	data?: {
		ciphertext?: string;
		plaintext?: string;
	};
}

interface VaultRequestOptions {
	method: string;
	body?: string;
	headers?: Record<string, string>;
}

const isVaultConfigured = (): boolean => Boolean(env.vault.addr && env.vault.token);

const vaultFetch = async (
	endpoint: string,
	options: VaultRequestOptions
): Promise<VaultTransitResponse> => {
	if (!isVaultConfigured()) {
		return {};
	}

	const response = await fetch(`${env.vault.addr.replace(/\/$/, "")}/v1/${endpoint}`, {
		...options,
		headers: {
			...(options.headers ?? {}),
			"Content-Type": "application/json",
			"X-Vault-Token": env.vault.token
		}
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Vault request failed: ${response.status} ${text}`);
	}

	return (await response.json()) as VaultTransitResponse;
};

export const encryptWithVault = async (plaintext: Buffer): Promise<string> => {
	if (!isVaultConfigured()) {
		return plaintext.toString("base64");
	}

	const body = JSON.stringify({
		plaintext: plaintext.toString("base64")
	});
	const result = await vaultFetch(
		`${env.vault.transitPath}/encrypt/${env.vault.encryptionKeyName}`,
		{
			method: "POST",
			body
		}
	);
	return result.data?.ciphertext ?? plaintext.toString("base64");
};

export const decryptWithVault = async (ciphertext: string): Promise<Buffer> => {
	if (!isVaultConfigured()) {
		return Buffer.from(ciphertext, "base64");
	}

	const body = JSON.stringify({
		ciphertext
	});
	const result = await vaultFetch(
		`${env.vault.transitPath}/decrypt/${env.vault.encryptionKeyName}`,
		{
			method: "POST",
			body
		}
	);
	const plain = result.data?.plaintext;
	if (!plain) {
		throw new Error("Vault decrypt response missing plaintext.");
	}
	return Buffer.from(plain, "base64");
};

export const loadSecret = async (path: string): Promise<Record<string, unknown> | null> => {
	if (!isVaultConfigured()) {
		return null;
	}

	const result = await vaultFetch(path, {
		method: "GET"
	});
	return (result.data as Record<string, unknown> | undefined) ?? null;
};
