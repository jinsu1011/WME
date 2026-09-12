"""시드 데이터 삽입 — 과정 1개 + 데모 사용자.

실행:  python -m app.seed          (기존 시드 행을 지우고 다시 넣는다)
       python -m app.seed --keep   (없을 때만 넣는다)

데모 계정이며 인증 구현이 아니다. 비밀번호·개인정보를 저장하지 않는다.
실습 시도 2건은 합성 데이터(source='mock')이며 실측이 아니다.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone

from .analysis import analyze
from .config import COURSE_VERSION, DB_PATH, MODEL_VERSION, SETTINGS_VERSION
from .course_data import COURSE, COURSE_ID
from .db import cursor, init_db
from .trajectory import clean_run, overshoot_run

KST = timezone(timedelta(hours=9))

USERS = [
    {"id": "u-1", "display_name": "박지훈", "role": "learner",
     "department": "장비기술1팀 · 신입"},
    {"id": "u-instructor", "display_name": "최민정", "role": "instructor",
     "department": "기술교육센터 · 교육 담당"},
]

ENROLLMENT_ID = "en-1"


def _iso(dt: datetime) -> str:
    return dt.isoformat(timespec="seconds")


def _insert_attempt(conn, *, attempt_id: str, attempt_no: int, rows: list[dict],
                    started: datetime, input_device: str, answer: dict | None,
                    steps_note: str) -> dict:
    """궤적을 넣고, 규칙 기반 분석 결과를 events + summary_json 으로 저장한다."""
    result = analyze(
        [(r["t_ms"], r["wafer_x"], r["wafer_y"], r["wafer_theta"]) for r in rows],
        tolerance=COURSE["content"]["tolerance"],
        event_prefix=attempt_id,
    )
    duration_ms = result.summary["duration_ms"]
    ended = started + timedelta(milliseconds=duration_ms)
    status = "submitted" if answer else "measured"

    conn.execute(
        """INSERT INTO attempts
           (id, enrollment_id, attempt_no, source, input_device, status,
            started_at, ended_at, phase_markers_json, summary_json, answer_json,
            feedback_json, feedback_status, feedback_error, feedback_viewed_at,
            rubric_scores_json, duration_sec, course_version, model_version, settings_version)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,NULL,'none',NULL,NULL,NULL,?,?,?,?)""",
        (attempt_id, ENROLLMENT_ID, attempt_no, "mock", input_device, status,
         _iso(started), _iso(ended),
         json.dumps([{"phase": "idle", "tMs": 0},
                     {"phase": "moving", "tMs": rows[0]["t_ms"]},
                     {"phase": "ended", "tMs": rows[-1]["t_ms"]}], ensure_ascii=False),
         json.dumps(result.summary, ensure_ascii=False),
         json.dumps(answer, ensure_ascii=False) if answer else None,
         duration_ms // 1000, COURSE_VERSION, MODEL_VERSION, SETTINGS_VERSION),
    )

    conn.executemany(
        """INSERT INTO measurements
           (attempt_id, t_ms, roll, pitch, wafer_x, wafer_y, wafer_theta, quality)
           VALUES (?,?,?,?,?,?,?,?)""",
        [(attempt_id, r["t_ms"], r["roll"], r["pitch"],
          r["wafer_x"], r["wafer_y"], r["wafer_theta"], r["quality"]) for r in rows],
    )

    conn.executemany(
        """INSERT INTO events (id, attempt_id, start_ms, end_ms, type, metrics_json)
           VALUES (?,?,?,?,?,?)""",
        [(e.id, attempt_id, e.start_ms, e.end_ms, e.type,
          json.dumps(e.metrics, ensure_ascii=False)) for e in result.events],
    )
    print(f"  {attempt_id} ({steps_note}): 샘플 {len(rows)}행, "
          f"이벤트 {len(result.events)}개, 보정 {result.summary['adjustment_count']}회, "
          f"과잉보정 {result.summary['overshoot_count']}회, "
          f"수렴 {result.summary['converged']}")
    return result.summary


def clear_seed(conn) -> None:
    """시드 행만 지운다. measurements/events 는 ON DELETE CASCADE 로 따라 지워진다."""
    conn.execute("DELETE FROM attempts WHERE enrollment_id = ?", (ENROLLMENT_ID,))
    conn.execute("DELETE FROM enrollments WHERE id = ?", (ENROLLMENT_ID,))
    conn.execute("DELETE FROM courses WHERE id = ?", (COURSE_ID,))
    conn.execute("DELETE FROM users WHERE id IN (?,?)", ("u-1", "u-instructor"))


def seed(keep: bool = False) -> None:
    init_db()
    with cursor() as conn:
        exists = conn.execute("SELECT 1 FROM courses WHERE id = ?", (COURSE_ID,)).fetchone()
        if exists and keep:
            print("이미 시드가 있습니다. --keep 이므로 그대로 둡니다.")
            return
        clear_seed(conn)

        conn.executemany(
            "INSERT INTO users (id, display_name, role, department) VALUES (?,?,?,?)",
            [(u["id"], u["display_name"], u["role"], u["department"]) for u in USERS],
        )
        conn.execute(
            """INSERT INTO courses (id, title, subtitle, description, availability,
                                    estimated_minutes, content_json, rubric_json, version)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (COURSE["id"], COURSE["title"], COURSE["subtitle"], COURSE["description"],
             COURSE["availability"], COURSE["estimated_minutes"],
             json.dumps(COURSE["content"], ensure_ascii=False),
             json.dumps(COURSE["rubric"], ensure_ascii=False), COURSE["version"]),
        )
        conn.execute(
            """INSERT INTO enrollments (id, user_id, course_id, status,
                                        steps_completed_json, completed_at)
               VALUES (?,?,?,?,?,NULL)""",
            (ENROLLMENT_ID, "u-1", COURSE_ID, "in_progress",
             json.dumps(["concept", "baseline", "practice", "judgement"], ensure_ascii=False)),
        )

        now = datetime.now(KST).replace(microsecond=0)
        print("실습 시도 삽입 (재실습은 새 attempt 이며 이전 기록을 덮어쓰지 않는다):")
        _insert_attempt(
            conn, attempt_id="at-1", attempt_no=1, rows=overshoot_run(),
            started=now - timedelta(days=2), input_device="keyboard",
            answer={
                "evidenceIds": ["at-1-ovr-1"],
                "checkItemId": "small-steps",
                "reason": "회전을 먼저 맞추려다 위치가 같이 틀어져서, 다음에는 X와 Y를 "
                          "먼저 잡고 회전을 마지막에 정리하겠습니다.",
                "submittedAt": _iso(now - timedelta(days=2) + timedelta(minutes=3)),
            },
            steps_note="1차 · 과잉 보정",
        )
        _insert_attempt(
            conn, attempt_id="at-2", attempt_no=2, rows=clean_run(),
            started=now - timedelta(hours=3), input_device="keyboard",
            answer={
                "evidenceIds": ["at-2-adj-1", "at-2-adj-4"],
                "checkItemId": "xy-first",
                "reason": "X를 먼저 맞추고 Y를 맞춘 뒤 마지막에 회전을 정리했습니다. "
                          "회전을 먼저 돌리면 위치가 함께 움직여서 두 번 일하게 되기 때문입니다.",
                "submittedAt": _iso(now - timedelta(hours=3) + timedelta(minutes=4)),
            },
            steps_note="2차 · 절차 준수",
        )

    print(f"\n시드 완료: {DB_PATH}")


if __name__ == "__main__":
    seed(keep="--keep" in sys.argv)
