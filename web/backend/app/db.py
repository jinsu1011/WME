"""SQLite 연결. 파일은 data/local/ 에 둔다."""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Iterator

from .config import DB_PATH, SCHEMA_PATH


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def cursor() -> Iterator[sqlite3.Connection]:
    conn = connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    """schema.sql 을 그대로 실행한다. 이미 있으면 아무것도 하지 않는다(IF NOT EXISTS)."""
    sql = SCHEMA_PATH.read_text(encoding="utf-8")
    with cursor() as conn:
        conn.executescript(sql)
