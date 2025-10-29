import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
	children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
	const { isAuthenticated, isLoading } = useAuth();
	const location = useLocation();

	if (isLoading) {
		return null;
	}

	if (!isAuthenticated) {
		return <Navigate to="/login" replace state={{ from: location }} />;
	}

	return <>{children}</>;
};
