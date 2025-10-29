import { createContext, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { request } from "@/services/apiClient";

interface Credentials {
	email: string;
	password: string;
}

interface AuthContextValue {
	isAuthenticated: boolean;
	isLoading: boolean;
	user: AuthenticatedUser | null;
	login: (_credentials: Credentials) => Promise<void>;
	register: (_credentials: Credentials) => Promise<void>;
	logout: () => void;
}

interface AuthenticatedUser {
	id: string;
	name: string;
	email: string;
	roles: string[];
}

const TOKEN_STORAGE_KEY = "algobank_token";
type AuthTokens = { accessToken: string; refreshToken: string };

export const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
	children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
	const navigate = useNavigate();
	const location = useLocation();
	const [user, setUser] = useState<AuthenticatedUser | null>(null);
	const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
	const [isLoading, setIsLoading] = useState<boolean>(true);

	const fetchProfile = useCallback(async () => {
		try {
			const profile = await request<AuthenticatedUser>({
				url: "/auth/me"
			});
			setUser(profile);
			setIsAuthenticated(true);
		} catch (error) {
			setUser(null);
			setIsAuthenticated(false);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
		if (token) {
			fetchProfile();
		} else {
			setIsLoading(false);
		}
	}, [fetchProfile]);

	const handleAuthentication = useCallback(
		async (tokens: AuthTokens) => {
			window.localStorage.setItem(TOKEN_STORAGE_KEY, tokens.accessToken);
			await fetchProfile();

			const from = (location.state as { from?: Location })?.from?.pathname ?? "/";
			navigate(from, { replace: true });
		},
		[fetchProfile, location.state, navigate]
	);

	const login = useCallback(
		async (credentials: Credentials) => {
			const tokens = await request<AuthTokens>({
				method: "post",
				url: "/auth/login",
				data: credentials
			});

			await handleAuthentication(tokens);
		},
		[handleAuthentication]
	);

	const register = useCallback(
		async (credentials: Credentials) => {
			const tokens = await request<AuthTokens>({
				method: "post",
				url: "/auth/register",
				data: credentials
			});

			await handleAuthentication(tokens);
		},
		[handleAuthentication]
	);

	const logout = useCallback(() => {
		window.localStorage.removeItem(TOKEN_STORAGE_KEY);
		setIsAuthenticated(false);
		setUser(null);
		setIsLoading(false);
		navigate("/login");
	}, [navigate]);

	const value = useMemo(
		() => ({
			isAuthenticated,
			isLoading,
			user,
			login,
			register,
			logout
		}),
		[isAuthenticated, isLoading, login, logout, register, user]
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
