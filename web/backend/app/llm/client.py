"""LLM 호출부 — 여기만 API 키를 만진다.

키가 아직 없으므로 지금은 호출이 NotConfigured 로 끝난다.
키가 생기면 이 파일만 손대면 되고, 프롬프트 구성·검증·저장 코드는 그대로다.
"""
from __future__ import annotations

import json
from typing import Any

import httpx

from ..config import (LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, LLM_TIMEOUT_SEC,
                      llm_configured)


class LLMError(RuntimeError):
    """호출 실패. 학습자 답변은 보존하고 재시도할 수 있게 한다."""


class NotConfigured(LLMError):
    """서버 환경변수에 API 키가 없다."""


def _extract_json(text: str) -> Any:
    """모델이 코드블록이나 여분 문장을 붙여도 JSON 객체만 꺼낸다."""
    t = text.strip()
    if t.startswith("```"):
        t = t.split("```")[1]
        if t.lstrip().lower().startswith("json"):
            t = t.lstrip()[4:]
    t = t.strip()
    start, end = t.find("{"), t.rfind("}")
    if start == -1 or end <= start:
        raise LLMError("응답에서 JSON 객체를 찾지 못했습니다.")
    return json.loads(t[start:end + 1])


def call(system: str, user: str) -> dict[str, Any]:
    """모델을 호출해 파싱된 JSON 을 돌려준다. 검증은 호출한 쪽에서 한다."""
    if not llm_configured():
        raise NotConfigured(
            "LLM API 키가 설정되어 있지 않습니다. "
            "서버 환경변수 WME_LLM_API_KEY 를 설정한 뒤 다시 시도하세요."
        )
    try:
        res = httpx.post(
            f"{LLM_BASE_URL}/v1/messages",
            headers={
                "x-api-key": LLM_API_KEY or "",
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": LLM_MODEL,
                "max_tokens": 1500,
                "temperature": 0,
                "system": system,
                "messages": [{"role": "user", "content": user}],
            },
            timeout=LLM_TIMEOUT_SEC,
        )
    except httpx.HTTPError as exc:
        raise LLMError(f"LLM 서버에 연결하지 못했습니다: {exc}") from exc

    if res.status_code >= 400:
        raise LLMError(f"LLM 오류 {res.status_code}: {res.text[:300]}")

    try:
        body = res.json()
        text = "".join(b.get("text", "") for b in body.get("content", []))
    except (ValueError, AttributeError) as exc:
        raise LLMError(f"LLM 응답을 읽지 못했습니다: {exc}") from exc

    try:
        return _extract_json(text)
    except json.JSONDecodeError as exc:
        raise LLMError(f"LLM 응답이 JSON 이 아닙니다: {exc}") from exc
