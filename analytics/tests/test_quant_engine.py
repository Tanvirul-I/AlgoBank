import json
import sys
import unittest
from http.client import HTTPConnection
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from analytics.python.quant_engine import (
    MeanReversionStrategy,
    PairSeries,
    QuantEngine,
    ResultStore,
    StatisticalArbitrageStrategy,
    conditional_value_at_risk,
    compute_returns,
    max_drawdown,
    sharpe_ratio,
    value_at_risk,
    volatility,
)
from analytics.python.quant_engine.integration import RESTBridge
from analytics.python.quant_engine.optimization import MarkowitzOptimizer


class QuantEngineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.store = ResultStore("sqlite://:memory:")
        self.engine = QuantEngine(store=self.store)

    def test_mean_reversion_backtest_generates_metrics(self) -> None:
        prices = [100 + i * (-1) ** i for i in range(20)]
        response = self.engine.run_backtest(
            MeanReversionStrategy,
            prices,
            {"lookback": 3, "entry_z": 0.5, "exit_z": 0.1},
            initial_capital=1000.0,
        )
        self.assertEqual(len(response.pnl), len(prices))
        self.assertIn("sharpe", response.metrics)
        self.assertIn("max_drawdown", response.metrics)

    def test_statistical_arbitrage_signals(self) -> None:
        series = PairSeries(
            asset_a=[10 + 0.2 * i for i in range(50)],
            asset_b=[9.5 + 0.18 * i for i in range(50)],
        )
        strategy = StatisticalArbitrageStrategy(lookback=10, entry_z=1.5, exit_z=0.5)
        signals = strategy.generate_pair_signals(series)
        self.assertEqual(len(signals), len(series.asset_a))

    def test_markowitz_optimizer_fallback(self) -> None:
        optimizer = MarkowitzOptimizer()
        expected_returns = [0.05, 0.07, 0.02]
        covariance = [
            [0.1, 0.02, 0.04],
            [0.02, 0.08, 0.01],
            [0.04, 0.01, 0.07],
        ]
        result = optimizer.optimize(expected_returns, covariance, target_return=0.05, allow_short=False)
        self.assertAlmostEqual(sum(result.weights), 1.0, places=4)
        self.assertTrue(all(weight >= 0 for weight in result.weights))

    def test_metrics_suite(self) -> None:
        prices = [100, 102, 101, 105, 107, 106]
        returns = compute_returns(prices)
        self.assertGreaterEqual(volatility(returns), 0)
        self.assertGreaterEqual(sharpe_ratio(returns), -10)
        self.assertGreaterEqual(max_drawdown(prices), 0)
        self.assertGreaterEqual(value_at_risk(returns, 0.9), 0)
        self.assertGreaterEqual(conditional_value_at_risk(returns, 0.9), 0)

    def test_rest_bridge_backtest_endpoint(self) -> None:
        bridge = RESTBridge(self.engine, port=0)
        bridge.start()
        try:
            connection = HTTPConnection("127.0.0.1", bridge.port)
            payload = json.dumps(
                {
                    "strategy": "mean_reversion",
                    "prices": [100 + i for i in range(10)],
                    "parameters": {"lookback": 3, "entry_z": 0.5, "exit_z": 0.1},
                    "initial_capital": 1000.0,
                }
            )
            connection.request("POST", "/backtest", body=payload, headers={"Content-Type": "application/json"})
            response = connection.getresponse()
            body = json.loads(response.read().decode("utf-8"))
            self.assertIn("metrics", body)
            self.assertEqual(len(body["pnl"]), 10)
        finally:
            bridge.stop()


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
