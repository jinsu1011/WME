"""피드백 생성 절차 — 입력 구성 → 호출 → 검증 → 저장.

지키는 것:
- 검증에 실패하면 저장하지 않는다.
- 실패해도 학습자가 제출한 answer_json 은 건드리지 않는다. 재시도할 수 있다.
- 같은 입력·같은 버전이면 저장된 피드백을 재사용하고 '저장된 피드백'으로 표시한다.
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from typing import Any

from ..config import LLM_MODEL, MODEL_VERSION, llm_configured
from . import client
from .prompt import build_input
from .schema import validate_feedback

KST = timezone(timedelta(hours=9))


class FeedbackError(RuntimeError):
    """피드백을 저장할 수 없는 상태. 메시지는 화면에 그대로 보여도 되는 문장이다."""

    def __init__(self, message: str, *, detail: list[str] | None = None,
                 retryable: bool = True):
        super().__init__(message)
        self.detail = detail or []
        self.retryable = retryable


def input_fingerprint(prompt: dict[str, str], *, course_version: str,
                      model_version: str) -> str:
    """같은 입력·같은 버전인지 판단하는 지문. 버전이 바뀌면 재사용하지 않는다."""
    raw = json.dumps({
        "system": prompt["system"], "user": prompt["user"],
        "course_version": course_version, "model_version": model_version,
        "llm_model": LLM_MODEL,
    }, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def generate(*, course: dict, summary: dict, events: list[dict], answer: dict,
             previous: dict | None = None, cached: dict | None = None,
             course_version: str) -> dict[str, Any]:
    """검증까지 통과한 feedback_json 을 돌려준다. 실패하면 FeedbackError 를 던진다."""
    prompt = build_input(course=course, summary=summary, events=events,
                         answer=answer, previous=previous)
    fingerprint = input_fingerprint(prompt, course_version=course_version,
                                    model_version=MODEL_VERSION)

    # 같은 입력·같은 버전이면 다시 호출하지 않는다.
    if cached and cached.get("inputFingerprint") == fingerprint:
        return {**cached, "reused": True}

    if not llm_configured():
        raise FeedbackError(
            "AI 피드백을 만들 수 없습니다. 서버에 LLM API 키가 설정되어 있지 않습니다. "
            "제출한 답변은 그대로 저장되어 있으며, 키 설정 후 다시 시도할 수 있습니다.",
            retryable=True,
        )

    try:
        raw = client.call(prompt["system"], prompt["user"])
    except client.LLMError as exc:
        raise FeedbackError(f"AI 피드백 생성에 실패했습니다: {exc}", retryable=True) from exc

    allowed = [e["id"] for e in events]
    result = validate_feedback(raw, allowed_event_ids=allowed,
                              rubric_len=len(course["rubric"]))
    if not result.ok:
        # 검증 실패 → 저장하지 않는다. 반쯤 맞는 피드백을 화면에 올리지 않는다.
        raise FeedbackError(
            "AI 응답이 검증을 통과하지 못해 저장하지 않았습니다. 다시 시도할 수 있습니다.",
            detail=result.errors, retryable=True,
        )

    value = result.value or {}
    return {
        "generatedBy": "llm",
        "good": value["good"],
        "improve": value["improve"],
        "eventIds": value["eventIds"],
        "nextStep": value["nextStep"],
        "cannotJudge": value["cannotJudge"],
        "rubricScores": value["rubricScores"],
        "generatedAt": datetime.now(KST).replace(microsecond=0).isoformat(),
        "llmModel": LLM_MODEL,
        "modelVersion": MODEL_VERSION,
        "courseVersion": course_version,
        "inputFingerprint": fingerprint,
        "reused": False,
    }
