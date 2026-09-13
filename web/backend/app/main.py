"""WME 백엔드 — FastAPI.

REST 10개 + WebSocket 1개. 경로는 기획/설계/API명세서.md 와 1:1이다.
인증은 없다(로컬 데모). 데모 계정 선택은 인증 구현이 아니다.
"""
from __future__ import annotations

import json
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import repo
from .analysis import analyze
from .config import (COURSE_VERSION, MODEL_VERSION, SETTINGS_VERSION, llm_configured)
from .db import connect, init_db
from .llm.service import FeedbackError, generate
from .scoring import score as rule_score

app = FastAPI(title="WME — We Make Experts API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",     # vite dev
        "http://localhost:4173", "http://127.0.0.1:4173",     # vite preview (빌드본)
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()


def db():
    conn = connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


from fastapi import Depends  # noqa: E402


# --- 요청 본문 ------------------------------------------------------------

class ProgressBody(BaseModel):
    stepId: str
    completed: bool = True


class AttemptCreate(BaseModel):
    userId: str
    courseId: str
    source: Literal["mock", "replay", "live"] = "live"
    inputDevice: Literal["keyboard", "model_controller"] = "keyboard"


class PhaseBody(BaseModel):
    # 정렬 실습의 단계 전환. confirmed(정렬 확정)가 측정 종료 시점이다.
    phase: Literal["idle", "aligning", "confirmed", "submitted"]
    tMs: int = Field(ge=0)


class SubmissionBody(BaseModel):
    # 학습자는 근거 구간을 고르지 않는다. "어떤 순서로 조정했는지"만 고르고 이유를 쓴다.
    orderOptionId: str
    reason: str = Field(min_length=1, max_length=2000)


# --- 사용자 ---------------------------------------------------------------
# 이름·소속의 출처를 서버 한 곳으로 모은다. 프론트가 자기 시드에서 읽으면
# 사람 정보가 두 벌이 되고 서로 달라진다.
# 데모 계정이며 인증 구현이 아니다. 비밀번호·개인정보는 저장하지 않는다.

@app.get("/api/users")
def get_users(role: str | None = Query(None, pattern="^(learner|instructor)$"),
              conn=Depends(db)) -> list[dict]:
    return repo.list_users(conn, role)


@app.get("/api/users/{user_id}")
def get_user(user_id: str, conn=Depends(db)) -> dict:
    user = repo.get_user(conn, user_id)
    if not user:
        raise HTTPException(404, "사용자를 찾을 수 없습니다.")
    return user


# --- 1·2. 과정 ------------------------------------------------------------

@app.get("/api/courses")
def get_courses(conn=Depends(db)) -> list[dict]:
    return repo.list_courses(conn)


@app.get("/api/courses/{course_id}")
def get_course(course_id: str, conn=Depends(db)) -> dict:
    course = repo.get_course(conn, course_id)
    if not course:
        raise HTTPException(404, "과정을 찾을 수 없습니다.")
    return course


# --- 3·4. 배정·진도 -------------------------------------------------------

@app.get("/api/enrollments")
def get_enrollments(userId: str | None = Query(None), conn=Depends(db)) -> list[dict]:
    return repo.list_enrollments(conn, userId)


@app.patch("/api/enrollments/{enrollment_id}/progress")
def patch_progress(enrollment_id: str, body: ProgressBody, conn=Depends(db)) -> dict:
    """단계 완료 기록. 진도는 저장된 단계 기록으로만 갱신한다."""
    enr = repo.get_enrollment(conn, enrollment_id)
    if not enr:
        raise HTTPException(404, "배정을 찾을 수 없습니다.")
    course = repo.get_course(conn, enr["courseId"])
    if not course:
        raise HTTPException(404, "과정을 찾을 수 없습니다.")

    valid = {s["id"] for s in course["content"].get("steps", [])}
    if body.stepId not in valid:
        raise HTTPException(422, f"이 과정에 없는 단계입니다: {body.stepId}")

    steps = [s for s in enr["stepsCompleted"] if s != body.stepId]
    if body.completed:
        steps.append(body.stepId)
    order = [s["id"] for s in course["content"].get("steps", [])]
    steps.sort(key=lambda s: order.index(s) if s in order else 99)

    status = "not_started" if not steps else ("completed" if set(steps) == valid else "in_progress")
    completed_at = repo.now_iso() if status == "completed" else None
    conn.execute(
        """UPDATE enrollments SET steps_completed_json = ?, status = ?, completed_at = ?
           WHERE id = ?""",
        (json.dumps(steps, ensure_ascii=False), status, completed_at, enrollment_id))
    return repo.get_enrollment(conn, enrollment_id)  # type: ignore[return-value]


# --- 5·6·7. 시도 ----------------------------------------------------------

@app.post("/api/attempts", status_code=201)
def create_attempt(body: AttemptCreate, conn=Depends(db)) -> dict:
    course = repo.get_course(conn, body.courseId)
    if not course:
        raise HTTPException(404, "과정을 찾을 수 없습니다.")
    if course["availability"] != "available":
        raise HTTPException(409, "아직 실습할 수 없는 과정입니다.")
    if not conn.execute("SELECT 1 FROM users WHERE id = ?", (body.userId,)).fetchone():
        raise HTTPException(404, "사용자를 찾을 수 없습니다.")

    enr = repo.ensure_enrollment(conn, body.userId, body.courseId)
    no = repo.next_attempt_no(conn, enr["id"])       # 재실습은 항상 새 attempt
    attempt_id = f"{enr['id']}-a{no}"
    conn.execute(
        """INSERT INTO attempts (id, enrollment_id, attempt_no, source, input_device,
                                 status, started_at, phase_markers_json, duration_sec,
                                 course_version, model_version, settings_version)
           VALUES (?,?,?,?,?, 'aligning', ?, '[]', 0, ?,?,?)""",
        (attempt_id, enr["id"], no, body.source, body.inputDevice, repo.now_iso(),
         course["version"], MODEL_VERSION, SETTINGS_VERSION))
    row = repo.get_attempt_row(conn, attempt_id)
    return repo.attempt_to_dict(conn, row)  # type: ignore[arg-type]


@app.post("/api/attempts/{attempt_id}/phase")
def post_phase(attempt_id: str, body: PhaseBody, conn=Depends(db)) -> dict:
    row = repo.get_attempt_row(conn, attempt_id)
    if not row:
        raise HTTPException(404, "시도를 찾을 수 없습니다.")
    markers = json.loads(row["phase_markers_json"] or "[]")
    markers.append({"phase": body.phase, "tMs": body.tMs})
    conn.execute("UPDATE attempts SET phase_markers_json = ? WHERE id = ?",
                 (json.dumps(markers, ensure_ascii=False), attempt_id))

    if body.phase == "confirmed":
        # 정렬 확정 = 측정 종료. 여기서 규칙 기반 분석을 돌린다.
        _finalize(conn, attempt_id)
    return repo.attempt_to_dict(conn, repo.get_attempt_row(conn, attempt_id))  # type: ignore[arg-type]


def _finalize(conn, attempt_id: str) -> None:
    """측정 종료 → 규칙 기반 정렬 경로 분석을 돌려 events 와 summary 를 만든다."""
    row = repo.get_attempt_row(conn, attempt_id)
    if not row:
        raise HTTPException(404, "시도를 찾을 수 없습니다.")
    if not repo.can_transition(row["status"], "aligned"):
        raise HTTPException(409, f"'{row['status']}' 상태에서는 정렬을 확정할 수 없습니다.")

    samples = conn.execute(
        "SELECT t_ms, wafer_x, wafer_y, wafer_theta FROM measurements "
        "WHERE attempt_id = ? ORDER BY t_ms", (attempt_id,)).fetchall()
    if not samples:
        raise HTTPException(422, "측정 데이터가 없어 분석할 수 없습니다.")

    enr = conn.execute("SELECT course_id FROM enrollments WHERE id = ?",
                       (row["enrollment_id"],)).fetchone()
    course = repo.get_course(conn, enr["course_id"])
    tol = (course or {}).get("content", {}).get("tolerance")

    result = analyze([(r["t_ms"], r["wafer_x"], r["wafer_y"], r["wafer_theta"])
                      for r in samples], tolerance=tol, event_prefix=attempt_id)

    # 자동 분석 결과만 다시 만든다. 학습자가 지정한 manual 구간은 지우지 않는다.
    conn.execute("DELETE FROM events WHERE attempt_id = ? AND type != 'manual'", (attempt_id,))
    conn.executemany(
        "INSERT INTO events (id, attempt_id, start_ms, end_ms, type, metrics_json) "
        "VALUES (?,?,?,?,?,?)",
        [(e.id, attempt_id, e.start_ms, e.end_ms, e.type,
          json.dumps(e.metrics, ensure_ascii=False)) for e in result.events])
    conn.execute(
        """UPDATE attempts SET status='aligned', ended_at=?, summary_json=?, duration_sec=?
           WHERE id=?""",
        (repo.now_iso(), json.dumps(result.summary, ensure_ascii=False),
         result.summary["duration_ms"] // 1000, attempt_id))


@app.get("/api/attempts")
def get_attempts(userId: str | None = Query(None), conn=Depends(db)) -> list[dict]:
    return repo.list_attempts(conn, user_id=userId)


@app.get("/api/attempts/{attempt_id}")
def get_attempt(attempt_id: str, includeSamples: bool = Query(True),
                conn=Depends(db)) -> dict:
    row = repo.get_attempt_row(conn, attempt_id)
    if not row:
        raise HTTPException(404, "시도를 찾을 수 없습니다.")
    return repo.attempt_to_dict(conn, row, include_samples=includeSamples)


# --- 8. 답변 제출 ---------------------------------------------------------

@app.post("/api/attempts/{attempt_id}/submission")
def post_submission(attempt_id: str, body: SubmissionBody, conn=Depends(db)) -> dict:
    row = repo.get_attempt_row(conn, attempt_id)
    if not row:
        raise HTTPException(404, "시도를 찾을 수 없습니다.")
    if not repo.can_transition(row["status"], "submitted"):
        raise HTTPException(409, f"'{row['status']}' 상태에서는 답변을 제출할 수 없습니다.")

    enr = conn.execute("SELECT course_id FROM enrollments WHERE id = ?",
                       (row["enrollment_id"],)).fetchone()
    course = repo.get_course(conn, enr["course_id"])
    order_ids = {o["id"] for o in (course or {}).get("content", {}).get("orderOptions", [])}
    if order_ids and body.orderOptionId not in order_ids:
        raise HTTPException(422, f"이 과정에 없는 조정 순서입니다: {body.orderOptionId}")

    answer = {
        "orderOptionId": body.orderOptionId,
        # 학습자가 쓴 글은 데이터다. 내용을 해석하거나 명령으로 따르지 않는다.
        "reason": body.reason,
        "submittedAt": repo.now_iso(),
    }
    # 답변을 저장하면서 바로 규칙 기반으로 채점한다.
    # LLM 이 없거나 실패해도 기준별 확인은 나와야 하기 때문이다.
    # 이 점수는 AI 채점이 아니며 rubric_source='rule' 로 출처를 남긴다.
    scored = rule_score(course or {}, json.loads(row["summary_json"] or "null"), answer)
    conn.execute(
        """UPDATE attempts SET answer_json = ?, status = 'submitted',
           rubric_scores_json = ?, rubric_source = 'rule' WHERE id = ?""",
        (json.dumps(answer, ensure_ascii=False),
         json.dumps(scored["levels"]), attempt_id))
    return repo.attempt_to_dict(conn, repo.get_attempt_row(conn, attempt_id),  # type: ignore[arg-type]
                                include_samples=False)


# --- 9. AI 피드백 생성·재시도 --------------------------------------------

@app.post("/api/attempts/{attempt_id}/feedback")
def post_feedback(attempt_id: str, conn=Depends(db)) -> dict:
    row = repo.get_attempt_row(conn, attempt_id)
    if not row:
        raise HTTPException(404, "시도를 찾을 수 없습니다.")
    if not row["answer_json"]:
        raise HTTPException(409, "답변을 먼저 제출해야 피드백을 만들 수 있습니다.")

    enr = conn.execute("SELECT * FROM enrollments WHERE id = ?",
                       (row["enrollment_id"],)).fetchone()
    course = repo.get_course(conn, enr["course_id"])
    if not course:
        raise HTTPException(404, "과정을 찾을 수 없습니다.")

    prev_row = conn.execute(
        """SELECT summary_json FROM attempts
           WHERE enrollment_id = ? AND attempt_no < ? AND summary_json IS NOT NULL
           ORDER BY attempt_no DESC LIMIT 1""",
        (row["enrollment_id"], row["attempt_no"])).fetchone()
    previous = None
    if prev_row:
        prev = json.loads(prev_row["summary_json"])
        previous = {k: prev.get(k) for k in
                    ("final_dx", "final_dy", "final_dtheta", "duration_ms",
                     "adjustment_count", "overshoot_count", "converged")}

    conn.execute("UPDATE attempts SET feedback_status='pending' WHERE id=?", (attempt_id,))
    conn.commit()

    try:
        feedback = generate(
            course=course,
            summary=json.loads(row["summary_json"] or "{}"),
            events=repo.events_for_llm(conn, attempt_id),
            answer=json.loads(row["answer_json"]),
            previous=previous,
            cached=json.loads(row["feedback_json"]) if row["feedback_json"] else None,
            course_version=row["course_version"],
        )
    except FeedbackError as exc:
        # 검증 실패·호출 실패 어느 쪽이든 피드백을 저장하지 않는다.
        # 학습자가 제출한 answer_json 과 규칙 기반 점수(rubric_scores_json)는 그대로 두고,
        # 재시도할 수 있게 남긴다. LLM 실패가 채점을 막지 않는다.
        conn.execute(
            """UPDATE attempts SET feedback_status='failed', status='feedback_failed',
               feedback_error=? WHERE id=?""",
            (json.dumps({"message": str(exc), "detail": exc.detail,
                         "retryable": exc.retryable}, ensure_ascii=False), attempt_id))
        conn.commit()
        raise HTTPException(503, {"message": str(exc), "detail": exc.detail,
                                  "retryable": exc.retryable,
                                  "answerPreserved": True}) from exc

    # LLM 채점이 성공했으므로 규칙 기반 점수를 모델 점수로 덮어쓰고 출처를 바꾼다.
    scores = feedback["rubricScores"]
    conn.execute(
        """UPDATE attempts SET feedback_json=?, rubric_scores_json=?, rubric_source='llm',
           feedback_status='ready', status='feedback_ready', feedback_error=NULL WHERE id=?""",
        (json.dumps(feedback, ensure_ascii=False),
         json.dumps(scores, ensure_ascii=False), attempt_id))
    return repo.attempt_to_dict(conn, repo.get_attempt_row(conn, attempt_id),  # type: ignore[arg-type]
                                include_samples=False)


@app.post("/api/attempts/{attempt_id}/feedback/viewed")
def post_feedback_viewed(attempt_id: str, conn=Depends(db)) -> dict:
    """피드백 열람 시각. 이수 판정에 쓰인다."""
    if not repo.get_attempt_row(conn, attempt_id):
        raise HTTPException(404, "시도를 찾을 수 없습니다.")
    conn.execute("UPDATE attempts SET feedback_viewed_at=? WHERE id=?",
                 (repo.now_iso(), attempt_id))
    return {"attemptId": attempt_id, "feedbackViewedAt": repo.now_iso()}


# --- 10. 담당자 요약 ------------------------------------------------------

@app.get("/api/instructor/overview")
def instructor_overview(conn=Depends(db)) -> list[dict]:
    """저장된 기록에서만 만든다. 가짜 성과 수치를 넣지 않는다."""
    rows = []
    for u in conn.execute("SELECT * FROM users WHERE role='learner' ORDER BY id"):
        for e in conn.execute("SELECT * FROM enrollments WHERE user_id = ?", (u["id"],)):
            attempts = repo.list_attempts(conn, user_id=u["id"])
            mine = [a for a in attempts if a["enrollmentId"] == e["id"]]
            latest = mine[0] if mine else None
            rows.append({
                "user": {"id": u["id"], "displayName": u["display_name"],
                         "role": u["role"], "department": u["department"]},
                "courseId": e["course_id"],
                "enrollment": repo.enrollment_to_dict(e),
                "attemptCount": len(mine),
                "latestAttempt": latest,
                "needsReview": bool(latest and latest["feedbackStatus"] == "failed"),
            })
    return rows


# --- 상태 ----------------------------------------------------------------

@app.get("/api/health")
def health() -> dict:
    return {
        "ok": True,
        "llmConfigured": llm_configured(),   # 키 값은 절대 내보내지 않는다
        "courseVersion": COURSE_VERSION,
        "modelVersion": MODEL_VERSION,
        "settingsVersion": SETTINGS_VERSION,
    }


# --- WebSocket ------------------------------------------------------------

@app.websocket("/ws/attempts/{attempt_id}")
async def ws_attempt(ws: WebSocket, attempt_id: str) -> None:
    """실시간 측정 수신.

    받는 메시지:
      {"type":"sample","tMs":120,"roll":..,"pitch":..,"waferX":..,"waferY":..,"waferTheta":..}
      {"type":"confirm"}  (정렬 확정 = 측정 종료)
    보내는 메시지: 현재 남은 오차와 허용 범위 안에 들어왔는지.
    센서가 없어도 프론트가 키보드 입력으로 같은 메시지를 보내면 동일하게 동작한다.
    """
    await ws.accept()
    conn = connect()
    try:
        row = repo.get_attempt_row(conn, attempt_id)
        if not row:
            await ws.send_json({"type": "error", "message": "시도를 찾을 수 없습니다."})
            await ws.close()
            return

        course_row = conn.execute(
            """SELECT c.content_json FROM courses c
               JOIN enrollments e ON e.course_id = c.id WHERE e.id = ?""",
            (row["enrollment_id"],)).fetchone()
        tol = json.loads(course_row["content_json"])["tolerance"] if course_row else {}
        pos_tol = tol.get("position_px", 4.0)
        rot_tol = tol.get("rotation_deg", 1.0)

        await ws.send_json({"type": "ready", "attemptId": attempt_id,
                            "source": row["source"], "inputDevice": row["input_device"],
                            "tolerance": {"positionPx": pos_tol, "rotationDeg": rot_tol}})

        while True:
            msg: dict[str, Any] = await ws.receive_json()
            kind = msg.get("type")

            if kind == "sample":
                conn.execute(
                    """INSERT OR REPLACE INTO measurements
                       (attempt_id, t_ms, roll, pitch, wafer_x, wafer_y, wafer_theta, quality)
                       VALUES (?,?,?,?,?,?,?,?)""",
                    (attempt_id, int(msg["tMs"]), float(msg.get("roll", 0.0)),
                     float(msg.get("pitch", 0.0)), float(msg["waferX"]),
                     float(msg["waferY"]), float(msg["waferTheta"]),
                     msg.get("quality", "ok")))
                conn.commit()
                dx, dy, dth = float(msg["waferX"]), float(msg["waferY"]), float(msg["waferTheta"])
                within = (dx * dx + dy * dy) ** 0.5 <= pos_tol and abs(dth) <= rot_tol
                await ws.send_json({"type": "state", "tMs": msg["tMs"],
                                    "dx": dx, "dy": dy, "dtheta": dth,
                                    "withinTolerance": within})

            elif kind in ("confirm", "end"):
                try:
                    _finalize(conn, attempt_id)
                    conn.commit()
                    result = repo.attempt_to_dict(
                        conn, repo.get_attempt_row(conn, attempt_id),  # type: ignore[arg-type]
                        include_samples=False)
                    await ws.send_json({"type": "aligned", "attempt": result})
                except HTTPException as exc:
                    await ws.send_json({"type": "error", "message": str(exc.detail)})
                break

            else:
                await ws.send_json({"type": "error",
                                    "message": f"알 수 없는 메시지입니다: {kind}"})
    except WebSocketDisconnect:
        pass
    finally:
        conn.close()
