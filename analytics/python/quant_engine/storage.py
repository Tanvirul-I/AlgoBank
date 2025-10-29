"""Persistence helpers for analytics results."""

from __future__ import annotations

import json
import sqlite3
import threading
import time
from dataclasses import dataclass
from typing import Dict, Optional

try:  # pragma: no cover - optional dependency
    import psycopg
except Exception:  # pragma: no cover - optional dependency
    psycopg = None


@dataclass
class ResultRecord:
    table: str
    payload: Dict[str, object]
    timestamp: float


class ResultStore:
    """Stores analytics results in PostgreSQL (or SQLite for testing)."""

    def __init__(self, dsn: str, default_table: str = "quant_results") -> None:
        self.dsn = dsn
        self.default_table = default_table
        self._lock = threading.Lock()
        if dsn.startswith("sqlite://"):
            path = dsn[len("sqlite://") :]
            self._backend = "sqlite"
            self._connection = sqlite3.connect(path, check_same_thread=False)
            self._ensure_sqlite_table(default_table)
        else:
            if psycopg is None:
                raise RuntimeError("psycopg is required for PostgreSQL persistence")
            self._backend = "postgres"
            self._connection = psycopg.connect(dsn)  # type: ignore[assignment]
            self._ensure_postgres_table(default_table)

    def log_result(self, payload: Dict[str, object], table: Optional[str] = None) -> ResultRecord:
        table_name = table or self.default_table
        timestamp = time.time()
        record = ResultRecord(table=table_name, payload=payload, timestamp=timestamp)
        if self._backend == "sqlite":
            self._ensure_sqlite_table(table_name)
            with self._lock:
                cursor = self._connection.cursor()
                cursor.execute(
                    "INSERT INTO {table} (timestamp, payload) VALUES (?, ?)".format(table=table_name),
                    (timestamp, json.dumps(payload)),
                )
                self._connection.commit()
        else:
            with self._lock:
                with self._connection.cursor() as cursor:  # type: ignore[call-arg]
                    cursor.execute(
                        f"CREATE TABLE IF NOT EXISTS {table_name} (timestamp DOUBLE PRECISION, payload JSONB)",
                    )
                    cursor.execute(
                        f"INSERT INTO {table_name} (timestamp, payload) VALUES (%s, %s)",
                        (timestamp, json.dumps(payload)),
                    )
                self._connection.commit()
        return record

    def _ensure_sqlite_table(self, table: str) -> None:
        cursor = self._connection.cursor()
        cursor.execute(
            "CREATE TABLE IF NOT EXISTS {table} (timestamp REAL, payload TEXT)".format(table=table)
        )
        self._connection.commit()

    def _ensure_postgres_table(self, table: str) -> None:
        if psycopg is None:  # pragma: no cover - optional dependency
            return
        with self._connection.cursor() as cursor:  # type: ignore[call-arg]
            cursor.execute(
                f"CREATE TABLE IF NOT EXISTS {table} (timestamp DOUBLE PRECISION, payload JSONB)"
            )
        self._connection.commit()
