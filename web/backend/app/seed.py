"""시드 데이터 삽입 — 과정 카탈로그 + 데모 학습자 8명 + 담당자 1명.

실행:  python -m app.seed          (기존 시드를 지우고 다시 넣는다)
       python -m app.seed --keep   (없을 때만 넣는다)

사람·시도 구성은 프론트 `web/frontend/src/data/people.ts` 와 같게 맞춘다.
매니저 화면(반 전체 현황)이 실제 기록에서 계산되려면 사람 수와 루브릭 값이 같아야 한다.

**전부 시연용 가상 데이터다.** 실제 교육 기록도, 실제 직원 정보도 아니다.
측정 궤적은 합성이며 source='mock' 으로 저장한다. 피드백도 규칙 기반 샘플이라
generatedBy='mock' 이다. 실제 LLM 호출 결과가 아니다.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone

from .analysis import analyze
from .config import DB_PATH, MODEL_VERSION, SETTINGS_VERSION
from .course_data import CATALOG, COURSE, COURSE_ID
from .db import cursor, init_db
from .scoring import score as rule_score
from .trajectory import scenario

KST = timezone(timedelta(hours=9))

ALL_STEPS = ["concept", "marks", "align", "submit", "feedback"]

INSTRUCTOR = {"id": "u-instructor", "display_name": "최태원", "role": "instructor",
              "department": "기술교육센터 · 교육 담당"}

# people.ts 의 learnerSeeds 를 그대로 옮긴 것.
# steps = 완료한 단계 수, attempts = (며칠 전, 실습에 쓴 시간(초), 루브릭)
LEARNERS = [
    {"id": "u-1", "name": "김진수", "dept": "장비기술1팀 · 신입", "steps": 4, "basics": True,
     "attempts": [(12, 1580, [1, 0, 1, 1]), (5, 1240, [2, 1, 1, 2]), (1, 980, [2, 2, 1, 2])]},
    {"id": "u-2", "name": "한소영", "dept": "장비기술1팀 · 신입", "steps": 5, "basics": True,
     "attempts": [(18, 1720, [1, 1, 1, 1]), (9, 1130, [2, 2, 2, 2])]},
    {"id": "u-3", "name": "정우석", "dept": "장비기술2팀 · 전환배치", "steps": 5, "basics": True,
     "attempts": [(14, 1410, [2, 1, 2, 1])]},
    {"id": "u-4", "name": "김하늘", "dept": "장비기술2팀 · 신입", "steps": 3, "basics": True,
     "attempts": [(7, 1660, [1, 1, 0, 1]), (2, 1490, None)]},
    {"id": "u-5", "name": "오세진", "dept": "설비보전팀 · 전환배치", "steps": 5, "basics": True,
     "attempts": [(21, 1840, [1, 0, 1, 0]), (16, 1350, [1, 1, 1, 1]), (8, 1080, [2, 1, 2, 2])]},
    {"id": "u-6", "name": "윤가람", "dept": "설비보전팀 · 신입", "steps": 2, "basics": True,
     "attempts": []},
    {"id": "u-7", "name": "서동현", "dept": "장비기술1팀 · 전환배치", "steps": 4, "basics": False,
     "attempts": [(3, 1520, [1, 2, 1, 1])]},
    {"id": "u-8", "name": "문예린", "dept": "장비기술2팀 · 신입", "steps": 0, "basics": False,
     "attempts": []},
]

# 루브릭 2번(조정 순서) 값 → 학습자가 고른 조정 순서
ORDER_BY_SCORE = {2: "xy-then-theta", 1: "interleaved", 0: "theta-then-xy"}

# 루브릭 4번(설명·기록) 값 → 학습자가 쓴 이유의 자세함
REASONS = {
    2: {
        "xy-then-theta": "먼저 X와 Y로 두 마크를 겹친 뒤 마지막에 회전을 맞췄습니다. "
                         "회전을 먼저 돌리면 이미 맞춰 둔 위치가 함께 움직여서 "
                         "같은 작업을 두 번 하게 되기 때문입니다.",
        "interleaved": "위치와 회전을 번갈아 조금씩 좁혔습니다. 한 축을 크게 움직이면 "
                       "다른 축이 같이 흔들리는 게 보여서, 한 번에 조금씩만 움직이고 "
                       "중간에 마크를 다시 확인했습니다.",
        "theta-then-xy": "각도를 먼저 세우면 이후 위치 조정이 수월할 것 같아 회전부터 "
                         "맞췄습니다. 다만 회전 뒤 위치가 다시 틀어져서, 다음에는 "
                         "위치를 먼저 잡고 회전을 마지막에 정리해 보려고 합니다.",
    },
    1: {
        "xy-then-theta": "위치를 먼저 맞추고 회전을 나중에 조정했습니다.",
        "interleaved": "위치와 회전을 번갈아 가며 맞췄습니다.",
        "theta-then-xy": "회전을 먼저 맞추고 위치를 조정했습니다.",
    },
    0: {
        "xy-then-theta": "위치부터 맞췄습니다.",
        "interleaved": "번갈아 맞췄습니다.",
        "theta-then-xy": "회전부터 맞췄습니다.",
    },
}


def _iso(dt: datetime) -> str:
    return dt.isoformat(timespec="seconds")


def mock_feedback(summary: dict, events: list, rubric: list[int], when: datetime) -> dict:
    """규칙 기반 샘플 피드백. **LLM 호출 결과가 아니다.**

    화면이 이걸 실제 AI 피드백처럼 보여주면 안 되므로 generatedBy='mock' 으로 남긴다.
    """
    over = summary["overshoot_count"]
    adj = summary["adjustment_count"]
    order = summary["path_analysis"]["convergence"]["order"]

    good, improve, ref = [], [], []
    if summary["converged"]:
        good.append("두 마크를 과정에 설정된 허용 범위 안으로 맞췄습니다.")
    else:
        improve.append("최종 오차가 과정에 설정된 허용 범위 밖에서 끝났습니다.")
    if order == "position_first":
        good.append("위치를 먼저 맞추고 회전을 마지막에 정리했습니다.")
    elif order == "rotation_first":
        improve.append("회전을 먼저 맞춘 뒤 위치를 조정해서, 맞춰 둔 값이 다시 틀어졌습니다.")
    if over == 0:
        good.append(f"목표를 지나쳤다 되돌아온 구간 없이 {adj}번의 보정으로 마쳤습니다.")
    else:
        improve.append(f"목표를 지나쳤다 되돌아온 구간이 {over}번 있었습니다. "
                       "목표에 가까워지면 한 번에 움직이는 양을 줄여 보세요.")
        ref = [e["id"] for e in events if e["type"] == "overshoot"][:2]
    if rubric[3] <= 1:
        improve.append("왜 그 순서로 조정했는지 한두 문장 더 적으면 "
                       "다음 실습에서 스스로 비교하기 좋습니다.")

    return {
        "generatedBy": "mock",     # 규칙 기반 샘플. AI 미연결 상태다.
        "good": good or ["정렬을 끝까지 진행했습니다."],
        "improve": improve or ["지금 순서를 유지하면서 소요 시간을 줄여 보세요."],
        "eventIds": ref,
        "nextStep": "같은 과정을 한 번 더 하면서, 목표 근처에서는 움직이는 양을 절반으로 줄여 보세요.",
        "cannotJudge": [
            "실제 장비의 정렬 정밀도나 설비 상태는 이 기록으로 판단할 수 없습니다.",
            "허용 오차는 교육 과정 설정값입니다.",
        ],
        "generatedAt": _iso(when),
    }


def _insert_attempt(conn, *, attempt_id, enrollment_id, attempt_no, rubric,
                    days_ago, duration_sec, now, seed_no) -> None:
    rows = scenario(rubric, seed=seed_no)
    result = analyze([(r["t_ms"], r["wafer_x"], r["wafer_y"], r["wafer_theta"]) for r in rows],
                     tolerance=COURSE["content"]["tolerance"], event_prefix=attempt_id)
    started = now - timedelta(days=days_ago)
    # duration_sec 은 실습에 쓴 전체 시간(프론트 시드 값),
    # summary.duration_ms 는 정렬 자체에 걸린 시간이다. 서로 다른 값이다.
    ended = started + timedelta(seconds=duration_sec)

    if rubric is None:
        status, feedback_status = "aligned", "none"
        answer = feedback = rubric_scores = None
        viewed = None
    else:
        status, feedback_status = "feedback_ready", "ready"
        # people.ts 의 rubric 값은 "어떤 시도였는지"를 정하는 데만 쓴다
        # (궤적 모양, 고른 조정 순서, 이유의 자세함).
        option = ORDER_BY_SCORE[rubric[1]]
        answer = {
            "orderOptionId": option,
            "reason": REASONS[rubric[3]][option],
            "submittedAt": _iso(ended),
        }
        # 저장하는 점수는 그 궤적과 답변을 **채점기가 실제로 읽어 계산한 값**이다.
        # 손으로 적어 넣은 숫자가 아니므로 rubric_source='rule' 이 사실과 맞는다.
        scored = rule_score(COURSE, result.summary, answer)
        rubric_scores = scored["levels"]
        feedback = mock_feedback(result.summary, [
            {"id": e.id, "type": e.type} for e in result.events], rubric_scores,
            ended + timedelta(seconds=20))
        viewed = _iso(ended + timedelta(minutes=1))

    conn.execute(
        """INSERT INTO attempts
           (id, enrollment_id, attempt_no, source, input_device, status,
            started_at, ended_at, phase_markers_json, summary_json, answer_json,
            feedback_json, feedback_status, feedback_error, feedback_viewed_at,
            rubric_scores_json, rubric_source, duration_sec,
            course_version, model_version, settings_version)
           VALUES (?,?,?,'mock','keyboard',?,?,?,?,?,?,?,?,NULL,?,?,?,?,?,?,?)""",
        (attempt_id, enrollment_id, attempt_no, status, _iso(started), _iso(ended),
         json.dumps([{"phase": "idle", "tMs": 0},
                     {"phase": "aligning", "tMs": rows[0]["t_ms"]},
                     {"phase": "confirmed", "tMs": rows[-1]["t_ms"]}]
                    + ([{"phase": "submitted", "tMs": rows[-1]["t_ms"]}] if answer else []),
                    ensure_ascii=False),
         json.dumps(result.summary, ensure_ascii=False),
         json.dumps(answer, ensure_ascii=False) if answer else None,
         json.dumps(feedback, ensure_ascii=False) if feedback else None,
         feedback_status, viewed,
         json.dumps(rubric_scores) if rubric_scores else None,
         # 시연용 시드의 루브릭 값이다. 규칙 기반과 같은 성격(=AI 채점이 아님)이므로
         # 출처를 'rule' 로 남긴다.
         "rule" if rubric_scores else None,
         duration_sec, COURSE["version"], MODEL_VERSION, SETTINGS_VERSION))

    conn.executemany(
        """INSERT INTO measurements
           (attempt_id, t_ms, roll, pitch, wafer_x, wafer_y, wafer_theta, quality)
           VALUES (?,?,?,?,?,?,?,?)""",
        [(attempt_id, r["t_ms"], r["roll"], r["pitch"],
          r["wafer_x"], r["wafer_y"], r["wafer_theta"], r["quality"]) for r in rows])
    conn.executemany(
        "INSERT INTO events (id, attempt_id, start_ms, end_ms, type, metrics_json) VALUES (?,?,?,?,?,?)",
        [(e.id, attempt_id, e.start_ms, e.end_ms, e.type,
          json.dumps(e.metrics, ensure_ascii=False)) for e in result.events])
    out = dict(result.summary)
    out["scored"] = rubric_scores
    return out


def clear_seed(conn) -> None:
    conn.execute("DELETE FROM attempts")          # measurements/events 는 CASCADE 로 따라 지워짐
    conn.execute("DELETE FROM enrollments")
    conn.execute("DELETE FROM courses")
    conn.execute("DELETE FROM users")


def seed(keep: bool = False) -> None:
    init_db()
    with cursor() as conn:
        if conn.execute("SELECT 1 FROM courses WHERE id = ?", (COURSE_ID,)).fetchone() and keep:
            print("이미 시드가 있습니다. --keep 이므로 그대로 둡니다.")
            return
        clear_seed(conn)

        # 1) 사용자
        conn.execute("INSERT INTO users (id, display_name, role, department) VALUES (?,?,?,?)",
                     (INSTRUCTOR["id"], INSTRUCTOR["display_name"],
                      INSTRUCTOR["role"], INSTRUCTOR["department"]))
        conn.executemany("INSERT INTO users (id, display_name, role, department) VALUES (?,?,'learner',?)",
                         [(l["id"], l["name"], l["dept"]) for l in LEARNERS])

        # 2) 과정 카탈로그
        for c in CATALOG:
            conn.execute(
                """INSERT INTO courses (id, title, subtitle, description, availability,
                                        estimated_minutes, content_json, rubric_json, version)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (c["id"], c["title"], c["subtitle"], c["description"], c["availability"],
                 c["estimated_minutes"], json.dumps(c["content"], ensure_ascii=False),
                 json.dumps(c["rubric"], ensure_ascii=False), c["version"]))

        # 3) 배정 + 시도
        now = datetime.now(KST).replace(microsecond=0)
        total_attempts = 0
        print("학습자별 시드:")
        for n, l in enumerate(LEARNERS):
            steps = ALL_STEPS[:l["steps"]]
            status = ("completed" if l["steps"] == 5 else
                      "not_started" if l["steps"] == 0 else "in_progress")
            enr_id = f"e-{l['id']}-stage"
            conn.execute(
                """INSERT INTO enrollments (id, user_id, course_id, status,
                                            steps_completed_json, completed_at)
                   VALUES (?,?,?,?,?,?)""",
                (enr_id, l["id"], COURSE_ID, status,
                 json.dumps(steps, ensure_ascii=False),
                 _iso(now - timedelta(days=1)) if status == "completed" else None))
            conn.execute(
                """INSERT INTO enrollments (id, user_id, course_id, status,
                                            steps_completed_json, completed_at)
                   VALUES (?,?,'photo-basics',?,'[]',NULL)""",
                (f"e-{l['id']}-basics", l["id"],
                 "completed" if l["basics"] else "not_started"))

            marks = []
            for i, (days_ago, dur, rubric) in enumerate(l["attempts"], start=1):
                s = _insert_attempt(conn, attempt_id=f"{enr_id}-a{i}", enrollment_id=enr_id,
                                    attempt_no=i, rubric=rubric, days_ago=days_ago,
                                    duration_sec=dur, now=now, seed_no=n * 17 + i)
                marks.append(f"{i}차 과잉보정{s['overshoot_count']}회"
                             + ("(미제출)" if rubric is None
                                else f"·{rubric}→{s['scored']}"))
                total_attempts += 1
            print(f"  {l['id']} {l['name']:4s} 단계 {l['steps']}/5, 시도 {len(l['attempts'])}건"
                  + (f" — {', '.join(marks)}" if marks else ""))

    print(f"\n시드 완료: 학습자 {len(LEARNERS)}명, 시도 {total_attempts}건")
    print(f"DB: {DB_PATH}")


if __name__ == "__main__":
    seed(keep="--keep" in sys.argv)
