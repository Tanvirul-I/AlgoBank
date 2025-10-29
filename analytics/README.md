# AlgoBank Analytics

This module will host quantitative research assets including:

-   Pricing libraries for options and structured products.
-   Portfolio optimization routines (Markowitz, CVaR, scenario analysis).
-   Backtesting pipelines for statistical arbitrage and mean reversion strategies.

## Quant Engine Package

The `analytics/python/quant_engine` package implements AlgoBank's quantitative
analytics stack. It includes:

-   Strategy templates (mean reversion, statistical arbitrage, Black-Scholes
    pricing).
-   Backtesting utilities with parameter sweeps and PnL tracking.
-   Risk metrics (Sharpe ratio, max drawdown, VaR/CVaR, volatility).
-   A Markowitz portfolio optimizer with optional cvxpy/PyTorch acceleration.
-   REST integration utilities for bridging to the backend services.
-   Persistence helpers to save results in PostgreSQL (or SQLite during tests).

Run the unit tests with:

```bash
python -m pytest analytics/tests
```

Install the optional dependencies (cvxpy for convex optimization, psycopg for
PostgreSQL persistence, and PyTorch for gradient methods) with:

```bash
pip install -r analytics/python/requirements.txt
```

The `analytics/notebooks/validation.ipynb` notebook demonstrates how to run a
synthetic backtest end-to-end.
