"""High level orchestration of the quantitative analytics engine."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, Optional, Sequence, Type

from .backtesting import Backtester
from .metrics import (
    conditional_value_at_risk,
    compute_returns,
    max_drawdown,
    sharpe_ratio,
    value_at_risk,
    volatility,
)
from .optimization import MarkowitzOptimizer, OptimizationResult
from .storage import ResultStore
from .strategies import (
    BlackScholesParameters,
    BlackScholesPricingStrategy,
    MeanReversionStrategy,
    PairSeries,
    StatisticalArbitrageStrategy,
    Strategy,
)


@dataclass
class BacktestResponse:
    pnl: Sequence[float]
    metrics: Dict[str, float]
    parameters: Dict[str, float]


class QuantEngine:
    """Composes strategies, backtesting, metrics, and optimization."""

    def __init__(self, store: Optional[ResultStore] = None) -> None:
        self.store = store
        self.backtester = Backtester()
        self.optimizer = MarkowitzOptimizer()
        self.pricing = BlackScholesPricingStrategy()
        self.strategy_registry: Dict[str, Type[Strategy]] = {
            MeanReversionStrategy.name: MeanReversionStrategy,
        }
        self.pair_strategy_registry: Dict[str, Type[StatisticalArbitrageStrategy]] = {
            StatisticalArbitrageStrategy.name: StatisticalArbitrageStrategy,
        }

    def register_strategy(self, name: str, strategy_cls: Type[Strategy]) -> None:
        self.strategy_registry[name] = strategy_cls

    def run_backtest(
        self,
        strategy_cls: Type[Strategy],
        price_history: Sequence[float],
        parameters: Optional[Dict[str, float]] = None,
        initial_capital: float = 0.0,
    ) -> BacktestResponse:
        params = parameters or {}
        strategy = strategy_cls(**params)
        result = strategy.backtest(price_history, initial_capital=initial_capital)
        metrics = self._compute_metrics(result.pnl)
        response = BacktestResponse(pnl=result.pnl, metrics=metrics, parameters=result.parameters)
        self._persist({
            "type": "backtest",
            "strategy": strategy.name,
            "parameters": result.parameters,
            "metrics": metrics,
        })
        return response

    def run_parameter_sweep(
        self,
        strategy_cls: Type[Strategy],
        price_history: Sequence[float],
        param_grid: Dict[str, Iterable[float]],
        initial_capital: float = 0.0,
    ):
        summary = self.backtester.run_strategy(strategy_cls, price_history, param_grid, initial_capital)
        for record in summary.records:
            metrics = self._compute_metrics(record.pnl)
            self._persist({
                "type": "parameter_sweep",
                "strategy": record.strategy_name,
                "parameters": record.parameters,
                "metrics": metrics,
            })
        return summary

    def run_statistical_arbitrage(self, pair_series: PairSeries, param_grid: Dict[str, Iterable[float]]):
        summary = self.backtester.run_stat_arb(pair_series, param_grid)
        for record in summary.records:
            metrics = self._compute_metrics(record.pnl)
            self._persist({
                "type": "stat_arb",
                "strategy": record.strategy_name,
                "parameters": record.parameters,
                "metrics": metrics,
            })
        return summary

    def optimize_portfolio(
        self,
        expected_returns: Sequence[float],
        covariance: Sequence[Sequence[float]],
        target_return: Optional[float] = None,
        allow_short: bool = True,
    ) -> OptimizationResult:
        result = self.optimizer.optimize(expected_returns, covariance, target_return, allow_short)
        self._persist({
            "type": "optimization",
            "weights": result.weights,
            "status": result.status,
            "target_return": target_return,
        })
        return result

    def price_option(self, params: BlackScholesParameters) -> float:
        price = self.pricing.price(params)
        self._persist({
            "type": "pricing",
            "parameters": params.__dict__,
            "price": price,
        })
        return price

    def _compute_metrics(self, pnl: Sequence[float]) -> Dict[str, float]:
        returns = compute_returns(pnl)
        return {
            "sharpe": sharpe_ratio(returns),
            "max_drawdown": max_drawdown(pnl),
            "volatility": volatility(returns),
            "value_at_risk": value_at_risk(returns),
            "conditional_value_at_risk": conditional_value_at_risk(returns),
        }

    def _persist(self, payload: Dict[str, object]) -> None:
        if self.store is None:
            return
        self.store.log_result(payload)
