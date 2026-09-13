"""LLM 호출부 — **여기만 API 키를 만진다.**

제공자를 두 곳 지원한다(anthropic / openai). 바뀌는 것은 "어디로 어떻게 보내는가" 뿐이고,
프롬프트 구성(prompt.py) · 출력 스키마 검증(schema.py) · 저장(service.py)은 그대로다.

## 오류 메시지에 키를 싣지 않는다

원본 예외 메시지(httpx 등)를 그대로 밖으로 내보내면 안 된다.
헤더 값이 잘못됐을 때 httpx 는 `Illegal header value b'sk-...'` 처럼 **키 값을 그대로 담은
메시지**를 만든다. 그 문자열은 HTTP 503 응답 본문과 attempts.feedback_error 컬럼까지
흘러간다. 실제로 한 번 그렇게 샜다.

그래서 이 파일은 예외를 **분류된 문구로만** 바깥에 전달하고, 원본 메시지는 버린다.
내보내기 전에 `_redact()` 로 한 번 더 거른다(이중 안전장치).
"""
from __future__ import annotations

import json
from typing import Any

import httpx

from ..config import (LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, LLM_PROVIDER,
                      LLM_TIMEOUT_SEC, llm_configured)


class LLMError(RuntimeError):
    """호출 실패. 학습자 답변은 보존하고 재시도할 수 있게 한다."""


class NotConfigured(LLMError):
    """서버 환경변수에 API 키가 없다."""


def _redact(text: str) -> str:
    """혹시라도 키가 섞인 문자열이 만들어졌다면 마지막에 가린다."""
    if LLM_API_KEY and LLM_API_KEY in text:
        text = text.replace(LLM_API_KEY, "***")
    return text


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


def _request(system: str, user: str) -> httpx.Response:
    """제공자에 맞는 요청을 보낸다. 여기서만 키가 헤더에 들어간다."""
    key = LLM_API_KEY or ""

    if LLM_PROVIDER == "anthropic":
        url = f"{LLM_BASE_URL}/v1/messages"
        headers = {"x-api-key": key,
                   "anthropic-version": "2023-06-01",
                   "content-type": "application/json"}
        payload: dict[str, Any] = {
            "model": LLM_MODEL,
            "max_tokens": 1500,
            "temperature": 0,
            "system": system,
            "messages": [{"role": "user", "content": user}],
        }
    else:  # openai
        url = f"{LLM_BASE_URL}/v1/chat/completions"
        headers = {"Authorization": f"Bearer {key}",
                   "content-type": "application/json"}
        payload = {
            "model": LLM_MODEL,
            "temperature": 0,
            # JSON 으로만 답하게 강제한다. 프롬프트에도 같은 요구가 들어 있다.
            "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": system},
                         {"role": "user", "content": user}],
        }

    return httpx.post(url, headers=headers, json=payload, timeout=LLM_TIMEOUT_SEC)


def _text_from(body: dict[str, Any]) -> str:
    """제공자별 응답에서 본문 텍스트를 꺼낸다."""
    if LLM_PROVIDER == "anthropic":
        return "".join(b.get("text", "") for b in body.get("content", []))
    choices = body.get("choices") or []
    if not choices:
        raise LLMError("LLM 응답에 내용이 없습니다.")
    return (choices[0].get("message") or {}).get("content") or ""


def call(system: str, user: str) -> dict[str, Any]:
    """모델을 호출해 파싱된 JSON 을 돌려준다. 내용 검증은 호출한 쪽에서 한다."""
    if not llm_configured():
        raise NotConfigured(
            "LLM API 키가 설정되어 있지 않습니다. "
            "서버 환경변수 WME_LLM_API_KEY 를 설정한 뒤 다시 시도하세요."
        )

    try:
        res = _request(system, user)
    except httpx.TimeoutException as exc:
        # 원본 메시지를 싣지 않는다. 아래 모든 except 가 같은 이유다.
        raise LLMError(f"LLM 서버 응답이 {LLM_TIMEOUT_SEC:.0f}초 안에 오지 않았습니다.") from exc
    except httpx.HTTPError as exc:
        raise LLMError("LLM 서버에 연결하지 못했습니다. "
                       "네트워크 상태와 API 키 형식을 확인하세요.") from exc
    except (ValueError, TypeError) as exc:
        # 헤더 값이 잘못된 경우가 여기로 온다(키에 줄바꿈·공백이 섞인 때).
        # 원본 메시지에 키 값이 들어 있으므로 절대 그대로 내보내지 않는다.
        raise LLMError("API 키 형식이 올바르지 않습니다. "
                       "앞뒤 공백이나 줄바꿈 없이 키만 넣었는지 확인하세요.") from exc

    if res.status_code == 401 or res.status_code == 403:
        raise LLMError("LLM 인증에 실패했습니다. API 키가 유효한지 확인하세요.")
    if res.status_code == 429:
        raise LLMError("LLM 호출 한도를 넘었습니다. 잠시 후 다시 시도하세요.")
    if res.status_code >= 400:
        # 본문에는 키가 들어가지 않지만, 만약을 위해 한 번 거른다.
        detail = _redact(res.text[:200])
        raise LLMError(f"LLM 오류 {res.status_code}: {detail}")

    try:
        text = _text_from(res.json())
    except LLMError:
        raise
    except (ValueError, AttributeError, KeyError, IndexError) as exc:
        raise LLMError("LLM 응답을 읽지 못했습니다.") from exc

    try:
        return _extract_json(text)
    except json.JSONDecodeError as exc:
        raise LLMError("LLM 응답이 JSON 형식이 아닙니다.") from exc
