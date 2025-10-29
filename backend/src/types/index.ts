export type UserRole = "admin" | "auditor" | "client";

export interface AuthenticatedUser {
	id: string;
	email: string;
	role: UserRole;
}
