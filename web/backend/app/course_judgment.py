"""상황 판단 실습 과정 — 공정 이상 상황 보고.

규격: 기획/설계/실습유형_설계.md 7절. 문구·값·구조를 그대로 옮긴다.
업종 내용은 전부 이 시드 데이터 안에만 있고 서버 코드는 업종 중립이다.

`recommendedOrder` 는 이 교육 과정이 정한 기준이다. 모든 현장의 정답이 아니며,
제출 전에는 화면에 보여주지 않는다.
"""
from __future__ import annotations

JUDGMENT_COURSE_ID = "defect-report"
JUDGMENT_VERSION = "judgment-1.0.0"

SCENARIO = {
    "situation": "노광 후 검사에서 웨이퍼 가장자리 쪽 패턴이 흐리게 나왔습니다. 중심부는 정상입니다.",
    "observations": [
        {"label": "패턴 상태", "value": "중심부 정상 · 가장자리 흐림"},
        {"label": "직전 로트", "value": "이상 없음"},
        {"label": "레지스트 도포 두께", "value": "기록상 정상 범위"},
        {"label": "평행도 점검 이력", "value": "3일 전 수행"},
        {"label": "노광 시간", "value": "설정값과 동일"},
    ],
    # 배열 순서는 recommendedOrder 와 일부러 다르게 둔다(설계서 10.3).
    # 같으면 화면을 열자마자 권장 순서가 보이고, 그대로 제출해도 만점이 된다.
    "checkItems": [
        {"id": "coat", "label": "레지스트 도포 균일도 재확인"},
        {"id": "wedge", "label": "마스크·웨이퍼 평행도(웨지) 점검"},
        {"id": "history", "label": "장비 정비 이력 조회"},
        {"id": "focus", "label": "노광 초점 설정 확인"},
        {"id": "contam", "label": "마스크 표면 오염 확인"},
    ],
    "recommendedOrder": ["wedge", "focus", "contam", "coat", "history"],
    "orderNote": "권장 순서는 이 교육 과정이 정한 기준이며 모든 현장의 정답이 아닙니다.",
    "rationale": "가장자리만 흐리고 중심은 정상이라는 관측은 면 전체에 걸친 조건(평행도·초점)을 "
                 "먼저 가리킵니다. 도포나 정비 이력은 관측이 그쪽을 가리킬 때 확인합니다.",
}

RUBRIC = [
    {"short": "관측 판독", "text": "관측값이 가리키는 곳을 먼저 확인하려 했는가"},
    {"short": "확인 순서", "text": "권장 절차와 가까운 순서로 배열했는가"},
    {"short": "범위 좁히기", "text": "상위 항목에 관련 높은 것을 모았는가"},
    {"short": "설명·기록", "text": "왜 그 순서로 확인하려는지 설명했는가"},
]

# 설계서 7.6절. 채점 방법은 전부 데이터다.
SCORING = [
    {
        "criterion": 0,
        "metric": "firstPickRank",
        "type": "threshold",
        "levels": [
            {"max": 1, "score": 2,
             "reason": "관측값이 먼저 가리키는 항목을 1순위로 놓았습니다."},
            {"max": 2, "score": 1,
             "reason": "1순위로 놓은 항목이 권장 순서에서 {firstPickRank}번째입니다."},
            {"score": 0,
             "reason": "1순위로 놓은 항목이 권장 순서에서 {firstPickRank}번째로 떨어져 있습니다. "
                       "관측값이 무엇을 가리키는지 다시 읽어 보세요."},
        ],
    },
    {
        "criterion": 1,
        "metric": "orderDistance",
        "type": "threshold",
        "levels": [
            {"max": 2, "score": 2, "reason": "권장 절차와 거의 같은 순서로 배열했습니다."},
            {"max": 5, "score": 1,
             "reason": "권장 절차와 일부 순서가 다릅니다(차이 {orderDistance})."},
            {"score": 0,
             "reason": "권장 절차와 순서 차이가 큽니다(차이 {orderDistance})."},
        ],
    },
    {
        "criterion": 2,
        "metric": "top3Overlap",
        "type": "threshold",
        "direction": "higher",
        "levels": [
            {"min": 3, "score": 2, "reason": "상위 3개에 관련 높은 항목을 모두 모았습니다."},
            {"min": 2, "score": 1,
             "reason": "상위 3개 중 {top3Overlap}개가 권장 상위 항목과 겹칩니다."},
            {"score": 0,
             "reason": "상위 3개에 권장 상위 항목이 거의 들어 있지 않습니다."},
        ],
    },
    {
        "criterion": 3,
        "metric": "answerLength",
        "type": "threshold",
        "direction": "higher",
        "levels": [
            {"min": 40, "score": 2, "reason": "확인 순서를 정한 이유를 문장으로 남겼습니다."},
            {"min": 15, "score": 1,
             "reason": "이유가 짧습니다. 어떤 관측을 보고 그렇게 판단했는지 한 문장 더 적어 보세요."},
            {"score": 0,
             "reason": "확인 이유가 거의 적히지 않았습니다. 결과만으로는 판단 과정을 확인할 수 없습니다."},
        ],
    },
]

CONTENT = {
    "objectives": [
        "관측값이 무엇을 가리키는지 읽는다",
        "먼저 확인할 항목과 나중에 확인할 항목을 구분한다",
        "왜 그 순서로 확인하려는지 설명한다",
    ],
    "prerequisites": ["포토공정 입문 과정의 정렬 개념"],
    "steps": [
        {"id": "concept", "title": "상황 확인", "summary": "무슨 일이 있었는지와 관측값을 읽습니다."},
        {"id": "marks", "title": "관측 판독", "summary": "관측값이 어느 쪽을 가리키는지 살펴봅니다."},
        {"id": "align", "title": "순서 정하기", "summary": "확인 항목 5개의 순서를 정합니다."},
        {"id": "submit", "title": "제출", "summary": "왜 그 순서인지 적고 제출합니다."},
        {"id": "feedback", "title": "피드백 확인", "summary": "결과와 연습 피드백을 확인합니다."},
    ],
    "scenario": SCENARIO,
    "scoring": SCORING,
    "feedbackNotes": [
        "권장 순서는 이 교육 과정이 정한 기준이며 모든 현장의 정답이 아니다.",
        "관측값이 가리키지 않는 원인을 확정해서 말하지 않는다.",
    ],
}

JUDGMENT_COURSE = {
    "id": JUDGMENT_COURSE_ID,
    "title": "공정 이상 상황 보고 — 무엇부터 확인할 것인가",
    "subtitle": "관측 사실과 해석을 구분하고, 확인 순서를 정한다",
    "description": (
        "노광 후 검사에서 발견된 상황과 관측값을 읽고, 어떤 항목부터 확인할지 순서를 정하는 "
        "연습입니다. 조작 장치가 필요 없으며 읽고 판단해서 적는 것이 전부입니다. "
        "권장 순서는 이 교육 과정이 정한 기준이며 모든 현장의 정답이 아닙니다."
    ),
    "availability": "available",
    "exercise_type": "judgment",
    "estimated_minutes": 15,
    "content": CONTENT,
    "rubric": RUBRIC,
    "version": JUDGMENT_VERSION,
}
