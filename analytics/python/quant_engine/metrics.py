"""Risk and performance metrics for backtests."""

from __future__ import annotations

import math
from typing import Iterable, List, Sequence


def sharpe_ratio(returns: Sequence[float], risk_free_rate: float = 0.0) -> float:
    excess = [r - risk_free_rate for r in returns]
    mean_excess = _mean(excess)
    stdev = _stdev(excess)
    if stdev == 0:
        return 0.0
    return mean_excess / stdev


def max_drawdown(pnl: Sequence[float]) -> float:
    peak = float("-inf")
    max_dd = 0.0
    for value in pnl:
        peak = max(peak, value)
        drawdown = (value - peak) / peak if peak not in (0.0, float("-inf")) else 0.0
        max_dd = min(max_dd, drawdown)
    return abs(max_dd)


def volatility(returns: Sequence[float]) -> float:
    return _stdev(returns)


def value_at_risk(returns: Sequence[float], confidence: float = 0.95) -> float:
    sorted_returns = sorted(returns)
    index = int((1 - confidence) * (len(sorted_returns) - 1))
    index = max(0, min(index, len(sorted_returns) - 1))
    return -sorted_returns[index]


def conditional_value_at_risk(returns: Sequence[float], confidence: float = 0.95) -> float:
    sorted_returns = sorted(returns)
    cutoff_index = int((1 - confidence) * len(sorted_returns))
    cutoff_index = max(1, cutoff_index)
    tail_losses = sorted_returns[:cutoff_index]
    return -_mean(tail_losses)


def compute_returns(prices: Sequence[float]) -> List[float]:
    returns: List[float] = []
    for idx in range(1, len(prices)):
        previous = prices[idx - 1]
        if previous == 0:
            returns.append(0.0)
        else:
            returns.append((prices[idx] - previous) / previous)
    return returns


def _mean(values: Iterable[float]) -> float:
    values = list(values)
    if not values:
        return 0.0
    return sum(values) / len(values)


def _stdev(values: Sequence[float]) -> float:
    values = list(values)
    if len(values) <= 1:
        return 0.0
    mean_val = _mean(values)
    variance = sum((value - mean_val) ** 2 for value in values) / (len(values) - 1)
    return math.sqrt(variance)
