"""규칙 기반 루브릭 채점.

**이것은 AI 채점이 아니다.** 저장된 정렬 궤적과 학습자가 제출한 답변에서
정해진 규칙으로 계산한 값이다. 응답에는 항상 rubricSource="rule" 로 표시한다.
LLM 피드백이 성공하면 그 점수로 덮어쓰고 rubricSource="llm" 이 된다.

이게 있어야 API 키가 없어도 "답변을 제출하면 기준별 확인이 나온다"가 성립한다.
채점이 LLM 에만 있으면 키가 없을 때 성취도 그래프가 통째로 빈다.
"""
from __future__ import annotations

from typing import Any

# 분석이 내는 수렴 패턴 → 학습자가 고르는 조정 순서 선택지와 같은 말로 옮긴다
ORDER_FROM_PATTERN = {
    "position_first": "xy-then-theta",
    "rotation_first": "theta-then-xy",
    "together": "interleaved",
    "not_converged": "unknown",
}

ORDER_LABEL = {
    "xy-then-theta": "위치를 먼저, 회전을 나중에",
    "theta-then-xy": "회전을 먼저, 위치를 나중에",
    "interleaved": "두 축을 번갈아",
    "other": "그 밖의 순서",
    "unknown": "판단할 수 없음",
}

# 정렬 정확도 기준: 허용 범위의 이 비율 안쪽이면 "여유 있게 맞췄다"로 본다.
# 허용 범위 안이기만 하면 전부 2점을 주면 등급이 갈리지 않는다(실제로 확인한 문제다).
COMFORTABLE_MARGIN = 0.6

# 설명·기록 기준의 최소 길이. 내용의 좋고 나쁨은 규칙으로 보지 않는다(그건 LLM 몫이다).
REASON_FULL_LEN = 40
REASON_MIN_LEN = 15


def observed_order(summary: dict) -> str:
    pattern = summary.get("path_analysis", {}).get("convergence", {}).get("order")
    return ORDER_FROM_PATTERN.get(pattern or "", "unknown")


def score(course: dict, summary: dict | None, answer: dict | None) -> dict[str, Any]:
    """루브릭 4기준을 0·1·2 로 매기고, 그렇게 매긴 이유를 함께 돌려준다."""
    levels = [0, 0, 0, 0]
    reasons: list[str] = []

    if not summary or not answer:
        return {"levels": levels, "reasons": ["채점에 필요한 기록이 없습니다."],
                "observedOrder": "unknown", "reportedOrder": None,
                "reportMatchesRecord": True, "scorer": "rule-align-1.0.0"}

    tol = course.get("content", {}).get("tolerance", {})
    pos_tol = float(tol.get("position_px", 4.0))
    rot_tol = float(tol.get("rotation_deg", 1.0))

    dx = float(summary.get("final_dx", 0.0))
    dy = float(summary.get("final_dy", 0.0))
    dth = abs(float(summary.get("final_dtheta", 0.0)))
    pos_err = (dx * dx + dy * dy) ** 0.5

    # --- 기준 1. 정렬 정확도 -------------------------------------------
    comfortable = (pos_err <= pos_tol * COMFORTABLE_MARGIN
                   and dth <= rot_tol * COMFORTABLE_MARGIN)
    if summary.get("converged") and comfortable:
        levels[0] = 2
        reasons.append(f"최종 오차가 허용 범위(±{pos_tol:g}px, ±{rot_tol:g}°) 안에 여유 있게 들어왔습니다 "
                       f"— 위치 {pos_err:.1f}px, 회전 {dth:.1f}°.")
    elif summary.get("converged"):
        levels[0] = 1
        reasons.append(f"허용 범위 안이지만 경계에 가깝습니다 — 위치 {pos_err:.1f}px, 회전 {dth:.1f}° "
                       f"(허용 ±{pos_tol:g}px, ±{rot_tol:g}°).")
    elif pos_err <= pos_tol * 2.5 and dth <= rot_tol * 2.5:
        levels[0] = 1
        reasons.append("허용 범위를 조금 벗어났습니다. 오차가 큰 축을 한 번 더 줄여 보세요.")
    else:
        reasons.append("허용 범위 밖에서 확정했습니다. 남은 오차가 어느 축에 있는지 먼저 읽어 보세요.")

    # --- 기준 2. 조정 순서 ---------------------------------------------
    # 루브릭 본문은 "위치를 먼저 맞추고 회전을 정리하는 '등' 절차를 지켰는가" 다.
    # "등"은 예시라는 뜻이므로, 보는 것은 **축을 섞지 않고 한 축씩 정리했는가** 다.
    # 위치→회전이든 회전→위치든 한 축씩 끝냈으면 절차를 지킨 것으로 본다.
    #
    # 회전을 먼저 해서 위치가 다시 틀어졌다면 그 손해는 기준3(보정 효율)의
    # 보정 횟수·과잉 보정에서 이미 반영된다. 같은 것을 두 번 깎지 않는다.
    obs = observed_order(summary)
    reported = answer.get("orderOptionId")
    if obs == "xy-then-theta":
        levels[1] = 2
        reasons.append("기록상 한 축씩 순서대로 정리했습니다(위치 → 회전).")
    elif obs == "theta-then-xy":
        levels[1] = 2
        reasons.append("기록상 한 축씩 순서대로 정리했습니다(회전 → 위치).")
    elif obs == "interleaved":
        levels[1] = 1
        reasons.append("위치와 회전이 비슷한 시점에 정리됐습니다.")
    else:
        levels[1] = 0
        reasons.append("허용 범위 안으로 들어오지 않아 조정 순서를 읽을 수 없습니다.")

    # 축 간섭이 있으면 한 축씩 나눠 조정한 것으로 보기 어렵다.
    if summary.get("path_analysis", {}).get("axisInterferenceEventIds"):
        if levels[1] == 2:
            levels[1] = 1
            reasons.append("한 축을 맞추는 동안 다른 축이 함께 움직인 구간이 있습니다.")

    # 적어 낸 순서와 기록이 다르면 만점을 주지 않는다.
    matches = True
    if reported and reported not in ("other", None) and obs != "unknown" and reported != obs:
        matches = False
        if levels[1] == 2:
            levels[1] = 1
        reasons.append(
            f"적어 낸 순서({ORDER_LABEL.get(reported, reported)})와 "
            f"기록에서 읽힌 순서({ORDER_LABEL.get(obs, obs)})가 다릅니다.")

    # --- 기준 3. 보정 효율 ---------------------------------------------
    over = int(summary.get("overshoot_count", 0))
    if over == 0:
        levels[2] = 2
        reasons.append("목표를 지나쳤다 되돌아온 구간 없이 수렴했습니다.")
    elif over <= 2:
        levels[2] = 1
        reasons.append(f"목표를 지나친 구간이 {over}회 있습니다.")
    else:
        reasons.append(f"목표를 지나친 구간이 {over}회로 많습니다.")

    # --- 기준 4. 설명·기록 ---------------------------------------------
    # 길이만 본다. 내용이 타당한지는 규칙으로 판단하지 않는다.
    text = (answer.get("reason") or "").strip()
    if len(text) >= REASON_FULL_LEN:
        levels[3] = 2
        reasons.append("조정 순서를 고른 이유를 문장으로 남겼습니다.")
    elif len(text) >= REASON_MIN_LEN:
        levels[3] = 1
        reasons.append("이유가 짧습니다. 무엇을 보고 그렇게 판단했는지 한 문장 더 적어 보세요.")
    else:
        reasons.append("조정 이유가 거의 적히지 않았습니다. 결과만으로는 판단 과정을 확인할 수 없습니다.")

    return {
        "levels": levels,
        "reasons": reasons,
        "observedOrder": obs,
        "reportedOrder": reported,
        "reportMatchesRecord": matches,
        "scorer": "rule-align-1.0.0",
    }
