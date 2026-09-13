"""상황 판단(judgment) 실습 분석기.

조작도 측정도 없다. 학습자가 확인 항목의 순서를 정하고 이유를 쓴 것이
곧 기록이다. 그래서 제출 시점에 summary 를 통째로 만든다.

과정이 제시하는 `recommendedOrder` 는 **이 교육 과정이 정한 기준**이며
모든 현장에 통하는 정답이 아니다. 지표 이름과 응답 문구에 그렇게 쓰지 않는다.

규격: 기획/설계/실습유형_설계.md 7.5절.
"""
from __future__ import annotations

from typing import Any

MEASURED = False         # 시계열 측정이 없는 유형이다

PASS_DISTANCE = 4        # orderDistance 가 이 값 이하면 passed


def _scenario(course: dict) -> dict:
    return course.get("content", {}).get("scenario", {}) or {}


def check_item_ids(course: dict) -> list[str]:
    return [c["id"] for c in _scenario(course).get("checkItems", [])]


def build_answer(course: dict, body: dict) -> dict:
    """제출 본문을 검사해 answer 로 만든다.

    orderedIds 는 확인 항목의 id 를 빠짐없이 한 번씩 담아야 한다(설계서 7.7절).
    """
    ordered = body.get("orderedIds")
    if not isinstance(ordered, list) or not ordered:
        raise ValueError("확인 순서를 정해야 합니다.")

    expected = check_item_ids(course)
    unknown = [i for i in ordered if i not in expected]
    if unknown:
        raise ValueError(f"이 과정에 없는 확인 항목입니다: {unknown}")
    if len(ordered) != len(set(ordered)):
        dupes = sorted({i for i in ordered if ordered.count(i) > 1})
        raise ValueError(f"같은 항목이 여러 번 들어 있습니다: {dupes}")
    missing = [i for i in expected if i not in ordered]
    if missing:
        raise ValueError(f"순서를 정하지 않은 항목이 있습니다: {missing}")

    return {"orderedIds": ordered, "reason": body.get("reason", "")}


def scoring_metrics(course: dict, answer: dict,
                    duration_ms: int | None = None) -> dict[str, Any]:
    """설계서 7.5절의 지표."""
    recommended = _scenario(course).get("recommendedOrder", [])
    ordered = answer.get("orderedIds", [])
    rank = {item: i for i, item in enumerate(recommended)}

    first = ordered[0] if ordered else None
    first_pick_rank = rank[first] + 1 if first in rank else len(recommended) + 1

    distance = 0
    for position, item in enumerate(ordered):
        if item in rank:
            distance += abs(position - rank[item])

    overlap = len(set(ordered[:3]) & set(recommended[:3]))

    return {
        "firstPickRank": first_pick_rank,
        "orderDistance": distance,
        "top3Overlap": overlap,
        "answerLength": len((answer.get("reason") or "").strip()),
        "durationMs": int(duration_ms or 0),
        "passed": distance <= PASS_DISTANCE,
    }


def on_submit(course: dict, summary: dict | None, answer: dict,
              duration_ms: int | None = None) -> dict:
    """측정이 없으므로 제출 시점에 summary 를 만든다."""
    summary = dict(summary or {})
    summary["scoring_metrics"] = scoring_metrics(course, answer, duration_ms)
    summary["duration_ms"] = int(duration_ms or 0)
    return summary
