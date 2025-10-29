"""Integration layer exposing the analytics engine via REST."""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, Optional

from .engine import QuantEngine
from .strategies import BlackScholesParameters, PairSeries


class RESTBridge:
    """Minimal REST bridge between the analytics engine and backend services."""

    def __init__(self, engine: QuantEngine, host: str = "127.0.0.1", port: int = 8100) -> None:
        self.engine = engine
        self.host = host
        self._server = ThreadingHTTPServer((host, port), self._handler_factory())
        self.port = self._server.server_address[1]
        self._thread: Optional[threading.Thread] = None

    def _handler_factory(self):
        engine = self.engine

        class Handler(BaseHTTPRequestHandler):
            def _send_json(self, payload: Dict[str, Any], status: int = 200) -> None:
                encoded = json.dumps(payload).encode("utf-8")
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(encoded)))
                self.end_headers()
                self.wfile.write(encoded)

            def _json_body(self) -> Dict[str, Any]:
                length = int(self.headers.get("Content-Length", "0"))
                data = self.rfile.read(length) if length else b"{}"
                try:
                    return json.loads(data.decode("utf-8"))
                except json.JSONDecodeError:
                    raise ValueError("invalid JSON payload")

            def do_POST(self) -> None:  # noqa: N802 (http server API)
                try:
                    body = self._json_body()
                    if self.path == "/backtest":
                        strategy_name = body["strategy"]
                        strategy_cls = engine.strategy_registry[strategy_name]
                        response = engine.run_backtest(
                            strategy_cls,
                            body["prices"],
                            body.get("parameters"),
                            body.get("initial_capital", 0.0),
                        )
                        payload = {
                            "pnl": list(response.pnl),
                            "metrics": response.metrics,
                            "parameters": response.parameters,
                        }
                        self._send_json(payload)
                        return
                    if self.path == "/parameter-sweep":
                        strategy_name = body["strategy"]
                        strategy_cls = engine.strategy_registry[strategy_name]
                        summary = engine.run_parameter_sweep(
                            strategy_cls,
                            body["prices"],
                            body["param_grid"],
                            body.get("initial_capital", 0.0),
                        )
                        payload = [
                            {
                                "parameters": record.parameters,
                                "pnl": record.pnl,
                            }
                            for record in summary.records
                        ]
                        self._send_json({"results": payload})
                        return
                    if self.path == "/stat-arb":
                        strategy_name = body.get("strategy", "statistical_arbitrage")
                        strategy_cls = engine.pair_strategy_registry[strategy_name]
                        summary = engine.run_statistical_arbitrage(
                            PairSeries(body["asset_a"], body["asset_b"]),
                            body["param_grid"],
                        )
                        payload = [
                            {
                                "parameters": record.parameters,
                                "pnl": record.pnl,
                            }
                            for record in summary.records
                        ]
                        self._send_json({"results": payload})
                        return
                    if self.path == "/optimize":
                        result = engine.optimize_portfolio(
                            body["expected_returns"],
                            body["covariance"],
                            body.get("target_return"),
                            body.get("allow_short", True),
                        )
                        self._send_json({"weights": result.weights, "status": result.status})
                        return
                    if self.path == "/price":
                        params = BlackScholesParameters(**body)
                        price = engine.price_option(params)
                        self._send_json({"price": price})
                        return
                    self._send_json({"error": "not found"}, status=404)
                except Exception as error:  # pragma: no cover - network errors
                    self._send_json({"error": str(error)}, status=400)

            def log_message(self, format: str, *args: Any) -> None:  # noqa: A003 - inherited signature
                return

        return Handler

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._server.shutdown()
        if self._thread:
            self._thread.join(timeout=1)
            self._thread = None
