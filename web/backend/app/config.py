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
COURSE_VERSION = "align-1.0.0"
MODEL_VERSION = "rule-align-1.0.0"      # 규칙 기반 정렬 경로 분석 버전(학습 모델 아님)
SETTINGS_VERSION = "align-settings-1.0.0"

# --- LLM ---------------------------------------------------------------
# 키는 환경변수에만 둔다. 없으면 LLM 호출을 하지 않고 feedback_status='failed' 로 남긴다.
LLM_API_KEY = os.environ.get("WME_LLM_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")
LLM_MODEL = os.environ.get("WME_LLM_MODEL", "claude-sonnet-5")
LLM_BASE_URL = os.environ.get("WME_LLM_BASE_URL", "https://api.anthropic.com")
LLM_TIMEOUT_SEC = float(os.environ.get("WME_LLM_TIMEOUT_SEC", "45"))
LLM_MAX_ATTEMPTS = int(os.environ.get("WME_LLM_MAX_ATTEMPTS", "2"))


def llm_configured() -> bool:
    """API 키가 서버 환경변수에 들어와 있는지."""
    return bool(LLM_API_KEY)
