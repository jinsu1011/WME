"""SQLite 연결. 파일은 data/local/ 에 둔다."""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Iterator

from .config import DB_PATH, SCHEMA_PATH


def connect() -> sqlite3.Connection:
    """요청 하나마다 새 연결을 연다.

    check_same_thread=False 인 이유:
    FastAPI 는 의존성(db())과 엔드포인트 함수를 스레드풀에서 돌리는데, 이 둘이
    서로 다른 스레드가 될 수 있다. SQLite 는 기본적으로 "연결을 만든 스레드에서만
    써라"라고 막기 때문에, 동시 요청이 들어오면 그 검사에 걸려 500 이 났다.
    연결을 요청 사이에 공유하지 않고 하나씩 새로 열어 쓰므로 꺼도 안전하다.

    timeout: 다른 요청이 쓰는 중이면 5초까지 기다렸다가 재시도한다(즉시 실패 대신).
    """
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=5.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    # WAL: 쓰기 중에도 읽기가 막히지 않는다. 동시 요청에서 훨씬 덜 부딪힌다.
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


@contextmanager
def cursor() -> Iterator[sqlite3.Connection]:
    conn = connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


# 스키마에 나중에 추가된 컬럼. 이미 만들어진 DB 를 지우지 않고 따라가게 한다.
LATER_COLUMNS = [
    ("attempts", "rubric_source", "TEXT"),
]


def init_db() -> None:
    """schema.sql 을 그대로 실행한다. 이미 있으면 아무것도 하지 않는다(IF NOT EXISTS)."""
    sql = SCHEMA_PATH.read_text(encoding="utf-8")
    with cursor() as conn:
        conn.executescript(sql)
        for table, column, decl in LATER_COLUMNS:
            have = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
            if column not in have:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {decl}")
