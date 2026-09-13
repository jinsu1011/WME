"""과정 정의 — 포토공정 입문 · 마스크·웨이퍼 정렬 실습.

기준: 기획/설계/실습과정_정렬.md (2026-09-12 확정).
업종 내용은 전부 여기 시드 데이터에만 있고 서버 코드는 업종 중립이다.
"""
from __future__ import annotations

from .analyzers.alignment import DEFAULT_TOLERANCE
from .config import COURSE_VERSION
from .course_judgment import JUDGMENT_COURSE, JUDGMENT_COURSE_ID

COURSE_ID = "photo-align"

# 7절 루브릭 4개. 배열 순서가 rubric_scores_json 의 순서다. 바꾸면 과거 기록과 어긋난다.
RUBRIC = [
    {"short": "정렬 정확도", "text": "최종 오차가 과정에서 정한 허용 범위 안에 들어왔는가"},
    {"short": "조정 순서", "text": "위치를 먼저 맞추고 회전을 정리하는 등 절차를 지켰는가"},
    {"short": "보정 효율", "text": "과잉 보정 없이 수렴했는가"},
    {"short": "설명·기록", "text": "왜 그 순서로 조정했는지 설명했는가"},
]

# 5절 단계. id 는 프론트 StepId 와 같아야 한다(concept / marks / align / submit / feedback).
STEPS = [
    {"id": "concept", "title": "개념 확인",
     "summary": "노광 전 정렬이 왜 필요한지, 포토공정에서 어떤 역할인지 확인합니다."},
    {"id": "marks", "title": "마크 읽기",
     "summary": "정렬 마크의 기준 예시와 어긋난 예시를 보고 허용 오차 기준을 확인합니다."},
    {"id": "align", "title": "정렬 실습",
     "summary": "컨트롤러로 위치(X·Y)를, 화면 조작으로 회전(θ)을 조정해 두 마크를 겹칩니다."},
    {"id": "submit", "title": "제출",
     "summary": "정렬을 확정하고, 어떤 순서로 조정했는지와 그 이유를 적습니다."},
    {"id": "feedback", "title": "피드백 확인",
     "summary": "오차·소요 시간·보정 경로와 연습 피드백을 확인하고 필요하면 다시 연습합니다."},
]

# 제출할 때 학습자가 고르는 "어떤 순서로 조정했는가". 루브릭 2번(조정 순서)의 근거가 된다.
# id 는 프론트 courses.ts 의 orderOptions 와 같아야 한다.
ORDER_OPTIONS = [
    {"id": "xy-then-theta", "label": "위치를 먼저 맞추고 회전을 정리했다",
     "hint": "두 마크를 겹친 뒤 기울어진 각도를 마지막에 맞추는 순서입니다."},
    {"id": "theta-then-xy", "label": "회전을 먼저 맞추고 위치를 정리했다",
     "hint": "각도를 먼저 세우면 이후 위치 조정에서 축이 덜 섞입니다."},
    {"id": "interleaved", "label": "위치와 회전을 번갈아 조금씩 맞췄다",
     "hint": "한 번에 크게 움직이지 않고 두 축을 나눠 접근하는 순서입니다."},
    {"id": "other", "label": "그 밖의 순서로 진행했다",
     "hint": "위 셋에 해당하지 않는 경우입니다. 이유란에 실제 순서를 적어 주세요."},
]

# 채점 규칙 — 실습유형_설계.md 5·6절.
# 예전에 scoring.py 안에 파이썬으로 박혀 있던 판단을 그대로 데이터로 옮긴 것이다.
# 허용 오차는 위치 ±4px, 회전 ±1.0° (content.tolerance) 이고,
# 그 60%(2.4px / 0.6°) 안쪽이면 "여유 있게"로 본다.
SCORING = [
    {
        "criterion": 0,
        "metric": "finalPositionError",
        "type": "threshold",
        "unit": "px",
        "levels": [
            {"max": 2.4, "score": 2,
             "reason": "최종 오차가 허용 범위 안에 여유 있게 들어왔습니다 "
                       "— 위치 {finalPositionError}px, 회전 {finalRotationError}°."},
            {"max": 4.0, "score": 1,
             "reason": "허용 범위 안이지만 경계에 가깝습니다 "
                       "— 위치 {finalPositionError}px, 회전 {finalRotationError}°."},
            {"max": 10.0, "score": 1,
             "reason": "허용 범위를 조금 벗어났습니다. 오차가 큰 축을 한 번 더 줄여 보세요."},
            {"score": 0,
             "reason": "허용 범위 밖에서 확정했습니다. 남은 오차가 어느 축에 있는지 먼저 읽어 보세요."},
        ],
        # 위치로 등급을 정하고, 회전이 나쁘면 그만큼 내린다(설계서 6절 "회전은 modifier").
        "modifiers": [
            {"when": "rotationOutsideComfort", "capAt": 1,
             "reason": "회전 오차 {finalRotationError}° 가 허용 범위의 여유 구간을 넘었습니다."},
            {"when": "rotationOutsideRange", "capAt": 0,
             "reason": "회전 오차 {finalRotationError}° 가 허용 범위를 크게 벗어났습니다."},
        ],
    },
    {
        "criterion": 1,
        "metric": "convergenceOrder",
        "type": "categorical",
        "map": {"position_first": 2, "rotation_first": 2, "together": 1,
                "not_converged": 0, "unknown": 0},
        "reasons": {
            "position_first": "기록상 한 축씩 순서대로 정리했습니다(위치 → 회전).",
            "rotation_first": "기록상 한 축씩 순서대로 정리했습니다(회전 → 위치).",
            "together": "위치와 회전이 비슷한 시점에 정리됐습니다.",
            "not_converged": "허용 범위 안으로 들어오지 않아 조정 순서를 읽을 수 없습니다.",
            "unknown": "허용 범위 안으로 들어오지 않아 조정 순서를 읽을 수 없습니다.",
        },
        "modifiers": [
            {"when": "axisInterference", "adjust": -1,
             "reason": "한 축을 맞추는 동안 다른 축이 함께 움직인 구간이 있습니다."},
            {"when": "reportedOrderMismatch", "capAt": 1,
             "reason": "적어 낸 순서와 기록에서 읽힌 순서가 다릅니다."},
        ],
    },
    {
        "criterion": 2,
        "metric": "overshootCount",
        "type": "threshold",
        "unit": "회",
        "levels": [
            {"max": 0, "score": 2, "reason": "목표를 지나쳤다 되돌아온 구간 없이 수렴했습니다."},
            {"max": 2, "score": 1, "reason": "목표를 지나친 구간이 {overshootCount}회 있습니다."},
            {"score": 0, "reason": "목표를 지나친 구간이 {overshootCount}회로 많습니다."},
        ],
    },
    {
        "criterion": 3,
        "metric": "answerLength",
        "type": "threshold",
        "direction": "higher",
        "unit": "자",
        "levels": [
            {"min": 40, "score": 2, "reason": "조정 순서를 고른 이유를 문장으로 남겼습니다."},
            {"min": 15, "score": 1,
             "reason": "이유가 짧습니다. 무엇을 보고 그렇게 판단했는지 한 문장 더 적어 보세요."},
            {"score": 0,
             "reason": "조정 이유가 거의 적히지 않았습니다. 결과만으로는 판단 과정을 확인할 수 없습니다."},
        ],
    },
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
    # 기울기 → 이동 변환 계수. 계산은 프론트가 하지만 계수는 과정 설정값이라 서버가 준다.
    # (HEADER 확정값. 프론트가 쓰던 기본값과 같아서 넣어도 동작은 그대로다)
    "control": {
        "deadZoneDeg": 2.0,          # 이 각도 안쪽 기울기는 손떨림으로 보고 무시
        "gainPxPerDeg": 12.0,        # 기울기 1도당 초당 몇 px 이동
        "maxSpeedPx": 160.0,         # 이동 속도 상한 (px/초)
        "yawDeadZoneDeg": 3.0,       # 비틀기 무시 구간
        "yawGainDegPerDeg": 2.5,     # 비튼 각도 1도당 초당 몇 도 회전
        "maxSpeedDeg": 30.0,         # 회전 속도 상한 (도/초)
        "keyboard": {
            "movePxPerSec": 90.0,
            "rotateDegPerSec": 22.0,
            "fineFactor": 0.25,      # Shift 미세조정 배수
        },
    },
    # 실습 화면 설정. 업종 문구는 전부 여기(시드 데이터)에만 둔다.
    "alignment": {
        "tolerancePx": 4,
        "toleranceDeg": 1,
        "umPerPx": 25,
        "startOffset": {"x": 62, "y": -44, "theta": 6.5},
        "controls": [
            {"keys": "방향키 ← → ↑ ↓", "effect": "위치(X·Y) 이동"},
            {"keys": "Q / E", "effect": "회전(θ) 조정"},
            {"keys": "Shift + 키", "effect": "더 천천히 움직이기"},
        ],
        "controllerNotice":
            "센서를 붙인 웨이퍼 모형은 실제 장비의 조작기를 대신하는 교육용 컨트롤러입니다. "
            "실제 공정에서 웨이퍼를 손으로 기울여 정렬한다는 뜻이 아닙니다.",
        "markLabels": {"fixed": "마스크 마크", "moving": "웨이퍼 마크"},
        "fieldRadius": 132,
        "materials": [
            "노트북과 웹 브라우저 (키보드만으로 실습 가능)",
            "센서를 붙인 웨이퍼 모형 — 교육용 컨트롤러 (선택, 준비되면 사용)",
            "USB 케이블",
        ],
    },
    "orderOptions": ORDER_OPTIONS,
    "scoring": SCORING,
    # 피드백에서 반드시 지킬 표현. 코드가 아니라 과정 데이터에 둔다.
    "feedbackNotes": [
        "허용 오차는 이 교육 과정의 설정값이며 실제 장비의 정렬 정밀도가 아니다.",
        "센서를 붙인 모형은 실제 장비의 조작기를 대신하는 교육용 컨트롤러다.",
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
    "exercise_type": "alignment",
    "version": COURSE_VERSION,
}


# --- 카탈로그의 나머지 과정 ------------------------------------------------
# 실제로 실습까지 구현된 과정은 photo-align 하나다. 나머지는 소개만 보여준다.
# 프론트 courses.ts 와 같은 id·제목·상태를 쓴다.

def _stub(cid: str, title: str, subtitle: str, description: str,
          availability: str, minutes: int, version: str,
          objectives: list[str] | None = None) -> dict:
    return {
        "id": cid, "title": title, "subtitle": subtitle, "description": description,
        "availability": availability, "exercise_type": "alignment",
        "estimated_minutes": minutes,
        "content": {"objectives": objectives or [], "prerequisites": [],
                    "steps": [], "orderOptions": []},
        "rubric": [], "version": version,
    }


CATALOG = [
    _stub("photo-basics", "포토공정 개요", "노광 전후에 무슨 일이 일어나는지 이해한다",
          "감광액 도포부터 노광·현상까지 포토공정의 흐름과 각 단계가 담당하는 역할을 훑는 "
          "입문 과정입니다. 현재는 소개 내용만 열람할 수 있습니다.",
          "preview", 20, "preview-0.1",
          ["포토공정의 단계 순서를 설명한다", "각 단계가 왜 필요한지 예시로 든다"]),
    COURSE,
    _stub("align-record", "정렬 기록 작성", "조정 과정과 결과를 남기는 방법",
          "정렬 작업에서 무엇을 어떤 순서로 기록해야 하는지 다룰 예정입니다.",
          "coming_soon", 25, "draft"),
    _stub("exposure-basics", "노광 조건의 기본", "조건이 결과를 바꾸는 방식",
          "노광 조건이 패턴 결과에 어떻게 반영되는지 개념 수준에서 다룰 예정입니다.",
          "coming_soon", 30, "draft"),
    JUDGMENT_COURSE,        # defect-report — 상황 판단 실습(실습유형_설계.md 7절)
]
