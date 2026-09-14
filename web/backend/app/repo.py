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
    "aligning": {"aligned"},              # 정렬 중 → 정렬 확정
    "aligned": {"submitted"},             # 정렬 확정 → 답변 제출
    "submitted": {"feedback_ready", "feedback_failed"},
    "feedback_failed": {"feedback_ready", "feedback_failed"},
    "feedback_ready": {"submitted"},      # 답변을 고쳐 다시 제출하는 경우
}


def now_iso() -> str:
    return datetime.now(KST).replace(microsecond=0).isoformat()


def elapsed_ms(started_at: str | None) -> int:
    """시작 시각부터 지금까지의 경과 시간(ms). 측정이 없는 유형의 소요 시간에 쓴다."""
    if not started_at:
        return 0
    try:
        start = datetime.fromisoformat(started_at)
    except ValueError:
        return 0
    return max(0, int((datetime.now(KST) - start).total_seconds() * 1000))


def _j(value: str | None, default: Any = None) -> Any:
    return json.loads(value) if value else default


# DB 의 summary_json 은 6절이 정한 snake_case 이름으로 저장하고,
# 응답할 때만 프론트 AlignmentSummary 의 camelCase 로 바꾼다.
SUMMARY_KEY_MAP = {
    "final_dx": "finalDx",
    "final_dy": "finalDy",
    "final_dtheta": "finalDTheta",
    "duration_ms": "durationMs",
    "adjustment_count": "adjustmentCount",
    "overshoot_count": "overshootCount",
    "converged": "converged",
}


def summary_to_camel(summary: dict | None) -> dict | None:
    """저장된 summary 를 화면이 읽는 모양으로 바꾼다.

    정렬 실습 전용 키는 있을 때만 옮긴다. 측정이 없는 유형은 그 키가 없다.
    scoringMetrics 는 유형과 상관없이 항상 함께 보낸다(채점의 근거가 되는 값들이다).
    """
    if not summary:
        return None
    out: dict[str, Any] = {}
    for snake, camel in SUMMARY_KEY_MAP.items():
        if snake in summary:
            out[camel] = summary[snake]
    if "path_analysis" in summary:
        out["pathAnalysis"] = summary["path_analysis"]   # 규칙 기반 분석 결과(부가)
    if "scoring_metrics" in summary:
        out["scoringMetrics"] = summary["scoring_metrics"]
    return out


# --- users ---------------------------------------------------------------

def user_row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "displayName": row["display_name"],
        "role": row["role"],
        "department": row["department"],
    }


def list_users(conn, role: str | None = None) -> list[dict]:
    if role:
        rows = conn.execute("SELECT * FROM users WHERE role = ? ORDER BY id", (role,))
    else:
        rows = conn.execute("SELECT * FROM users ORDER BY role DESC, id")
    return [user_row_to_dict(r) for r in rows]


def get_user(conn, user_id: str) -> dict | None:
    r = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return user_row_to_dict(r) if r else None


# --- courses -------------------------------------------------------------

def course_row_to_dict(row: sqlite3.Row) -> dict:
    """프론트 Course 타입과 같은 평평한 구조로 돌려준다.

    DB 는 고정된 소규모 구조를 content_json 한 칸에 모아 두지만(DB설계.md 1절),
    화면은 course.objectives 처럼 바로 읽는다. 그 변환을 여기서 한다.
    """
    content = _j(row["content_json"], {})
    return {
        "id": row["id"],
        "title": row["title"],
        "subtitle": row["subtitle"],
        "description": row["description"],
        "availability": row["availability"],
        "exerciseType": row["exercise_type"],
        "estimatedMinutes": row["estimated_minutes"],
        "objectives": content.get("objectives", []),
        "prerequisites": content.get("prerequisites", []),
        "steps": content.get("steps", []),
        "orderOptions": content.get("orderOptions", []),
        "rubric": _j(row["rubric_json"], []),
        "alignment": content.get("alignment"),
        # 기울기 → 이동 변환 계수. 계산은 프론트가 하고 계수는 과정 설정값이다.
        "control": content.get("control"),
        # 상황 판단 실습의 시나리오. 없는 유형은 None.
        "scenario": content.get("scenario"),
        "version": row["version"],
        # 서버 내부에서 쓰는 원본. 검증(orderOptions·tolerance)이 이걸 본다.
        "content": content,
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
        "summary": summary_to_camel(_j(row["summary_json"])),
        "answer": _j(row["answer_json"]),
        "feedback": _j(row["feedback_json"]),
        "feedbackStatus": row["feedback_status"],
        "feedbackError": row["feedback_error"],
        "feedbackViewedAt": row["feedback_viewed_at"],
        "rubricScores": _j(row["rubric_scores_json"]),
        # 점수를 누가 매겼는지. rule = 규칙 기반 임시 채점, llm = 모델 채점.
        "rubricSource": row["rubric_source"],
        "durationSec": row["duration_sec"],
        "courseVersion": row["course_version"],
        "modelVersion": row["model_version"],
        "settingsVersion": row["settings_version"],
        "events": list_events(conn, attempt_id),
    }
    if include_samples:
        data["samples"] = list_samples(conn, attempt_id)

    # 규칙 채점이면 그렇게 매긴 이유를 함께 준다. 저장하지 않고 매번 계산한다
    # (저장해두면 규칙이 바뀌었을 때 화면 설명과 실제 점수가 어긋난다).
    data["rubricReasons"] = []
    if row["rubric_source"] == "rule" and data["answer"]:
        course = get_course(conn, data["courseId"]) if data["courseId"] else None
        if course:
            data["rubricReasons"] = score_attempt(course, _j(row["summary_json"]))["reasons"]
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
    # 마스크 마크가 원점(0,0,0)이므로 웨이퍼 좌표가 그대로 "남은 오차"다.
    return [{"tMs": r["t_ms"], "roll": r["roll"], "pitch": r["pitch"],
             "waferX": r["wafer_x"], "waferY": r["wafer_y"], "waferTheta": r["wafer_theta"],
             "dx": r["wafer_x"], "dy": r["wafer_y"], "dTheta": r["wafer_theta"],
             "quality": r["quality"]} for r in rows]


def list_events(conn, attempt_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM events WHERE attempt_id = ? ORDER BY start_ms, id", (attempt_id,))
    out = []
    for r in rows:
        metrics = _j(r["metrics_json"], {})
        out.append({
            "id": r["id"], "attemptId": r["attempt_id"], "startMs": r["start_ms"],
            "endMs": r["end_ms"], "type": r["type"],
            # axis 는 metrics_json 안에 저장하고(컬럼 추가 없음) 응답에서 위로 올린다.
            "axis": metrics.get("axis", "xy"),
            "metrics": metrics,
        })
    return out


def event_ids(conn, attempt_id: str) -> list[str]:
    return [r["id"] for r in
            conn.execute("SELECT id FROM events WHERE attempt_id = ?", (attempt_id,))]


def events_for_llm(conn, attempt_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM events WHERE attempt_id = ? ORDER BY start_ms, id", (attempt_id,))
    return [{"id": r["id"], "start_ms": r["start_ms"], "end_ms": r["end_ms"],
             "type": r["type"], "metrics": _j(r["metrics_json"], {})} for r in rows]


def score_attempt(course: dict | None, summary: dict | None) -> dict:
    """과정에 적힌 채점 규칙을 그 시도의 scoring_metrics 에 적용한다.

    채점기에는 과정도 시도도 넘기지 않는다. 규칙과 지표만 넘긴다.
    """
    from .scoring import score
    rules = (course or {}).get("content", {}).get("scoring")
    rubric_len = len((course or {}).get("rubric", []))
    metrics = (summary or {}).get("scoring_metrics")
    return score(rules, metrics, rubric_len)


def can_transition(current: str, target: str) -> bool:
    if current == target:
        return True
    return target in ALLOWED_TRANSITIONS.get(current, set())
