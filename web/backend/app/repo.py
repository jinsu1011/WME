"""DB 읽기·쓰기와 응답 직렬화.

응답 키는 프론트엔드 `src/types/index.ts` 의 camelCase 를 따른다.
다만 summary_json 안의 키는 실습과정_정렬.md 6절이 정한 이름(final_dx 등)을 그대로 쓴다.
"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Any

KST = timezone(timedelta(hours=9))

# 상태 전환은 이 순서만 허용한다 (DB설계.md 6절 규칙 5).
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "measuring": {"measured"},
    "measured": {"submitted"},
    "submitted": {"feedback_ready", "feedback_failed"},
    "feedback_failed": {"feedback_ready", "feedback_failed"},
    "feedback_ready": {"submitted"},      # 답변을 고쳐 다시 제출하는 경우
}


def now_iso() -> str:
    return datetime.now(KST).replace(microsecond=0).isoformat()


def _j(value: str | None, default: Any = None) -> Any:
    return json.loads(value) if value else default


# --- courses -------------------------------------------------------------

def course_row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "subtitle": row["subtitle"],
        "description": row["description"],
        "availability": row["availability"],
        "estimatedMinutes": row["estimated_minutes"],
        "content": _j(row["content_json"], {}),
        "rubric": _j(row["rubric_json"], []),
        "version": row["version"],
    }


def list_courses(conn) -> list[dict]:
    return [course_row_to_dict(r) for r in conn.execute("SELECT * FROM courses ORDER BY id")]


def get_course(conn, course_id: str) -> dict | None:
    r = conn.execute("SELECT * FROM courses WHERE id = ?", (course_id,)).fetchone()
    return course_row_to_dict(r) if r else None


# --- enrollments ---------------------------------------------------------

def enrollment_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "userId": row["user_id"],
        "courseId": row["course_id"],
        "status": row["status"],
        "stepsCompleted": _j(row["steps_completed_json"], []),
        "completedAt": row["completed_at"],
    }


def list_enrollments(conn, user_id: str | None = None) -> list[dict]:
    if user_id:
        rows = conn.execute("SELECT * FROM enrollments WHERE user_id = ?", (user_id,))
    else:
        rows = conn.execute("SELECT * FROM enrollments")
    return [enrollment_to_dict(r) for r in rows]


def get_enrollment(conn, enrollment_id: str) -> dict | None:
    r = conn.execute("SELECT * FROM enrollments WHERE id = ?", (enrollment_id,)).fetchone()
    return enrollment_to_dict(r) if r else None


def ensure_enrollment(conn, user_id: str, course_id: str) -> dict:
    r = conn.execute("SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?",
                     (user_id, course_id)).fetchone()
    if r:
        return enrollment_to_dict(r)
    new_id = f"en-{user_id}-{course_id}"
    conn.execute(
        """INSERT INTO enrollments (id, user_id, course_id, status, steps_completed_json)
           VALUES (?,?,?,'not_started','[]')""", (new_id, user_id, course_id))
    return get_enrollment(conn, new_id)  # type: ignore[return-value]


# --- attempts ------------------------------------------------------------

def attempt_to_dict(conn, row: sqlite3.Row, *, include_samples: bool = True) -> dict:
    attempt_id = row["id"]
    enr = conn.execute("SELECT * FROM enrollments WHERE id = ?",
                       (row["enrollment_id"],)).fetchone()
    data: dict[str, Any] = {
        "id": attempt_id,
        "enrollmentId": row["enrollment_id"],
        "userId": enr["user_id"] if enr else None,
        "courseId": enr["course_id"] if enr else None,
        "attemptNo": row["attempt_no"],
        "source": row["source"],
        "inputDevice": row["input_device"],
        "status": row["status"],
        "startedAt": row["started_at"],
        "endedAt": row["ended_at"],
        "phaseMarkers": _j(row["phase_markers_json"], []),
        "summary": _j(row["summary_json"]),
        "answer": _j(row["answer_json"]),
        "feedback": _j(row["feedback_json"]),
        "feedbackStatus": row["feedback_status"],
        "feedbackError": row["feedback_error"],
        "feedbackViewedAt": row["feedback_viewed_at"],
        "rubricScores": _j(row["rubric_scores_json"]),
        "durationSec": row["duration_sec"],
        "courseVersion": row["course_version"],
        "modelVersion": row["model_version"],
        "settingsVersion": row["settings_version"],
        "events": list_events(conn, attempt_id),
    }
    if include_samples:
        data["samples"] = list_samples(conn, attempt_id)
    return data


def get_attempt_row(conn, attempt_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM attempts WHERE id = ?", (attempt_id,)).fetchone()


def list_attempts(conn, *, user_id: str | None = None) -> list[dict]:
    sql = """SELECT a.* FROM attempts a JOIN enrollments e ON e.id = a.enrollment_id"""
    args: tuple = ()
    if user_id:
        sql += " WHERE e.user_id = ?"
        args = (user_id,)
    sql += " ORDER BY a.started_at DESC"
    return [attempt_to_dict(conn, r, include_samples=False) for r in conn.execute(sql, args)]


def next_attempt_no(conn, enrollment_id: str) -> int:
    r = conn.execute("SELECT MAX(attempt_no) m FROM attempts WHERE enrollment_id = ?",
                     (enrollment_id,)).fetchone()
    return (r["m"] or 0) + 1


def list_samples(conn, attempt_id: str) -> list[dict]:
    rows = conn.execute(
        """SELECT t_ms, roll, pitch, wafer_x, wafer_y, wafer_theta, quality
           FROM measurements WHERE attempt_id = ? ORDER BY t_ms""", (attempt_id,))
    return [{"tMs": r["t_ms"], "roll": r["roll"], "pitch": r["pitch"],
             "waferX": r["wafer_x"], "waferY": r["wafer_y"], "waferTheta": r["wafer_theta"],
             "quality": r["quality"]} for r in rows]


def list_events(conn, attempt_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM events WHERE attempt_id = ? ORDER BY start_ms, id", (attempt_id,))
    return [{"id": r["id"], "attemptId": r["attempt_id"], "startMs": r["start_ms"],
             "endMs": r["end_ms"], "type": r["type"],
             "metrics": _j(r["metrics_json"], {})} for r in rows]


def event_ids(conn, attempt_id: str) -> list[str]:
    return [r["id"] for r in
            conn.execute("SELECT id FROM events WHERE attempt_id = ?", (attempt_id,))]


def events_for_llm(conn, attempt_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM events WHERE attempt_id = ? ORDER BY start_ms, id", (attempt_id,))
    return [{"id": r["id"], "start_ms": r["start_ms"], "end_ms": r["end_ms"],
             "type": r["type"], "metrics": _j(r["metrics_json"], {})} for r in rows]


def can_transition(current: str, target: str) -> bool:
    if current == target:
        return True
    return target in ALLOWED_TRANSITIONS.get(current, set())
