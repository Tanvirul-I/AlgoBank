"""Quantitative analytics engine package."""

from .backtesting import Backtester, BacktestRecord, BacktestSummary
from .engine import BacktestResponse, QuantEngine
from .metrics import (
    conditional_value_at_risk,
    compute_returns,
    max_drawdown,
    sharpe_ratio,
    value_at_risk,
    volatility,
)
from .optimization import MarkowitzOptimizer, OptimizationResult, TorchGradientOptimizer
from .storage import ResultRecord, ResultStore
from .strategies import (
    BlackScholesParameters,
    BlackScholesPricingStrategy,
    MeanReversionStrategy,
    PairSeries,
    StatisticalArbitrageStrategy,
    Strategy,
    StrategyResult,
)

__all__ = [
    "Backtester",
    "BacktestRecord",
    "BacktestSummary",
    "BacktestResponse",
    "QuantEngine",
    "conditional_value_at_risk",
    "compute_returns",
    "max_drawdown",
    "sharpe_ratio",
    "value_at_risk",
    "volatility",
    "MarkowitzOptimizer",
    "OptimizationResult",
    "TorchGradientOptimizer",
    "ResultRecord",
    "ResultStore",
    "BlackScholesParameters",
    "BlackScholesPricingStrategy",
    "MeanReversionStrategy",
    "PairSeries",
    "StatisticalArbitrageStrategy",
    "Strategy",
    "StrategyResult",
]
