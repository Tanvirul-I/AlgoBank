"""Portfolio optimization tooling."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Sequence

try:  # pragma: no cover - optional dependency
    import cvxpy as cp  # type: ignore
except Exception:  # pragma: no cover - cvxpy is optional
    cp = None

try:  # pragma: no cover - optional dependency
    import torch
except Exception:  # pragma: no cover - torch is optional
    torch = None


@dataclass
class OptimizationResult:
    weights: List[float]
    status: str
    metadata: Optional[dict] = None


class MarkowitzOptimizer:
    """Mean-variance optimizer with optional cvxpy integration."""

    def optimize(
        self,
        expected_returns: Sequence[float],
        covariance: Sequence[Sequence[float]],
        target_return: Optional[float] = None,
        allow_short: bool = True,
    ) -> OptimizationResult:
        if cp is not None:
            try:
                return self._optimize_with_cvxpy(expected_returns, covariance, target_return, allow_short)
            except Exception:
                # If cvxpy cannot solve the problem (e.g., invalid covariance input or solver issues),
                # fall back to the deterministic linear-algebra implementation so callers still
                # receive a valid solution.
                pass
        return self._optimize_with_linear_algebra(expected_returns, covariance, target_return, allow_short)

    def _optimize_with_cvxpy(
        self,
        expected_returns: Sequence[float],
        covariance: Sequence[Sequence[float]],
        target_return: Optional[float],
        allow_short: bool,
    ) -> OptimizationResult:
        num_assets = len(expected_returns)
        weights = cp.Variable(num_assets)
        cov_matrix = cp.Parameter((num_assets, num_assets), symmetric=True)
        cov_matrix.value = _ensure_symmetric_matrix(_to_matrix(covariance))
        mu = cp.Parameter(num_assets, value=_to_vector(expected_returns))
        objective = cp.Minimize(cp.quad_form(weights, cov_matrix))
        constraints = [cp.sum(weights) == 1]
        if target_return is not None:
            constraints.append(mu @ weights >= target_return)
        if not allow_short:
            constraints.append(weights >= 0)
        problem = cp.Problem(objective, constraints)
        problem.solve(solver=cp.SCS, verbose=False)  # type: ignore[arg-type]
        if weights.value is None:
            raise ValueError("cvxpy failed to produce a solution")
        solution = [float(value) for value in weights.value]
        return OptimizationResult(weights=solution, status=problem.status, metadata={"objective": problem.value})

    def _optimize_with_linear_algebra(
        self,
        expected_returns: Sequence[float],
        covariance: Sequence[Sequence[float]],
        target_return: Optional[float],
        allow_short: bool,
    ) -> OptimizationResult:
        inv_cov = _invert_matrix(covariance)
        ones = [1.0 for _ in expected_returns]
        mu = list(expected_returns)
        inv_cov_ones = _matrix_vector_product(inv_cov, ones)
        inv_cov_mu = _matrix_vector_product(inv_cov, mu)
        c = _dot(ones, inv_cov_ones)
        a = _dot(mu, inv_cov_mu)
        b = _dot(mu, inv_cov_ones)
        if target_return is None:
            weights = [value / c for value in inv_cov_ones]
        else:
            det = a * c - b * b
            if det == 0:
                raise ValueError("covariance matrix is singular")
            lambda1 = (a - target_return * b) / det
            lambda2 = (target_return * c - b) / det
            weights = [lambda1 * inv_cov_ones[i] + lambda2 * inv_cov_mu[i] for i in range(len(mu))]
        if not allow_short:
            weights = _project_to_simplex(weights)
        return OptimizationResult(weights=weights, status="fallback")


class TorchGradientOptimizer:
    """Gradient-based optimizer powered by PyTorch."""

    def __init__(self, learning_rate: float = 0.05, steps: int = 500) -> None:
        if torch is None:  # pragma: no cover - optional dependency
            raise RuntimeError("PyTorch is not available in this environment")
        self.learning_rate = learning_rate
        self.steps = steps

    def optimize(
        self,
        expected_returns: Sequence[float],
        covariance: Sequence[Sequence[float]],
        target_return: Optional[float] = None,
    ) -> OptimizationResult:
        if torch is None:  # pragma: no cover - optional dependency
            raise RuntimeError("PyTorch is not available in this environment")
        num_assets = len(expected_returns)
        weights = torch.nn.Parameter(torch.full((num_assets,), 1.0 / num_assets))
        optimizer = torch.optim.Adam([weights], lr=self.learning_rate)
        cov = torch.tensor(_to_matrix(covariance), dtype=torch.float32)
        mu = torch.tensor(_to_vector(expected_returns), dtype=torch.float32)
        for _ in range(self.steps):
            optimizer.zero_grad()
            variance = torch.dot(weights, torch.mv(cov, weights))
            penalty = (torch.sum(weights) - 1.0) ** 2
            if target_return is not None:
                penalty = penalty + torch.relu(target_return - torch.dot(mu, weights)) ** 2
            loss = variance + penalty
            loss.backward()
            optimizer.step()
        with torch.no_grad():
            weights.data = torch.nn.functional.softmax(weights, dim=0)
        return OptimizationResult(weights=weights.detach().tolist(), status="torch")


def _to_matrix(values: Sequence[Sequence[float]]) -> List[List[float]]:
    return [list(row) for row in values]


def _to_vector(values: Sequence[float]) -> List[float]:
    return list(values)


def _ensure_symmetric_matrix(matrix: Sequence[Sequence[float]]) -> List[List[float]]:
    """Return a symmetric copy of the provided matrix."""

    symmetrized: List[List[float]] = []
    for i, row in enumerate(matrix):
        sym_row: List[float] = []
        for j, value in enumerate(row):
            mirrored = matrix[j][i] if j < len(matrix) else value
            sym_row.append((value + mirrored) / 2.0)
        symmetrized.append(sym_row)
    return symmetrized


def _matrix_vector_product(matrix: Sequence[Sequence[float]], vector: Sequence[float]) -> List[float]:
    return [sum(row[i] * vector[i] for i in range(len(vector))) for row in matrix]


def _dot(a: Sequence[float], b: Sequence[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def _invert_matrix(matrix: Sequence[Sequence[float]]) -> List[List[float]]:
    n = len(matrix)
    aug = [[float(value) for value in row] + [1.0 if i == j else 0.0 for j in range(n)] for i, row in enumerate(matrix)]
    for col in range(n):
        pivot_row = max(range(col, n), key=lambda r: abs(aug[r][col]))
        if abs(aug[pivot_row][col]) < 1e-12:
            raise ValueError("matrix is singular")
        aug[col], aug[pivot_row] = aug[pivot_row], aug[col]
        pivot = aug[col][col]
        aug[col] = [value / pivot for value in aug[col]]
        for row in range(n):
            if row == col:
                continue
            factor = aug[row][col]
            aug[row] = [current - factor * pivot_val for current, pivot_val in zip(aug[row], aug[col])]
    inverse = [row[n:] for row in aug]
    return inverse


def _project_to_simplex(weights: Sequence[float]) -> List[float]:
    sorted_weights = sorted(weights, reverse=True)
    cumulative = 0.0
    rho = -1
    for idx, value in enumerate(sorted_weights):
        cumulative += value
        t = (cumulative - 1) / (idx + 1)
        if value - t > 0:
            rho = idx
    theta = (sum(sorted_weights[: rho + 1]) - 1) / (rho + 1) if rho >= 0 else 0.0
    projected = [max(weight - theta, 0.0) for weight in weights]
    total = sum(projected)
    return [weight / total if total != 0 else 1.0 / len(weights) for weight in projected]
