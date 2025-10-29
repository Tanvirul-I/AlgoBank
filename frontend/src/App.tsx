import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { PortfolioOverview } from "@/pages/PortfolioOverview";
import { ComplianceConsole } from "@/pages/ComplianceConsole";
import { MarketAnalytics } from "@/pages/MarketAnalytics";
import { Login } from "@/pages/Login";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SignUp } from "@/pages/SignUp";

const App = () => (
	<Routes>
		<Route path="/login" element={<Login />} />
		<Route path="/signup" element={<SignUp />} />
		<Route
			path="/"
			element={
				<ProtectedRoute>
					<DashboardLayout />
				</ProtectedRoute>
			}
		>
			<Route index element={<Navigate to="portfolio" replace />} />
			<Route path="portfolio" element={<PortfolioOverview />} />
			<Route path="compliance" element={<ComplianceConsole />} />
			<Route path="analytics" element={<MarketAnalytics />} />
		</Route>
		<Route path="*" element={<Navigate to="/" replace />} />
	</Routes>
);

export default App;
