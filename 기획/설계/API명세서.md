# API 명세서 — WME (We Make Experts)

> **제출물.** 기준 코드는 `web/backend/app/main.py` 이고, 이 문서는 그 구현을 설명한다.
> 데이터 구조는 `DB설계.md`, 실습 과정 정의는 `실습과정_정렬.md` 를 따른다.
>
> 최종 수정: 2026-09-13 — 실제 라우트·응답과 대조 확인

## 0. 공통

| | |
|---|---|
| Base URL | `http://localhost:8000` |
| 형식 | 요청·응답 모두 JSON (UTF-8) |
| 인증 | **없다.** 데모 로그인은 역할 전환 기능이며 인증 구현이 아니다 |
| CORS | `localhost:5173`, `127.0.0.1:5173`, `localhost:4173`, `127.0.0.1:4173` |
| 시각 | ISO8601 문자열 (`2026-09-01T15:06:11+09:00`) |
| 필드 이름 | **응답은 camelCase.** DB 컬럼은 snake_case이고 서버가 변환한다 |

프론트는 개발 중 Vite 프록시로 `/api`·`/ws` 를 8000번에 넘긴다. 그래서 같은 출처가 되어
CORS를 타지 않는다. 빌드본(`npm run preview`, 4173)으로 띄울 때만 CORS 설정이 쓰인다.

### 엔드포인트 목록

| # | 메서드 | 경로 | 용도 |
|---|---|---|---|
| 1 | GET | `/api/users` | 사용자 목록 |
| 2 | GET | `/api/users/{id}` | 사용자 1명 |
| 3 | GET | `/api/courses` | 과정 목록 |
| 4 | GET | `/api/courses/{id}` | 과정 1개 |
| 5 | GET | `/api/enrollments` | 배정 목록 |
| 6 | PATCH | `/api/enrollments/{id}/progress` | 단계 완료 기록 |
| 7 | POST | `/api/attempts` | 실습 시도 생성 |
| 8 | POST | `/api/attempts/{id}/phase` | 단계 전환 · 정렬 확정 |
| 9 | GET | `/api/attempts` | 시도 목록 |
| 10 | GET | `/api/attempts/{id}` | 시도 1개 |
| 11 | POST | `/api/attempts/{id}/submission` | 답변 제출 |
| 12 | POST | `/api/attempts/{id}/feedback` | AI 피드백 생성 |
| 13 | POST | `/api/attempts/{id}/feedback/viewed` | 피드백 열람 기록 |
| 14 | GET | `/api/instructor/overview` | 담당자 화면 데이터 |
| 15 | GET | `/api/health` | 서버 상태 · LLM 연결 여부 |
| WS | — | `/ws/attempts/{id}` | 실습 중 실시간 측정 |

### 공통 오류 형식

FastAPI 기본 형식이다.

```json
{ "detail": "과정을 찾을 수 없습니다." }
```

| 코드 | 뜻 | 이 API에서 나오는 경우 |
|---|---|---|
| 404 | 대상 없음 | 사용자·과정·배정·시도가 없을 때 |
| 409 | 지금 상태에서 할 수 없음 | 상태 전이 위반, 준비 중 과정 |
| 422 | 값이 규칙에 안 맞음 | 과정에 없는 단계·조정 순서, 측정 데이터 없음 |
| 503 | 외부 의존 실패 | **LLM 호출·검증 실패** (13번에서만) |

---

## 1. GET `/api/users`

**쿼리**

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `role` | `learner` \| `instructor` | 아니오 | 역할로 거른다 |

**응답 200**

```json
[
  {"id":"u-1","displayName":"김진수","role":"learner","department":"장비기술1팀 · 신입"},
  {"id":"u-instructor","displayName":"최태원","role":"instructor","department":"기술교육센터 · 교육 담당"}
]
```

**오류** — `role` 이 두 값이 아니면 422 (FastAPI 패턴 검증)

> 이 엔드포인트가 있어야 화면과 서버에 사람 정보가 두 벌 생기지 않는다.
> 실제로 이름이 어긋나는 문제가 한 번 있었고, 그래서 추가했다.

## 2. GET `/api/users/{user_id}`

**응답 200** — 위 객체 1개 / **오류** 404 `사용자를 찾을 수 없습니다.`

## 3. GET `/api/courses`

**응답 200** — 과정 배열. `id` 순.

```json
[{
  "id": "photo-align",
  "title": "포토공정 입문 — 마스크·웨이퍼 정렬 실습",
  "subtitle": "정렬 마크를 읽고, 위치와 회전을 순서대로 맞춘다",
  "description": "...",
  "availability": "available",
  "estimatedMinutes": 30,
  "objectives": ["...4개..."],
  "prerequisites": ["...1개..."],
  "steps": [{"id":"concept","title":"개념 확인","summary":"..."}, "...5개..."],
  "orderOptions": [{"id":"xy-then-theta","label":"...","hint":"..."}, "...4개..."],
  "rubric": [{"short":"정렬 정확도","text":"..."}, "...4개..."],
  "alignment": {"tolerancePx":4,"toleranceDeg":1,"umPerPx":25,
                "startOffset":{"x":62,"y":-44,"theta":6.5},
                "controls":[...],"controllerNotice":"...",
                "markLabels":{"fixed":"마스크 마크","moving":"웨이퍼 마크"},
                "fieldRadius":132,"materials":[...]},
  "control": {"deadZoneDeg":2.0,"gainPxPerDeg":12.0,"maxSpeedPx":160.0,
              "yawDeadZoneDeg":3.0,"yawGainDegPerDeg":2.5,"maxSpeedDeg":30.0,
              "keyboard":{"movePxPerSec":90.0,"rotateDegPerSec":22.0,"fineFactor":0.25}},
  "version": "course-2.0.0",
  "content": { "...서버 내부 검증용 원본. 화면은 무시해도 된다..." }
}]
```

**구조가 평평하다.** DB는 `content_json` 한 칸에 모아 두지만(`DB설계.md` 1절 원칙 4),
화면은 `course.objectives` 처럼 바로 읽는다. 그 변환을 서버가 한다(`repo.course_row_to_dict`).

시드에는 5개가 있다 — `photo-align`(실습 구현) / `photo-basics`(미리보기) /
`align-record`·`exposure-basics`·`defect-report`(준비 중). 뒤 4개는 `objectives` 등이 빈 배열이다.

**허용 오차(`alignment.tolerancePx` 등)와 조작 계수(`control`)가 코드가 아니라 여기서 온다.**
화면에 숫자를 적어 넣지 않고 이 값을 쓴다. 다른 과정을 만들 때 값만 바꾸면 된다.

## 4. GET `/api/courses/{course_id}`

**응답 200** — 위 객체 1개 / **오류** 404 `과정을 찾을 수 없습니다.`

## 5. GET `/api/enrollments`

**쿼리** — `userId` (선택). 없으면 전체.

**응답 200**

```json
[{"id":"en-1","userId":"u-1","courseId":"photo-align",
  "status":"in_progress","stepsCompleted":["concept","marks","align","submit"],
  "completedAt":null}]
```

**진도율은 주지 않는다.** `stepsCompleted` 개수를 과정 `steps` 수로 나눠 화면이 계산한다.
퍼센트를 저장·전송하면 과정 단계가 바뀌었을 때 숫자가 거짓이 된다.

## 6. PATCH `/api/enrollments/{enrollment_id}/progress`

**요청**

```json
{ "stepId": "align", "completed": true }
```

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `stepId` | string | 예 | 그 과정 `steps` 에 있는 id |
| `completed` | boolean | 아니오 (기본 `true`) | `false` 면 완료 취소 |

**응답 200** — 갱신된 배정 객체.
`status` 는 서버가 다시 계산한다: 완료 단계가 없으면 `not_started`,
전부면 `completed`(+`completedAt`), 그 사이면 `in_progress`.

**오류**

| 코드 | 경우 |
|---|---|
| 404 | 배정 없음 / 과정 없음 |
| 422 | `이 과정에 없는 단계입니다: {stepId}` |

## 7. POST `/api/attempts`

실습을 시작할 때 **가장 먼저** 부른다. 여기서 받은 `id` 를 이후 모든 호출에 쓴다.

**요청**

```json
{ "userId": "u-1", "courseId": "photo-align",
  "source": "live", "inputDevice": "keyboard" }
```

| 이름 | 타입 | 필수 | 기본 | 설명 |
|---|---|---|---|---|
| `userId` | string | 예 | | |
| `courseId` | string | 예 | | |
| `source` | `mock`\|`replay`\|`live` | 아니오 | `live` | 데이터의 성격 |
| `inputDevice` | `keyboard`\|`model_controller` | 아니오 | `keyboard` | 조작 수단 |

**응답 201** — 시도 객체 (10번 참조). `status` 는 `aligning`, `attemptNo` 는 서버가 부여한다.

**오류**

| 코드 | 경우 |
|---|---|
| 404 | 과정 없음 / 사용자 없음 |
| 409 | `아직 실습할 수 없는 과정입니다.` (`availability != "available"`) |

**`attemptNo` 를 클라이언트가 정하지 않는다.** 서버가 그 배정의 최댓값+1로 부여한다.
배정이 없으면 서버가 만든다.

## 8. POST `/api/attempts/{attempt_id}/phase`

단계 전환을 기록한다. **`confirmed` 가 측정 종료 시점**이고, 이때 서버가 분석을 돌린다.

**요청**

```json
{ "phase": "confirmed", "tMs": 13180 }
```

| 이름 | 타입 | 값 |
|---|---|---|
| `phase` | string | `idle` \| `aligning` \| `confirmed` \| `submitted` |
| `tMs` | integer ≥ 0 | 시도 시작부터의 경과 시간 |

**응답 200** — 시도 객체. `phase` 가 `confirmed` 면 `status` 가 `aligned` 로 바뀌고
`summary` 와 `events` 가 채워져서 온다.

**오류**

| 코드 | 경우 |
|---|---|
| 404 | 시도 없음 |
| 409 | `'{status}' 상태에서는 정렬을 확정할 수 없습니다.` |
| 422 | `측정 데이터가 없어 분석할 수 없습니다.` (WS로 sample을 하나도 안 보낸 경우) |

### 서버가 확정 시점에 하는 일

1. `measurements` 를 읽어 **규칙 기반 정렬 경로 분석**을 돌린다 (`app/analyzers/alignment.py`, 학습 모델 아님)
2. 보정 구간·과잉 보정 구간을 `events` 에 저장한다
3. `summary_json` 을 만든다 — 최종 오차, 소요 시간, 보정 횟수, 과잉 보정 횟수, 수렴 여부, 경로 분석
4. **`converged` 를 서버가 직접 계산한다.** 화면이 보낸 값을 믿지 않는다

## 9. GET `/api/attempts`

**쿼리** — `userId` (선택)

**응답 200** — 시도 배열. **최신이 먼저.** 목록이므로 `samples` 는 포함하지 않는다.

## 10. GET `/api/attempts/{attempt_id}`

**쿼리**

| 이름 | 타입 | 기본 | 설명 |
|---|---|---|---|
| `includeSamples` | boolean | `true` | `false` 면 시계열을 뺀다 (목록·요약용) |

**응답 200**

```json
{
  "id": "a-u-1-1", "enrollmentId": "en-1", "userId": "u-1", "courseId": "photo-align",
  "attemptNo": 1,
  "source": "mock", "inputDevice": "keyboard", "status": "feedback_ready",
  "startedAt": "2026-09-01T15:04:51+09:00", "endedAt": "2026-09-01T15:05:04+09:00",
  "phaseMarkers": [{"phase":"aligning","tMs":0},{"phase":"confirmed","tMs":13180}],
  "summary": {
    "finalDx": 3.189, "finalDy": -2.12, "finalDTheta": 0.868,
    "durationMs": 13180, "adjustmentCount": 3, "overshootCount": 2, "converged": true,
    "pathAnalysis": { "convergence": {"order":"rotation_first", "...": "..."},
                      "overshootByAxis": {"x":2,"y":0,"theta":0},
                      "analyzerVersion": "rule-align-1.0.0" }
  },
  "answer": {"orderOptionId":"theta-then-xy","reason":"...","submittedAt":"..."},
  "feedback": {"generatedBy":"mock","good":["..."],"improve":["..."],
               "eventIds":["..."],"nextStep":"...","cannotJudge":["..."],
               "generatedAt":"..."},
  "feedbackStatus": "ready", "feedbackError": null, "feedbackViewedAt": "...",
  "rubricScores": [1, 2, 1, 1],
  "rubricSource": "rule",
  "rubricReasons": ["정렬 정확도 · 충족 — ...", "..."],
  "durationSec": 1580,
  "courseVersion": "course-2.0.0", "modelVersion": "rule-align-1.0.0",
  "settingsVersion": "align-settings-1.0.0",
  "events": [{"id":"...","attemptId":"...","startMs":1200,"endMs":4300,
              "type":"overshoot","axis":"xy","metrics":{...}}],
  "samples": [{"tMs":0,"roll":0,"pitch":0,"waferX":62,"waferY":-44,"waferTheta":6.5,
               "dx":62,"dy":-44,"dTheta":6.5}]
}
```

**`rubricSource` 를 반드시 화면에 반영한다.**

| 값 | 뜻 | 화면 표시 |
|---|---|---|
| `rule` | 규칙 기반 임시 채점 (저장된 궤적에서 계산) | **규칙 기반 임시 채점 · AI 미연결** |
| `llm` | 모델이 채점 | **AI 채점** |

`rubricReasons` 는 **규칙 채점일 때만** 함께 온다. 기준별 설명으로 쓴다.
저장하지 않고 매번 계산한다 — 저장해두면 규칙이 바뀌었을 때 점수와 설명이 어긋나기 때문이다.

**오류** — 404 `시도를 찾을 수 없습니다.`

## 11. POST `/api/attempts/{attempt_id}/submission`

**요청**

```json
{ "orderOptionId": "xy-then-theta",
  "reason": "두 마크가 많이 떨어져 있어서 위치부터 겹친 뒤 각도를 맞췄습니다." }
```

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `orderOptionId` | string | 예 | 그 과정 `orderOptions` 의 id |
| `reason` | string (1~2000자) | 예 | 왜 그 순서로 했는지 |

`orderOptionId` 유효값 4개: `xy-then-theta` / `theta-then-xy` / `interleaved` / `other`

**응답 200** — 시도 객체. `status` 가 `submitted` 가 되고,
**이 시점에 서버가 규칙 기반 루브릭 채점을 해서 `rubricScores` + `rubricSource:"rule"` 을 채운다.**

**오류**

| 코드 | 경우 |
|---|---|
| 404 | 시도 없음 |
| 409 | `'{status}' 상태에서는 답변을 제출할 수 없습니다.` (정렬 확정 전) |
| 422 | `이 과정에 없는 조정 순서입니다: {orderOptionId}` |

> **`reason` 은 학습자가 쓴 글이며 데이터다.** 서버도 AI도 그 내용을 명령으로 해석하지 않는다.

### 규칙 기반 채점 (`app/scoring.py`)

값은 0(미충족) / 1(부분) / 2(충족). 배열 순서는 `course.rubric` 과 같다.

| 기준 | 판정 근거 |
|---|---|
| 1 정렬 정확도 | `converged` + 허용 범위 대비 여유. 60% 안쪽이면 2, 경계 근처면 1, 벗어나면 1 또는 0 |
| 2 조정 순서 | **축을 섞지 않고 한 축씩 정리했는가.** `xy-then-theta`·`theta-then-xy` 둘 다 2, 섞이면 1. 축 간섭이 있으면 한 단계 내림. 적어 낸 순서가 기록과 다르면 만점 불가 |
| 3 보정 효율 | `overshootCount` |
| 4 설명·기록 | `reason` 이 실제로 작성됐는지와 길이. **내용의 좋고 나쁨은 규칙으로 판단하지 않는다** (그건 LLM 몫) |

기준 2에서 `theta-then-xy` 도 2점인 이유: 과정이 그 선택지를 "각도를 먼저 세우면 이후 위치
조정에서 축이 덜 섞입니다"라고 설명한다. 괜찮다고 가르쳐 놓고 고르면 감점하는 구조가 되면 안 된다.
루브릭 본문도 "위치를 먼저 맞추고 회전을 정리하는 **등** 절차를 지켰는가"이고, "등"은 예시다.
회전을 먼저 해서 위치가 다시 틀어진 경우는 이미 기준 3에서 감점된다. 같은 것을 두 번 깎지 않는다.

## 12. POST `/api/attempts/{attempt_id}/feedback`

**요청 본문 없음.**

**응답 200** — 시도 객체. `feedback` 이 채워지고 `feedbackStatus:"ready"`,
`status:"feedback_ready"`, **`rubricSource` 가 `llm` 으로 바뀐다** (모델 점수가 규칙 점수를 덮어쓴다).

**오류**

| 코드 | 경우 |
|---|---|
| 404 | 시도 없음 / 과정 없음 |
| 409 | `답변을 먼저 제출해야 피드백을 만들 수 있습니다.` |
| **503** | **LLM 호출 실패 또는 응답 검증 실패** |

**503 응답 본문**

```json
{ "detail": {
    "message": "...",
    "detail": [],
    "retryable": true,
    "answerPreserved": true
} }
```

- `retryable` — 다시 시도하면 될 수 있는지
- `answerPreserved` — **학습자 답변은 서버에 그대로 있다.** 화면에 이 사실을 알린다

**LLM 실패가 채점을 막지 않는다.** 답변과 규칙 기반 점수는 그대로 남고
`feedbackStatus` 만 `failed` 가 된다. 교육 서비스는 AI가 죽어도 멈추면 안 된다.

### 서버가 LLM에 넣는 것

**센서 원본을 넣지 않는다.** 계산된 결과만 넣는다.

- 과정 정보 (루브릭 4개, 허용 오차)
- `summary` (최종 오차·시간·보정 횟수·경로 분석)
- `events` (보정 구간 ID와 지표)
- 학습자 `answer` (조정 순서, 이유)
- 이전 시도 요약 (있으면 — 나아졌는지 비교용)

### 서버가 응답에서 검증하는 것

1. JSON 구조와 필수 필드
2. **`eventIds` 가 그 시도에 실재하는 ID인지** — 없는 ID는 버린다
3. `rubricScores` 길이가 루브릭 개수와 같고 값이 0·1·2인지

검증에 실패하면 저장하지 않고 503을 낸다. **모델이 지어낸 근거를 화면에 올리지 않기 위해서다.**

### 키 설정

서버는 환경변수만 읽는다(`app/config.py`).

```bash
cd web/backend
source .env      # .env 안에 export WME_LLM_API_KEY="..." 가 있다
./.venv/bin/python -m uvicorn app.main:app --port 8000
```

키가 없으면 이 엔드포인트는 항상 503이다. 15번 `/api/health` 의 `llmConfigured` 로 확인한다.

## 13. POST `/api/attempts/{attempt_id}/feedback/viewed`

피드백 열람 시각을 기록한다. 담당자 화면의 "확인 필요" 판단에 쓴다.

**응답 200** — 시도 객체 / **오류** 404

## 14. GET `/api/instructor/overview`

담당자 화면(반 전체 현황 / 학습자 목록)에 쓴다.

**응답 200** — **배정마다 한 줄.** 학습자 8명 × 배정 2과정 = 16줄.
화면이 실습 구현 과정만 걸러서 쓴다.

```json
[{
  "user": {"id":"u-1","displayName":"김진수","role":"learner","department":"장비기술1팀 · 신입"},
  "courseId": "photo-align",
  "enrollment": {"id":"en-1","userId":"u-1","courseId":"photo-align",
                 "status":"in_progress","stepsCompleted":[...],"completedAt":null},
  "attemptCount": 3,
  "latestAttempt": { "...시도 객체 (samples 제외)..." },
  "needsReview": false
}]
```

`needsReview` 는 최신 시도의 `feedbackStatus` 가 `failed` 일 때 `true`.

**집계값을 주지 않는다.** 평균 달성도·진도율은 화면이 이 원본에서 계산한다
(`DB설계.md` 1절 원칙 1). 그래야 화면 숫자가 손으로 적은 값이 아니게 된다.

## 15. GET `/api/health`

```json
{ "ok": true, "llmConfigured": false,
  "courseVersion": "course-2.0.0",
  "modelVersion": "rule-align-1.0.0",
  "settingsVersion": "align-settings-1.0.0" }
```

**`llmConfigured` 는 키가 설정됐는지만 알려준다. 키 값은 절대 내보내지 않는다.**

---

## 16. WebSocket `/ws/attempts/{attempt_id}`

실습 중 화면이 계산한 웨이퍼 좌표를 서버에 보낸다.

**기울기 → 이동 변환은 프론트가 계산한다.** 조작은 즉시 반응해야 하고 서버를 왕복하면
조작감이 무너지기 때문이다. 서버는 계산된 좌표를 받아 **기록하고 분석한다.**

### 연결 직후 — 서버 → 클라이언트

```json
{ "type": "ready", "attemptId": "a-1",
  "source": "live", "inputDevice": "keyboard",
  "tolerance": { "positionPx": 4.0, "rotationDeg": 1.0 } }
```

### 측정 전송 — 클라이언트 → 서버

```json
{ "type": "sample", "tMs": 120, "roll": -3.2, "pitch": 7.8,
  "waferX": 58.1, "waferY": -40.2, "waferTheta": 6.1 }
```

| 이름 | 필수 | 설명 |
|---|---|---|
| `tMs` | 예 | 경과 밀리초 |
| `roll`, `pitch` | 아니오 (기본 0) | 컨트롤러 기울기(도). 키보드일 때 0 |
| `waferX`, `waferY` | 예 | 마스크 마크 기준 상대 위치(px) |
| `waferTheta` | 예 | 회전(도) |
| `quality` | 아니오 (기본 `ok`) | `ok` / `gap`(수신 끊김) |

**초당 20~30회 정도로 보낸다.** 매 프레임(60fps)은 과하다.

### 상태 응답 — 서버 → 클라이언트

```json
{ "type": "state", "tMs": 120, "dx": 58.1, "dy": -40.2, "dtheta": 6.1,
  "withinTolerance": false }
```

`withinTolerance` 는 **서버가 과정 설정값으로 판정한 결과**다. 화면이 스스로 정하지 않는다.

### 정렬 확정 — 클라이언트 → 서버

```json
{ "type": "confirm" }
```

8번 REST와 같은 일을 한다. 응답:

```json
{ "type": "measured", "attempt": { "...시도 객체 (samples 제외)..." } }
```

### 오류

```json
{ "type": "error", "message": "시도를 찾을 수 없습니다." }
```

알 수 없는 `type` 이 오면 오류를 돌려주고 연결은 유지한다.

> **센서가 없어도 동일하게 동작한다.** 키보드로 조작해도 화면이 같은 `sample` 메시지를
> 보내기 때문이다. 서버는 무엇으로 조작했는지 신경 쓰지 않는다.

---

## 17. 실습 한 판의 호출 순서

```
1. POST /api/attempts                       → 201, id 받기, status "aligning"
2. WS   /ws/attempts/{id}  연결             → "ready" (허용 오차 받기)
3. WS   {"type":"sample", ...}  반복        → "state" (남은 오차, 통과 여부)
4. POST /api/attempts/{id}/phase            → status "aligned"
   {"phase":"confirmed","tMs":...}            summary + events 생성
   (또는 WS {"type":"confirm"})
5. POST /api/attempts/{id}/submission       → status "submitted"
   {"orderOptionId":"...","reason":"..."}     rubricScores + rubricSource "rule"
6. POST /api/attempts/{id}/feedback         → status "feedback_ready"
                                              feedback + rubricSource "llm"
                                              (키 없으면 503, 답변·점수는 보존)
7. PATCH /api/enrollments/{id}/progress     → 단계 완료 기록
```

**5번까지만 돼도 학습 기록이 완성된다.** 6번은 있으면 더 좋은 것이고, 실패해도 앞이 남는다.

## 18. 상태 전이

```
aligning ──phase confirmed──> aligned ──submission──> submitted
                                                          │
                                            feedback 성공 ├──> feedback_ready
                                            feedback 실패 └──> feedback_failed
                                                                    │
                                                          재시도 성공 └──> feedback_ready
```

역방향과 건너뛰기는 서버가 막는다(409). 재실습은 새 `attempt` 이며 이전 시도를 덮어쓰지 않는다.

## 19. 설계에서 내린 판단

**왜 인증이 없나** — 과제 공지가 FE 중심이고 배포 요구가 없다. 로컬 데모 전제다.
인증을 흉내 내면 "인증을 구현했다"는 오해를 부르므로, 아예 없다고 화면에 밝힌다.

**왜 집계값을 주지 않나** — 서버가 평균을 계산해 보내면 원본과 어긋날 수 있고,
어긋나는 순간 "화면 숫자를 손으로 넣었다"는 의심을 받는다. 원본만 주고 화면이 계산한다.

**왜 `converged` 를 서버가 다시 계산하나** — 화면이 보낸 통과 여부를 그대로 믿으면
클라이언트가 결과를 정하게 된다. 판정 기준은 과정 설정값이고 서버가 갖고 있다.

**왜 LLM 응답의 `eventIds` 를 검증하나** — 모델이 존재하지 않는 근거 구간을 지어낼 수 있다.
검증하지 않으면 화면에 없는 근거가 표시된다. 근거를 제시하는 AI일수록 근거가 실재해야 한다.

**왜 규칙 채점과 LLM 채점을 구분하나** — 규칙 채점을 AI 채점이라고 부르면 그건 거짓말이다.
`rubricSource` 필드가 그 구분을 강제한다.

## 20. 대조 확인 기록 (2026-09-13)

| 확인 대상 | 결과 |
|---|---|
| `app/main.py` 라우트 15 + WS 1 | 문서와 일치 |
| 오류 코드·메시지 | 코드에서 직접 확인 |
| 응답 필드명 (`repo.attempt_to_dict`) | 문서와 일치 |
| 동시 요청 | 수정 후 40개 전부 200 (BACK 측정) |
| **LLM 실제 호출** | **미확인** — API 키 확보 시점까지 가짜 응답으로만 검증 |
