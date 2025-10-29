"""Backtesting utilities for the quantitative analytics engine."""

from __future__ import annotations

import itertools
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Sequence, Tuple, Type

from .strategies import (
    BlackScholesPricingStrategy,
    PairSeries,
    StatisticalArbitrageStrategy,
    Strategy,
)


@dataclass
class BacktestRecord:
    strategy_name: str
    parameters: Dict[str, float]
    pnl: List[float]
    signals: Sequence


@dataclass
class BacktestSummary:
    records: List[BacktestRecord] = field(default_factory=list)

    def best_record(self, key: str = "pnl") -> BacktestRecord:
        if not self.records:
            raise ValueError("no backtest records available")
        if key == "pnl":
            return max(self.records, key=lambda record: record.pnl[-1] if record.pnl else float("-inf"))
        raise ValueError(f"unsupported key: {key}")


class Backtester:
    """Runs strategies across parameter grids and tracks PnL."""

    def run_strategy(
        self,
        strategy_cls: Type[Strategy],
        price_history: Sequence[float],
        param_grid: Dict[str, Iterable[float]],
        initial_capital: float = 0.0,
    ) -> BacktestSummary:
        summary = BacktestSummary()
        for params in _grid(param_grid):
            strategy = strategy_cls(**params)
            result = strategy.backtest(price_history, initial_capital=initial_capital)
            summary.records.append(
                BacktestRecord(
                    strategy_name=strategy.name,
                    parameters=result.parameters,
                    pnl=result.pnl,
                    signals=result.signals,
                )
            )
        return summary

    def run_stat_arb(
        self,
        price_series: PairSeries,
        param_grid: Dict[str, Iterable[float]],
    ) -> BacktestSummary:
        summary = BacktestSummary()
        for params in _grid(param_grid):
            strategy = StatisticalArbitrageStrategy(**params)
            signals = strategy.generate_pair_signals(price_series)
            pnl = _pair_pnl(price_series, signals)
            summary.records.append(
                BacktestRecord(
                    strategy_name=strategy.name,
                    parameters=params,
                    pnl=pnl,
                    signals=signals,
                )
            )
        return summary

    def price_option_grid(
        self,
        pricing_strategy: BlackScholesPricingStrategy,
        scenarios: Sequence[Dict[str, float]],
    ) -> List[Tuple[Dict[str, float], float]]:
        priced: List[Tuple[Dict[str, float], float]] = []
        for scenario in scenarios:
            params = pricing_strategy.parameters.copy()
            params.update(scenario)
            price = pricing_strategy.price(pricing_strategy_parameters_from_dict(params))
            priced.append((scenario, price))
        return priced


def pricing_strategy_parameters_from_dict(values: Dict[str, float]):
    from .strategies import BlackScholesParameters

    return BlackScholesParameters(
        spot=values["spot"],
        strike=values["strike"],
        time_to_maturity=values["time_to_maturity"],
        risk_free_rate=values["risk_free_rate"],
        volatility=values["volatility"],
        option_type=values.get("option_type", "call"),
    )


def _grid(param_grid: Dict[str, Iterable[float]]):
    keys = list(param_grid.keys())
    values = [list(param_grid[key]) for key in keys]
    for combination in itertools.product(*values):
        yield {key: value for key, value in zip(keys, combination)}


def _pair_pnl(pair: PairSeries, signals: Sequence[Tuple[float, float]], initial_capital: float = 0.0) -> List[float]:
    prices_a = list(pair.asset_a)
    prices_b = list(pair.asset_b)
    capital = initial_capital
    pnl: List[float] = [capital]
    for idx in range(1, len(prices_a)):
        pos_a, pos_b = signals[idx - 1]
        capital += pos_a * (prices_a[idx] - prices_a[idx - 1])
        capital += pos_b * (prices_b[idx] - prices_b[idx - 1])
        pnl.append(capital)
    return pnl
