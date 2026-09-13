"""LLM 피드백의 출력 JSON 스키마와 검증기.

검증에 실패하면 피드백을 저장하지 않는다. 학습자가 제출한 답변은 그대로 남는다.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable

# 모델에게 주는 출력 형식(프롬프트에 그대로 들어간다)
OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["good", "improve", "eventIds", "nextStep", "cannotJudge", "rubricScores"],
    "additionalProperties": False,
    "properties": {
        "good": {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 4,
                 "description": "잘한 점. 기록에서 확인되는 사실에만 근거한다."},
        "improve": {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 4,
                    "description": "보완할 점."},
        "eventIds": {"type": "array", "items": {"type": "string"}, "maxItems": 6,
                        "description": "참조한 이벤트 ID. 제공된 목록에 있는 것만 쓴다."},
        "nextStep": {"type": "string", "description": "다음 학습 제안 한 문장."},
        "cannotJudge": {"type": "array", "items": {"type": "string"}, "maxItems": 4,
                        "description": "이 기록으로는 판단할 수 없는 것."},
        "rubricScores": {"type": "array", "items": {"type": "integer", "enum": [0, 1, 2]},
                         "description": "루브릭 4기준 채점. 주어진 루브릭과 같은 순서."},
    },
}

MAX_TEXT_LEN = 400
LIST_FIELDS = ("good", "improve", "cannotJudge")


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str]
    value: dict[str, Any] | None = None


def validate_feedback(raw: Any, *, allowed_event_ids: Iterable[str],
                      rubric_len: int) -> ValidationResult:
    """모델 응답을 검증한다.

    - 구조가 스키마와 맞는가
    - eventIds 가 그 attempt 에 실제로 있는 이벤트인가
    - rubricScores 길이가 루브릭 개수와 같고 값이 0·1·2 인가
    하나라도 어긋나면 ok=False 이고 호출한 쪽은 저장하지 않는다.
    """
    errors: list[str] = []
    allowed = set(allowed_event_ids)

    if not isinstance(raw, dict):
        return ValidationResult(False, ["응답이 JSON 객체가 아닙니다."])

    unknown = set(raw) - set(OUTPUT_SCHEMA["properties"])
    if unknown:
        errors.append(f"허용하지 않은 필드가 있습니다: {sorted(unknown)}")
    missing = [k for k in OUTPUT_SCHEMA["required"] if k not in raw]
    if missing:
        errors.append(f"필수 필드가 없습니다: {missing}")
        return ValidationResult(False, errors)

    out: dict[str, Any] = {}

    for field in LIST_FIELDS:
        v = raw[field]
        spec = OUTPUT_SCHEMA["properties"][field]
        if not isinstance(v, list) or not all(isinstance(x, str) for x in v):
            errors.append(f"{field} 는 문자열 배열이어야 합니다.")
            continue
        cleaned = [x.strip() for x in v if x and x.strip()]
        if len(cleaned) < spec.get("minItems", 0):
            errors.append(f"{field} 항목이 부족합니다(최소 {spec['minItems']}개).")
        if len(cleaned) > spec.get("maxItems", 99):
            errors.append(f"{field} 항목이 너무 많습니다(최대 {spec['maxItems']}개).")
        if any(len(x) > MAX_TEXT_LEN for x in cleaned):
            errors.append(f"{field} 의 문장이 너무 깁니다(최대 {MAX_TEXT_LEN}자).")
        out[field] = cleaned

    next_step = raw["nextStep"]
    if not isinstance(next_step, str) or not next_step.strip():
        errors.append("nextStep 은 비어 있지 않은 문자열이어야 합니다.")
    elif len(next_step) > MAX_TEXT_LEN:
        errors.append(f"nextStep 이 너무 깁니다(최대 {MAX_TEXT_LEN}자).")
    else:
        out["nextStep"] = next_step.strip()

    ev = raw["eventIds"]
    if not isinstance(ev, list) or not all(isinstance(x, str) for x in ev):
        errors.append("eventIds 는 문자열 배열이어야 합니다.")
    else:
        unknown_ids = [x for x in ev if x not in allowed]
        if unknown_ids:
            # 이 attempt 에 없는 ID 를 지어낸 경우다. 고쳐서 저장하지 않고 실패시킨다.
            errors.append(f"이 시도에 없는 근거 ID 를 참조했습니다: {unknown_ids}")
        if len(ev) > OUTPUT_SCHEMA["properties"]["eventIds"]["maxItems"]:
            errors.append("eventIds 가 너무 많습니다.")
        out["eventIds"] = list(dict.fromkeys(ev))

    scores = raw["rubricScores"]
    if not isinstance(scores, list):
        errors.append("rubricScores 는 배열이어야 합니다.")
    else:
        if len(scores) != rubric_len:
            errors.append(f"rubricScores 길이가 루브릭 개수({rubric_len})와 다릅니다: {len(scores)}")
        bad = [s for s in scores
               if isinstance(s, bool) or not isinstance(s, int) or s not in (0, 1, 2)]
        if bad:
            errors.append(f"rubricScores 값은 0·1·2 여야 합니다: {bad}")
        out["rubricScores"] = scores

    if errors:
        return ValidationResult(False, errors)
    return ValidationResult(True, [], out)
