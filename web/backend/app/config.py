"""서버 설정. 비밀값은 전부 환경변수에서만 읽는다(코드·깃에 넣지 않는다)."""
from __future__ import annotations

import os
from pathlib import Path

# web/backend/app/config.py -> web/backend -> web -> 프로젝트 루트
BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent.parent

SCHEMA_PATH = BACKEND_DIR / "schema.sql"
DB_PATH = Path(os.environ.get("WME_DB_PATH", PROJECT_ROOT / "data" / "local" / "wme.db"))

# 버전 3종. attempt 에 그대로 복사 저장해서 과거 기록의 근거가 조용히 바뀌지 않게 한다.
COURSE_VERSION = "course-2.0.0"   # 프론트 courses.ts 와 같은 문자열을 쓴다
MODEL_VERSION = "rule-align-1.0.0"      # 규칙 기반 정렬 경로 분석 버전(학습 모델 아님)
SETTINGS_VERSION = "align-settings-1.0.0"

# --- LLM ---------------------------------------------------------------
# 키는 환경변수에만 둔다. 없으면 LLM 호출을 하지 않고 feedback_status='failed' 로 남긴다.
# .strip() 하는 이유: 키를 붙여넣을 때 줄바꿈이나 공백이 따라 들어오면
# HTTP 헤더가 깨지면서 예외 메시지에 키 값이 실려 나간다. 들어오는 순간 다듬는다.
LLM_API_KEY = (os.environ.get("WME_LLM_API_KEY")
               or os.environ.get("ANTHROPIC_API_KEY")
               or os.environ.get("OPENAI_API_KEY") or "").strip() or None


def _guess_provider(key: str | None) -> str:
    """키 접두사로 제공자를 추정한다. 환경변수로 직접 지정하면 그쪽이 우선이다."""
    if not key:
        return "anthropic"
    return "anthropic" if key.startswith("sk-ant-") else "openai"


# anthropic | openai
LLM_PROVIDER = (os.environ.get("WME_LLM_PROVIDER") or _guess_provider(LLM_API_KEY)).strip().lower()

_DEFAULT_MODEL = {"anthropic": "claude-sonnet-5", "openai": "gpt-4.1-mini"}
_DEFAULT_BASE_URL = {"anthropic": "https://api.anthropic.com",
                     "openai": "https://api.openai.com"}

LLM_MODEL = os.environ.get("WME_LLM_MODEL") or _DEFAULT_MODEL.get(LLM_PROVIDER, "gpt-4.1-mini")
LLM_BASE_URL = (os.environ.get("WME_LLM_BASE_URL")
                or _DEFAULT_BASE_URL.get(LLM_PROVIDER, "https://api.openai.com"))
LLM_TIMEOUT_SEC = float(os.environ.get("WME_LLM_TIMEOUT_SEC", "45"))
LLM_MAX_ATTEMPTS = int(os.environ.get("WME_LLM_MAX_ATTEMPTS", "2"))


def llm_configured() -> bool:
    """API 키가 서버 환경변수에 들어와 있는지."""
    return bool(LLM_API_KEY)
