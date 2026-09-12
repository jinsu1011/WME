"""과정 정의 — 포토공정 입문 · 마스크·웨이퍼 정렬 실습.

기준: 기획/설계/실습과정_정렬.md (2026-09-12 확정).
업종 내용은 전부 여기 시드 데이터에만 있고 서버 코드는 업종 중립이다.
"""
from __future__ import annotations

from .analysis import DEFAULT_TOLERANCE
from .config import COURSE_VERSION

COURSE_ID = "photo-align"

# 7절 루브릭 4개. 배열 순서가 rubric_scores_json 의 순서다. 바꾸면 과거 기록과 어긋난다.
RUBRIC = [
    {"short": "정렬 정확도", "text": "최종 오차가 과정에서 정한 허용 범위 안에 들어왔는가"},
    {"short": "조정 순서", "text": "위치를 먼저 맞추고 회전을 정리하는 등 절차를 지켰는가"},
    {"short": "보정 효율", "text": "과잉 보정 없이 수렴했는가"},
    {"short": "설명·기록", "text": "왜 그 순서로 조정했는지 설명했는가"},
]

# 5절 단계
STEPS = [
    {"id": "concept", "title": "개념 확인",
     "summary": "노광 전 정렬이 왜 필요한지, 포토공정에서 어떤 역할인지 확인합니다."},
    {"id": "baseline", "title": "마크 읽기",
     "summary": "정렬 마크의 기준 예시와 어긋난 예시를 보고 허용 오차 기준을 확인합니다."},
    {"id": "practice", "title": "정렬 실습",
     "summary": "컨트롤러로 X/Y를 맞추고 버튼으로 회전(θ)을 정리해 두 마크를 겹칩니다."},
    {"id": "judgement", "title": "제출",
     "summary": "정렬을 확정하고, 어떤 순서로 왜 그렇게 조정했는지 작성합니다."},
    {"id": "feedback", "title": "피드백 확인",
     "summary": "오차·시간·보정 경로와 학습 피드백을 확인하고 필요하면 재실습합니다."},
]

CONTENT = {
    "objectives": [
        "노광 전 정렬이 왜 필요한지 설명한다",
        "정렬 마크를 보고 어긋난 방향과 양을 읽는다",
        "위치와 회전을 순서대로 조정해 허용 오차 안에 맞춘다",
        "자신이 그 순서로 조정한 이유를 설명하고 결과를 기록한다",
    ],
    "prerequisites": ["equipment-basics"],
    "steps": STEPS,
    # 허용 오차는 과정 설정값이다. 실제 장비의 정렬 정밀도가 아니다.
    "tolerance": {
        **DEFAULT_TOLERANCE,
        "note": "허용 오차는 교육 과정 설정값이며 실제 장비의 정렬 정밀도가 아닙니다.",
    },
    "controller": {
        "mapping": "joystick",
        "note": "센서를 붙인 웨이퍼 모형은 실제 장비의 조작기를 대신하는 교육용 컨트롤러입니다. "
                "기울기를 이동 속도로 해석하며, 기울기가 곧 위치라는 뜻이 아닙니다. "
                "센서 없이 키보드로도 동일하게 동작합니다.",
        "inputDevices": ["keyboard", "model_controller"],
    },
    "checkItems": [
        {"id": "xy-first", "label": "위치(X/Y)를 먼저 맞추고 회전을 정리했다",
         "hint": "회전을 먼저 크게 돌리면 위치가 함께 틀어질 수 있습니다."},
        {"id": "small-steps", "label": "목표 근처에서는 작게 나눠 조정했다",
         "hint": "목표 가까이에서 크게 움직이면 지나쳤다 되돌아오기를 반복하게 됩니다."},
        {"id": "one-axis", "label": "한 번에 한 축씩 조정했다",
         "hint": "두 축을 동시에 움직이면 어느 조작이 효과가 있었는지 알기 어렵습니다."},
    ],
}

COURSE = {
    "id": COURSE_ID,
    "title": "포토공정 입문 — 마스크·웨이퍼 정렬 실습",
    "subtitle": "정렬 마크를 읽고, 위치와 회전을 순서대로 맞춘다",
    "description": (
        "반도체 포토공정에서는 노광 전에 마스크와 웨이퍼의 패턴 위치를 맞춰야 합니다. "
        "수동 마스크 얼라이너에서는 작업자가 화면을 보면서 위치와 회전을 직접 조정합니다. "
        "이 과정에서는 화면의 마스크 마크에 웨이퍼 마크를 허용 오차 안으로 겹치는 연습을 하고, "
        "정렬 오차·소요 시간·보정 과정을 근거로 학습 피드백을 받습니다."
    ),
    "availability": "available",
    "estimated_minutes": 30,
    "content": CONTENT,
    "rubric": RUBRIC,
    "version": COURSE_VERSION,
}
