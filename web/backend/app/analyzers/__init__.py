"""실습 유형별 분석기.

플랫폼 층(사용자·과정·시도·루브릭·피드백)은 유형을 모른다.
유형마다 다른 것은 여기 모아 둔다: 무엇을 재고, 어떤 지표를 만들고,
답변이 어떤 모양인지.

각 분석기가 갖춰야 할 것:
  MEASURED            측정(시계열)이 있는 유형인가
  build_answer(course, body)        제출 본문을 검사해 answer 로 만든다 (실패 시 ValueError)
  on_submit(course, summary, answer, duration_ms)
                      제출 시점에 summary(scoring_metrics 포함)를 완성해 돌려준다
"""
from __future__ import annotations

from types import ModuleType

from . import alignment, judgment

_ANALYZERS: dict[str, ModuleType] = {
    "alignment": alignment,
    "judgment": judgment,
}

DEFAULT_TYPE = "alignment"


def get(exercise_type: str | None) -> ModuleType:
    return _ANALYZERS.get(exercise_type or DEFAULT_TYPE, _ANALYZERS[DEFAULT_TYPE])


def known_types() -> list[str]:
    return sorted(_ANALYZERS)
