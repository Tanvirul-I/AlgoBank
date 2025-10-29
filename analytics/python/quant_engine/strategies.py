"""Strategy templates for the quantitative analytics engine."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Dict, List, Sequence, Tuple


@dataclass
class StrategyResult:
    """Container for strategy signals and resulting PnL."""

    signals: List[float]
    pnl: List[float]
    parameters: Dict[str, float]


class Strategy:
    """Abstract base class for all trading strategies."""

    name: str = "base"

    def __init__(self, **parameters: float) -> None:
        self.parameters: Dict[str, float] = parameters

    def generate_signals(self, price_history: Sequence[float]) -> List[float]:
        raise NotImplementedError

    def backtest(self, price_history: Sequence[float], initial_capital: float = 0.0) -> StrategyResult:
        prices = list(price_history)
        signals = self.generate_signals(prices)
        pnl = _calculate_pnl(prices, signals, initial_capital)
        return StrategyResult(signals=signals, pnl=pnl, parameters=self.parameters.copy())


class MeanReversionStrategy(Strategy):
    """Simple mean reversion strategy using a moving average band."""

    name = "mean_reversion"

    def __init__(self, lookback: int = 5, entry_z: float = 1.0, exit_z: float = 0.2) -> None:
        if lookback <= 1:
            raise ValueError("lookback must be greater than 1")
        super().__init__(lookback=lookback, entry_z=entry_z, exit_z=exit_z)

    def generate_signals(self, price_history: Sequence[float]) -> List[float]:
        prices = list(price_history)
        lookback = int(self.parameters["lookback"])
        entry_z = float(self.parameters["entry_z"])
        exit_z = float(self.parameters["exit_z"])
        signals: List[float] = [0.0 for _ in prices]
        rolling: List[float] = []
        for idx, price in enumerate(prices):
            rolling.append(price)
            if len(rolling) > lookback:
                rolling.pop(0)
            if len(rolling) < lookback:
                continue
            mean = sum(rolling) / lookback
            variance = sum((p - mean) ** 2 for p in rolling) / lookback
            stdev = math.sqrt(variance) if variance > 0 else 0.0
            z_score = (price - mean) / stdev if stdev > 0 else 0.0
            previous_signal = signals[idx - 1] if idx > 0 else 0.0
            if abs(z_score) >= entry_z:
                signals[idx] = -1.0 if z_score > 0 else 1.0
            elif abs(z_score) <= exit_z:
                signals[idx] = 0.0
            else:
                signals[idx] = previous_signal
        return signals


@dataclass
class PairSeries:
    asset_a: Sequence[float]
    asset_b: Sequence[float]


class StatisticalArbitrageStrategy(Strategy):
    """Two-asset statistical arbitrage strategy using spread z-score."""

    name = "statistical_arbitrage"

    def __init__(self, lookback: int = 20, entry_z: float = 2.0, exit_z: float = 0.5) -> None:
        if lookback <= 2:
            raise ValueError("lookback must be greater than 2")
        super().__init__(lookback=lookback, entry_z=entry_z, exit_z=exit_z)

    def generate_pair_signals(self, series: PairSeries) -> List[Tuple[float, float]]:
        prices_a = list(series.asset_a)
        prices_b = list(series.asset_b)
        if len(prices_a) != len(prices_b):
            raise ValueError("paired series must have the same length")
        lookback = int(self.parameters["lookback"])
        entry_z = float(self.parameters["entry_z"])
        exit_z = float(self.parameters["exit_z"])
        rolling_a: List[float] = []
        rolling_b: List[float] = []
        signals: List[Tuple[float, float]] = [(0.0, 0.0) for _ in prices_a]
        for idx, (a_price, b_price) in enumerate(zip(prices_a, prices_b)):
            rolling_a.append(a_price)
            rolling_b.append(b_price)
            if len(rolling_a) > lookback:
                rolling_a.pop(0)
                rolling_b.pop(0)
            if len(rolling_a) < lookback:
                continue
            beta = _ols_slope(rolling_a, rolling_b)
            spread = a_price - beta * b_price
            spread_mean = sum(a - beta * b for a, b in zip(rolling_a, rolling_b)) / lookback
            spread_var = sum((a - beta * b - spread_mean) ** 2 for a, b in zip(rolling_a, rolling_b)) / lookback
            spread_std = math.sqrt(spread_var) if spread_var > 0 else 0.0
            z_score = (spread - spread_mean) / spread_std if spread_std > 0 else 0.0
            prev = signals[idx - 1] if idx > 0 else (0.0, 0.0)
            if abs(z_score) >= entry_z:
                signals[idx] = (-1.0, 1.0) if z_score > 0 else (1.0, -1.0)
            elif abs(z_score) <= exit_z:
                signals[idx] = (0.0, 0.0)
            else:
                signals[idx] = prev
        return signals

    def generate_signals(self, price_history: Sequence[float]) -> List[float]:
        raise NotImplementedError(
            "Statistical arbitrage requires paired series; use generate_pair_signals instead."
        )


@dataclass
class BlackScholesParameters:
    spot: float
    strike: float
    time_to_maturity: float
    risk_free_rate: float
    volatility: float
    option_type: str = "call"


class BlackScholesPricingStrategy(Strategy):
    """Utility strategy providing Black-Scholes pricing calculations."""

    name = "black_scholes"

    def __init__(self) -> None:
        super().__init__()

    def price(self, params: BlackScholesParameters) -> float:
        d1 = self._d1(params)
        d2 = d1 - params.volatility * math.sqrt(params.time_to_maturity)
        if params.option_type.lower() == "call":
            price = _norm_cdf(d1) * params.spot - _norm_cdf(d2) * params.strike * math.exp(-params.risk_free_rate * params.time_to_maturity)
        else:
            price = _norm_cdf(-d2) * params.strike * math.exp(-params.risk_free_rate * params.time_to_maturity) - _norm_cdf(-d1) * params.spot
        return price

    def generate_signals(self, price_history: Sequence[float]) -> List[float]:
        raise NotImplementedError("Pricing strategy does not generate trading signals.")

    @staticmethod
    def _d1(params: BlackScholesParameters) -> float:
        numerator = math.log(params.spot / params.strike) + (params.risk_free_rate + 0.5 * params.volatility ** 2) * params.time_to_maturity
        denominator = params.volatility * math.sqrt(params.time_to_maturity)
        if denominator == 0:
            raise ValueError("volatility and time to maturity must be positive")
        return numerator / denominator


def _calculate_pnl(prices: Sequence[float], signals: Sequence[float], initial_capital: float) -> List[float]:
    pnl: List[float] = []
    capital = initial_capital
    for idx in range(1, len(prices)):
        position = signals[idx - 1]
        move = prices[idx] - prices[idx - 1]
        capital += position * move
        pnl.append(capital)
    return [initial_capital] + pnl


def _ols_slope(x: Sequence[float], y: Sequence[float]) -> float:
    n = float(len(x))
    mean_x = sum(x) / n
    mean_y = sum(y) / n
    numerator = sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(x, y))
    denominator = sum((xi - mean_x) ** 2 for xi in x)
    if denominator == 0:
        return 0.0
    return numerator / denominator


def _norm_cdf(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))
