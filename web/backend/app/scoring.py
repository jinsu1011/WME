"""채점 규칙 해석기.

**이 파일에는 도메인 지식이 없다.** 무엇을 재는 실습인지, 지표 이름이 무슨 뜻인지
모른다. 과정 데이터(`courses.content_json.scoring`)에 적힌 규칙을 읽어서,
분석기가 만든 `scoring_metrics` 딕셔너리에 적용할 뿐이다.

규격: 기획/설계/실습유형_설계.md 5절.
지원하는 것은 threshold / categorical / modifiers(adjust·capAt) / {metric} 치환뿐이다.
여기에 판단을 더 넣지 않는다. 판단이 필요하면 과정 데이터에 적는다.
"""
from __future__ import annotations

import re
from typing import Any

MIN_SCORE, MAX_SCORE = 0, 2

_PLACEHOLDER = re.compile(r"\{([A-Za-z_][A-Za-z0-9_]*)\}")


def _fill(text: str, metrics: dict[str, Any]) -> str:
    """reason 안의 {지표이름} 을 값으로 바꾼다. 없는 이름은 그대로 둔다."""
    def repl(m: re.Match) -> str:
        name = m.group(1)
        if name not in metrics:
            return m.group(0)
        value = metrics[name]
        if isinstance(value, float):
            return f"{value:g}"
        return str(value)
    return _PLACEHOLDER.sub(repl, text or "")


def _clamp(value: int) -> int:
    return max(MIN_SCORE, min(MAX_SCORE, value))


def _threshold(rule: dict, value: Any) -> tuple[int, str]:
    """levels 를 위에서부터 보고 처음 맞는 것을 쓴다.

    기본은 '작은 값이 좋다'이고 max 로 비교한다.
    direction 이 'higher' 면 '큰 값이 좋다'이고 min 으로 비교한다.
    경계(max/min)가 없는 항목은 나머지 전부에 해당한다.
    """
    higher_is_better = rule.get("direction") == "higher"
    key = "min" if higher_is_better else "max"
    try:
        number = float(value)
    except (TypeError, ValueError):
        return MIN_SCORE, "값이 없어 판정할 수 없습니다."

    for level in rule.get("levels", []):
        bound = level.get(key)
        if bound is None:
            return _clamp(int(level.get("score", 0))), level.get("reason", "")
        if (number >= float(bound)) if higher_is_better else (number <= float(bound)):
            return _clamp(int(level.get("score", 0))), level.get("reason", "")
    return MIN_SCORE, "판정할 수 없습니다."


def _categorical(rule: dict, value: Any) -> tuple[int, str]:
    key = str(value)
    mapping = rule.get("map", {})
    if key not in mapping:
        return MIN_SCORE, "판정할 수 없습니다."
    return _clamp(int(mapping[key])), rule.get("reasons", {}).get(key, "")


def _apply_modifiers(rule: dict, level: int, metrics: dict[str, Any]) -> tuple[int, list[str]]:
    """when 에 적힌 불리언 지표가 참일 때만 적용한다. 배열 순서대로."""
    notes: list[str] = []
    for mod in rule.get("modifiers", []):
        flag = metrics.get(mod.get("when"))
        if not flag:
            continue
        before = level
        if "adjust" in mod:
            level = _clamp(level + int(mod["adjust"]))
        if "capAt" in mod:
            level = min(level, _clamp(int(mod["capAt"])))
        if level != before or mod.get("alwaysNote"):
            notes.append(mod.get("reason", ""))
    return level, notes


def score(rules: list[dict] | None, metrics: dict[str, Any] | None,
          rubric_len: int) -> dict[str, Any]:
    """규칙을 적용해 기준별 0·1·2 와 그렇게 매긴 이유를 돌려준다."""
    levels = [0] * rubric_len
    reasons: list[str] = []

    if not rules or not metrics:
        return {"levels": levels,
                "reasons": ["채점에 필요한 기록이 없습니다."],
                "scorer": SCORER_VERSION}

    by_criterion = {int(r.get("criterion", i)): r for i, r in enumerate(rules)}
    for index in range(rubric_len):
        rule = by_criterion.get(index)
        if not rule:
            reasons.append("이 기준의 채점 규칙이 과정에 없습니다.")
            continue

        value = metrics.get(rule.get("metric"))
        kind = rule.get("type")
        if kind == "threshold":
            level, reason = _threshold(rule, value)
        elif kind == "categorical":
            level, reason = _categorical(rule, value)
        else:
            level, reason = MIN_SCORE, "알 수 없는 채점 방식입니다."

        level, notes = _apply_modifiers(rule, level, metrics)
        levels[index] = level
        for text in [reason, *notes]:
            if text:
                reasons.append(_fill(text, metrics))

    return {"levels": levels, "reasons": reasons, "scorer": SCORER_VERSION}


SCORER_VERSION = "rules-1.0.0"
