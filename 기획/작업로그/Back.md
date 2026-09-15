# Back 세션 작업 로그

> 작업을 끝낼 때 **맨 위에** 한 칸 추가한다. 자기 파일만 쓰므로 다른 세션과 충돌하지 않는다.
> Header 세션이 이 로그들을 모아 `기획/PROGRESS.md` 에 반영한다.

---

## 2026-09-15 14:27 — 확인: BACK 이 아닌 세션이 서버 코드 수정·재기동 (BACK 은 아무것도 고치지 않음)

12차 뒤 "서버 켜짐·깨끗한 시드" 기록이 더는 사실이 아니어서 남긴다. 전부 실제 조회로 확인.
- **서버**: BACK 이 켠 uvicorn(pid 702)이 14:26:14 종료되고, **다른 Claude 세션**(부모 프로세스 93151, 08:45 시작 — BACK 세션 95196 아님)이 같은 시각 8000 에 재기동(pid 13576). `llmConfigured: true`
- **미커밋 서버 코드 변경(BACK 이 쓰지 않음)**: `config.py` `SENSOR_ROTATION_TOLERANCE_DEG = 3.0` 추가, `main.py` 에서 `input_device == model_controller` 이면 확정 분석(`_finalize`)과 WebSocket `ready.tolerance.rotationDeg`·`withinTolerance` 의 회전 허용 오차를 3.0° 로 바꿈 (주석: 9/15 실물 확인, 사용자 결정)
  - API/문서 영향: 센서 시도의 WS `ready.tolerance.rotationDeg` = 3.0, `converged`·채점(`rotationOutsideComfort/Range`)이 3.0° 기준. YAML `AlignmentSettings`("허용 오차는 과정 설정값")·DBML `alignment_settings` 에 센서 전용 값이 없다 → HEADER 대조 필요
  - 시드 14건은 전부 keyboard 라 시드 점수에는 영향 없음(분석 코드상)
- **DB**: 12차 재적재 뒤 시드 외 시도 3건 생김 — `e-u-1-stage-a4`(aligning, 14:13), `e-u-1-stage-a5`·`a6`(feedback_ready, **rubricSource llm** = 실제 LLM 호출 2회, 14:14·14:18). 시도 17건
- BACK 의 문구 3줄·README 는 `c0c229e` 로 이미 커밋됨
- BACK 은 서버 재시작·재적재·코드 수정을 하지 않았다. 재적재는 그 세션 작업이 끝났는지 확인한 뒤 지시받아 한다

---

## 2026-09-15 — BE 12차: course_judgment.py prerequisites 문장화 (HEADER 결정) · BACK 작업 끝

- 107행 판단 과정 `prerequisites` `["photo-basics"]` → `["포토공정 입문 과정의 정렬 개념"]`. 다른 값 무수정(`git diff --stat` 1줄)
- `course_judgment` 는 `seed.py`·`course_data.py` 만 읽고, `course_data` 도 `seed.py` 만 읽는다 → 서버 재시작 불필요
- 시드 재적재 → 확인(실제 조회): 학습자 8 · 배정 17 · 과정 5 · 시도 14 / 14건 점수 처음과 diff 없음
- API 확인: `GET /api/courses/defect-report` `prerequisites` = `["포토공정 입문 과정의 정렬 개념"]`, `recommendedOrder` 그대로 / `photo-align` 은 11차 문장 유지
- 네트워크: 유선 → Wi-Fi 전환 뒤 localhost health 200, OpenAI `gpt-4.1-mini` 조회 200 (피드백 호출·DB 기록 없음)
- 최종 상태: 서버 8000 켜짐(--reload 없음), **`llmConfigured: true`**(OpenAI gpt-4.1-mini), DB 는 깨끗한 시드. 오늘 서버 코드 변경은 `course_data.py` 2줄 + `course_judgment.py` 1줄 + README 1줄. 커밋 안 함

---

## 2026-09-15 — C-19 지원: 키 없이 재기동 → 재적재 → 키 넣고 재기동 (HEADER 지시)

- FRONT "C-19 준비" 뒤 서버를 `source .env` 없이(키 환경변수 3종 제거) 재기동 → `GET /api/health` **`llmConfigured: false`** 확인 → FRONT C-19 촬영(503)
- FRONT C-19 끝 → `python -m app.seed`. 재적재 전 시도 17건 = 시드 14 + `en-u-6-defect-report-a1`(BACK LLM 테스트) + `e-u-1-judgment-a3`(FRONT, AI 피드백 성공·C-19b) + `e-u-1-judgment-a4`(FRONT, 피드백 실패·C-19)
- 확인(실제 조회): 학습자 8 · 배정 17 · 과정 5 · 시도 14 / llm·failed 기록 0 / `e-u-1-judgment` in_progress 복귀 / 14건 점수 재적재 전후 diff 없음 / API `GET /api/attempts` 14건
- 서버를 `source .env` 로 재기동(8000, --reload 없음) → **`llmConfigured: true`** (OpenAI, gpt-4.1-mini)
- 서버·제출 문서·캡처 파일 무수정. 서버 켜 둔 채 대기

---

## 2026-09-15 — LLM 실제 호출 1회: 실패(인증) · M4 뒤 재적재 완료 — FRONT 캡처 가능

**LLM 호출 1회 (HEADER 지시대로 실패해도 고치지 않음)**
- 사용자가 `.env` 에 키 저장 → 서버 종료 후 `source .env` 로 재기동(8000, --reload 없음) → `GET /api/health` `llmConfigured: true`
- 판단 실습 u-6 시도 생성 → 제출 200(규칙 점수 [2,2,2,2]) → `POST /api/attempts/{id}/feedback` **1회**
- 결과: **503** `AI 피드백 생성에 실패했습니다: LLM 인증에 실패했습니다. API 키가 유효한지 확인하세요.` (`retryable: true`, `answerPreserved: true`)
- 실패 뒤: status `feedback_failed`, 답변·규칙 점수 보존. **응답·조회·DB(feedback_error, feedback_json) 어디에도 키 값 없음** (스크립트로 문자열 포함 검사)
- 원인 추정(값은 보지 않고 형식만 확인):
  - 키 접두사가 OpenAI 형식(`sk-proj-`) → 서버가 provider `openai`, base_url `https://api.openai.com` 로 호출 → OpenAI 가 401/403 을 돌려줌 = **그 키가 OpenAI 에서 거부됨**(만료·폐기·결제/프로젝트 권한 등, 서버 쪽에서는 구분 불가)
  - 추가 문제: `.env` 의 `WME_LLM_MODEL` 이 `claude-sonnet-5` 로 되어 있다. OpenAI 키로는 이 모델을 부를 수 없어 **키가 유효해도 다음 단계에서 실패할 것**
  - 키 끝에 줄바꿈 1개(12행 닫는 따옴표가 13행에 있음) — 서버가 앞뒤 공백을 지우므로 이번 실패 원인은 아님
- 서버·`.env` 는 고치지 않았다. 다시 시도하려면 사용자/HEADER 가 ① 유효한 키인지 ② OpenAI 키면 `WME_LLM_MODEL` 을 비우거나 gpt 모델로, Anthropic 키(`sk-ant-`)면 그대로 — 를 정한 뒤 BACK 이 서버 재기동·1회 재호출

**추가 확인 (사용자 결정: ChatGPT/OpenAI 사용)**
- `.env` 의 `WME_LLM_MODEL` 을 `""` 로 비움(키 줄은 읽지 않음) → 서버 설정 provider `openai` · model `gpt-4.1-mini`(코드 기본값) · base_url `https://api.openai.com`
- 피드백 호출 없이 키만 확인: `GET https://api.openai.com/v1/models` → **401 `invalid_api_key`** → **키 자체가 OpenAI 에서 무효**. 새 키가 필요하다
- 서버는 아직 옛 설정으로 떠 있다. 새 키 저장 후 재기동 → 피드백 1회 재호출 예정

**새 키로 재시도 — 성공 (사용자 지시로 2번째 호출, gpt-4.1-mini)**
- 사용자가 새 OpenAI 키 저장 → 호출 전 `GET /v1/models/gpt-4.1-mini` **200** 확인 → 서버 재기동(`source .env`, 8000, --reload 없음) → `llmConfigured: true`
- 판단 실습 u-6 시도 `en-u-6-defect-report-a1` 생성 → 제출 200(규칙 [2,2,2,2]) → `POST /feedback` 1회 → **200**
- 확인(실호출): status `feedback_ready`, feedbackStatus `ready`, **`rubricSource = llm`**, rubricScores [2,2,2,2], **`feedback.generatedBy = llm`**, `llmModel = gpt-4.1-mini`, eventIds `[]`(판단 실습은 구간 없음, 검증 통과), good 3 · improve 2 · nextStep · cannotJudge 3, DB `feedback_error` NULL
- **키 노출 없음**: 응답·조회·DB(feedback_json, feedback_error) 문자열 검사
- YAML 대조(10차 △ 확정): 성공 응답의 `feedback` 에 YAML `Feedback` 7필드 외 `rubricScores · llmModel · modelVersion · courseVersion · inputFingerprint · reused` 가 더 온다 → HEADER 판단(YAML 에 추가 또는 "내부 필드" 설명)
- 정렬 실습 LLM 호출은 하지 않음(1회 제한)
- 테스트 기록 `en-u-6-defect-report-a1`(+ 배정 `en-u-6-defect-report`)이 DB 에 남아 있다. FRONT 캡처 중이라 재적재는 보류 — 캡처 끝나면 재적재

**M4 뒤 시드 재적재**
- FRONT "작업 끝" 보고 뒤 `python -m app.seed` (재적재 전 시도 18건 = 시드 14 + FRONT M4 테스트 3 + LLM 테스트 1)
- 확인: 학습자 8 · 배정 17 · 과정 5 · 시도 14 · 피드백 실패 기록 0 / 14건 점수 재적재 전후 diff 없음
- BE 11차 문구 반영 확인: `GET /api/courses/photo-align` 의 `prerequisites` = `["장비 기초 과정의 정렬 개념"]`, `align` summary 새 문장
- 서버 8000 켜 둔 채 대기 (키가 들어간 상태로 떠 있음 — 피드백 요청 시 503 인증 실패 문구가 나온다)

---

## 2026-09-15 — BE 11차: course_data.py 문구 2곳 (HEADER 결정 17 범위 안)

- 29행 `align` 단계 summary → "방향키로 위치(X·Y)를, Q/E 로 회전(θ)을 맞춰 두 마크를 겹칩니다. 모형 컨트롤러를 쓰면 위치는 가운데 고정, 비틀어서 회전합니다."
- 134행 `prerequisites` `["equipment-basics"]` → `["장비 기초 과정의 정렬 개념"]`
- 그 밖의 값·구조·버전 문자열 무수정 (`git diff --stat` 2줄 변경). import 확인
- `course_data` 는 `seed.py` 만 읽는다 → **서버 재시작 불필요, 화면 반영은 시드 재적재 후**. 채점 규칙은 안 바뀌어 점수 영향 없음
- 재적재는 FRONT "M4 끝" 신호 뒤에 한다 (아직 안 함)
- HEADER 참고: `course_judgment.py` 107행 판단 과정 `prerequisites` 도 `["photo-basics"]` id 그대로다. 이번 지시 범위 밖이라 두었다

---

## 2026-09-15 — 재적재 완료 — FRONT 캡처 가능

- FRONT M1·M2 보고를 받은 뒤 `python -m app.seed` 실행 (서버 8000 켠 채, 재시작 없음)
- 지운 테스트 기록: `e-u-6-stage-a1`, `en-u-6-defect-report-a1`(BACK), `e-u-1-judgment-a3`, `e-u-1-stage-a4`(FRONT), `e-u-1-judgment` completed·`e-u-6-stage` 진도 변경
- 확인(실제 조회): 학습자 8 · 담당자 1 · 배정 17 · 과정 5 · 시도 14 / 재적재 전후 14건 `rubric_scores_json`·`rubric_source` diff 없음 /
  `e-u-1-judgment` in_progress 복귀 / API `GET /api/attempts` 14건, inputDevice 전부 keyboard, feedbackStatus none·ready 만(실패 기록 없음)
- 서버 8000 켜 둔 채 대기. LLM 키 없음

---

## 2026-09-15 — BE 10차: 제출 YAML·DBML ↔ 실제 서버 대조표 (결정 17, 서버·제출 문서 무수정)

- 서버 8000 `--reload` 없이 기동, `web/backend/README.md` 12행 `--reload` 삭제
- 방법: 실행 중 서버에 실제 요청(httpx·websockets 스크립트) + 시드 DB 조회. **"실호출"= 실제로 불러 확인, "코드"= 코드만 읽음**
- 테스트 기록: `e-u-6-stage-a1`(정렬), `en-u-6-defect-report-a1`(판단), `e-u-6-stage` 진도 변경 → **FRONT M1·M2 끝나면 시드 재적재로 정리** (재적재 전 14건 점수 저장해 둠)
- 요약: **불일치 ✗ 5건 / 부분 △ 8건**, 나머지 일치. 서버 코드 수정 필요 판단 항목 없음(모두 YAML·DBML 수정으로 해결 가능)

### A. API (WME-API.yml) — POST·PATCH 응답

| 항목 | YAML 내용 | 실제 서버 | 일치 |
|---|---|---|---|
| POST /attempts 201 (정렬) | Attempt, status `aligning` | 201, 필수 16키 누락 0·추가 키 0, `aligning` (실호출) | ✅ |
| POST /attempts 201 (판단) | `aligned` 에서 시작 | 201, `aligned` (실호출) | ✅ |
| POST /attempts 응답의 samples | samples 는 GET includeSamples=true 일 때만 | 201·phase 200 응답에도 `samples: []` 가 온다 (실호출) | △ YAML 설명 보완 |
| AttemptCreateRequest.inputDevice | 기본값 표기 없음 | 생략 시 `keyboard` (코드) | △ `default: keyboard` 추가 |
| POST /phase 200 | Attempt | 200, 필수 누락 0 (실호출) | ✅ |
| POST /submission 200 (정렬) | Attempt, rubricSource `rule` | 200, `rule`, answer `{orderOptionId, reason, submittedAt}`, samples 없음 (실호출) | ✅ |
| POST /submission 200 (판단) | Attempt, JudgmentSummary | 200, `summary={durationMs, scoringMetrics{firstPickRank, orderDistance, top3Overlap, answerLength, durationMs, passed}}` (실호출) | ✅ |
| **POST /feedback/viewed 200** | **Attempt** | **`{attemptId, feedbackViewedAt}` 두 키만** (실호출). FRONT 는 이 API 를 호출하지 않음 | ✗ → **YAML 을 실제에 맞춤 권장** |
| PATCH /progress 200 | Enrollment | 200, 6키 일치, 전 단계 완료 시 `completed`·completedAt 채움, `completed:false` 로 취소 (실호출) | ✅ |
| POST /feedback 200 (LLM 성공) | Feedback 7필드 | 키 없어 미호출. 코드상 `rubricScores·llmModel·modelVersion·courseVersion·inputFingerprint·reused` 가 feedback 안에 더 붙음 | △ 코드만 확인, LLM 키 오면 실호출 |

### B. API — 오류 코드·오류 본문 (전부 실호출)

| 항목 | YAML 내용 | 실제 서버 | 일치 |
|---|---|---|---|
| 없는 과정으로 시도 생성 | 404 | 404 `과정을 찾을 수 없습니다.` | ✅ |
| 없는 사용자로 시도 생성 | 404 | 404 `사용자를 찾을 수 없습니다.` | ✅ |
| 준비 중 과정(coming_soon·preview) 시도 생성 | 409 `아직 실습할 수 없는 과정입니다.` | 둘 다 409 같은 문구 | ✅ |
| source·inputDevice 잘못, courseId 누락 | 422 ValidationError | 422 detail 배열(loc·msg·type + input·ctx) | ✅ |
| 없는 시도 (phase·submission·feedback·viewed) | 404 | 네 경로 모두 404 `시도를 찾을 수 없습니다.` | ✅ |
| 측정 없이 확정 | 422 Error | 422 `측정 데이터가 없어 분석할 수 없습니다.` (마커도 롤백됨) | ✅ |
| 판단 시도에 confirmed | (명세 없음) | 422 같은 문구 — 422 는 명세에 있음 | ✅ |
| phase 값 잘못 / tMs 음수 | 422 ValidationError | 422 배열 | ✅ |
| **이미 확정된 시도 재확정** | **409** (Conflict 설명) | **200. 분석을 다시 돌려 events·summary·ended_at 을 덮어씀** (`can_transition` 이 같은 상태를 허용) | ✗ → **YAML 에서 이 줄 삭제 권장**. 서버를 409 로 바꾸면 코드 수정이라 HEADER 판단 필요 |
| 확정 전 제출 | 409 `'{status}' 상태에서는 ...` | 409 `'aligning' 상태에서는 답변을 제출할 수 없습니다.` | ✅ |
| 재제출 (submitted → 다시 제출) | 설명 없음 | 200 허용, 점수 다시 계산. `feedback_ready` 에서도 허용(코드), `feedback_failed` 에서는 409 | △ YAML 설명에 없음 |
| orderOptionId 누락 / 없는 조정 순서 | 422 Error | 422 `조정 순서를 선택해야 합니다.` / `이 과정에 없는 조정 순서입니다: diagonal` (YAML 예시와 문구 동일) | ✅ |
| reason 빈값·누락·2001자 | 422 (minLength 1, maxLength 2000) | 422 ValidationError 배열 | ✅ |
| 판단 항목 누락·중복·없는 항목·orderedIds 누락 | 422 Error | 422 각각 `순서를 정하지 않은 항목이 있습니다` / `같은 항목이 여러 번` / `이 과정에 없는 확인 항목` / `확인 순서를 정해야 합니다.` | ✅ |
| 제출 전 피드백 | 409 `답변을 먼저 제출해야 ...` | 정렬·판단 모두 409 같은 문구 | ✅ |
| 키 없이 피드백 | 503 FeedbackError | 503 | ✅ |
| 503 본문 구조 | `detail{message, detail[], retryable, answerPreserved}` | `{"detail":{"message":"AI 피드백을 만들 수 없습니다...", "detail":[], "retryable":true, "answerPreserved":true}}` | ✅ |
| 503 뒤 보존 | 답변·규칙 점수 보존 | status `feedback_failed`, feedbackStatus `failed`, answer 그대로, rubricScores [2,2,2,0] 그대로 | ✅ |
| Attempt.feedbackError | string, nullable | string 이지만 내용이 JSON 문자열 `{"message","detail","retryable"}`. 키 값 없음 확인 | △ 설명에 "JSON 문자열" 추가 |
| 없는 단계 진도 / stepId 누락 / 없는 배정 | 422 Error / 422 / 404 | 422 `이 과정에 없는 단계입니다: nope` / 422 배열 / 404 `배정을 찾을 수 없습니다.` | ✅ |
| 명세에 없는 코드가 나오는 경우 | — | 이번 호출에서는 없음 (500 없음) | ✅ |

### C. API — WebSocket (info.description, 실호출 150샘플)

| 항목 | YAML 내용 | 실제 서버 | 일치 |
|---|---|---|---|
| ready | `{type, attemptId, source, inputDevice, tolerance{positionPx, rotationDeg}}` | 같은 6키, tolerance 4.0 / 1.0 | ✅ |
| state | `{type, tMs, dx, dy, dtheta, withinTolerance}` | 같은 키 (`dtheta` 소문자 그대로), 마지막 샘플 withinTolerance true | ✅ |
| **confirm 응답** | **`measured` : `{type, attempt}`** | **`{"type":"aligned", "attempt":{...}}`** — 이름만 다름, attempt 필수 키 누락 0, 보낸 뒤 서버가 연결 종료. `end` 도 confirm 과 같게 받음. FRONT 는 이 메시지를 읽지 않음 | ✗ → **YAML `measured`→`aligned` 권장** |
| error | `{type, message}` | 없는 시도·모르는 type 모두 `{type:"error", message}` | ✅ |

### D. API — enum (코드 허용값·DB CHECK 와 비교)

| 항목 | YAML | 실제 | 일치 |
|---|---|---|---|
| UserRole / ExerciseType / Course.availability / Enrollment.status | 각 enum | 코드·CHECK 동일 | ✅ |
| AttemptStatus / feedbackStatus / rubricSource / source / InputDevice | 각 enum | CHECK·Literal 동일 (source·inputDevice·phase 는 422 문구로도 확인) | ✅ |
| PhaseMarker.phase / Event.type / Sample.quality | 각 enum | 동일 | ✅ |
| Feedback.generatedBy | llm / mock | 코드 `llm`, 시드 `mock` | ✅ |
| convergence.order | position_first, rotation_first, together, not_converged, **unknown** | 분석기는 앞 4개만 만든다. `unknown` 은 채점 지표 기본값에만 쓰임 | △ 무해 (지워도 됨) |

### E. DB (WME-DBML 19테이블 ↔ schema.sql 6테이블 + JSON) — 시드 DB 조회

| 논리 테이블 | DBML 내용 | 실제 저장 위치 | 일치 |
|---|---|---|---|
| users | id, login_id, password_hash, display_name, role, department | `users` 4컬럼. login_id·password_hash 없음 | ✅ ([설계] 표기대로) |
| enrollments | id, user_id, course_id, status, completed_at, UNIQUE(user,course) | `enrollments` 동일 + `steps_completed_json` | ✅ |
| **enrollment_steps** | step_id **integer** FK, **completed_at not null** | `steps_completed_json` = 단계 key 문자열 배열. **단계별 완료 시각은 저장하지 않음** | ✗ completed_at → null 허용 또는 "[설계]" 표기 권장 |
| courses | 8컬럼, exercise_type default alignment | `courses` 동일 (+content_json, rubric_json) | ✅ |
| course_guides | objective·prerequisite·material·control·tilt_control / label·content | `content_json.objectives`·`prerequisites`, `alignment.materials`·`controls[keys,effect]`·`tiltControls[keys,effect]` | ✅ |
| course_steps | step_key, sort_order, title, summary | `content_json.steps[id,title,summary]`, 순서 = 배열 순서 | ✅ |
| rubric_criteria | short_name, description, sort_order | `rubric_json[short, text]` | ✅ |
| order_options | option_key, label, hint | `content_json.orderOptions[id,label,hint]` | ✅ |
| alignment_settings | tolerance_px~controller_notice, control_coefficients | `content_json.alignment{tolerancePx, toleranceDeg, umPerPx, startOffset{x,y,theta}, fieldRadius, markLabels{fixed,moving}, controllerNotice}`, `content_json.control` | ✅ |
| (alignment_settings 추가 사항) | tolerance 한 벌 | 서버 판정(WS·분석)은 `content_json.tolerance{position_px, rotation_deg}` 를 쓰고, 화면은 `alignment.tolerancePx` 를 씀 — 값은 같음(4 / 1) | △ 같은 값이 두 곳 |
| judgment_scenarios | situation, order_note, rationale | `content_json.scenario{situation, orderNote, rationale}` | ✅ |
| scenario_observations | label, value, sort_order | `scenario.observations[label,value]` | ✅ |
| check_items | item_key, label, display_order, recommended_rank | `scenario.checkItems[id,label]` (배열 순서 = display_order), `recommendedOrder` 순번 = rank | ✅ |
| attempts 기본 | id~duration_sec, 버전 3개, UNIQUE(enrollment, no), index started_at | `attempts` 컬럼·기본값(input_device keyboard, feedback_status none, duration_sec 0)·인덱스 동일 | ✅ |
| attempts 정렬 결과 | final_dx~converged | `summary_json.final_dx, final_dy, final_dtheta, duration_ms, adjustment_count, overshoot_count, converged` | ✅ |
| attempts 판단 결과 | first_pick_rank, order_distance, top3_overlap, passed | `summary_json.scoring_metrics.firstPickRank·orderDistance·top3Overlap·passed` | ✅ |
| attempts.analysis_detail | 경로 분석·채점 지표 JSON | `summary_json.path_analysis` + `scoring_metrics` | ✅ |
| attempts.phase_markers | JSON | `phase_markers_json` | ✅ |
| attempts.order_option_id | **integer** FK → order_options.id | `answer_json.orderOptionId` = **문자열 key** (`xy-then-theta`) | △ 논리 설계로는 성립, 타입 차이 |
| attempts.reason / submitted_at | 답변 | `answer_json.reason` / `submittedAt` | ✅ |
| attempts.feedback_error | "분류된 실패 문구만" | JSON 문자열 `{message, detail, retryable}` — 원본 예외·키 없음 (client.py 가 원문 대신 분류 문구, 4xx 본문은 redact) | △ 형식 설명만 다름 |
| attempts.feedback_generator / next_step / created_at | 컬럼 | `feedback_json.generatedBy` / `nextStep` / `generatedAt` | ✅ |
| attempts.rubric_source·feedback_status·viewed_at·versions | 컬럼 | 같은 이름 컬럼 | ✅ |
| attempt_check_orders | check_item_id, position | `answer_json.orderedIds` (순번 = position) | ✅ |
| attempt_rubric_scores | score, reason | `rubric_scores_json` / reason 은 저장 안 하고 조회 시 계산(`rubricReasons`) | ✅ (Note 에 적힌 대로) |
| measurements | 15컬럼, quality default ok, UNIQUE(attempt,t_ms), CASCADE | `measurements` 1:1 동일 | ✅ |
| **events.axis** | 컬럼, 값 **x, y, xy, theta** | 컬럼 아님 — `metrics_json.axis` 에 저장해 응답에서 올림. **실제 값은 `xy`·`theta` 두 가지만** (DB distinct 조회) | ✗ Note 값 목록 수정 권장 |
| events 나머지 | id, start/end_ms(end>start), type, metrics not null | `events` 동일 (CHECK·DEFAULT '{}') | ✅ |
| feedback_items | kind good/improve/cannot_judge | `feedback_json.good[]·improve[]·cannotJudge[]` | ✅ |
| feedback_evidence | event_id (실재 검증) | `feedback_json.eventIds[]` | ✅ |
| 앱에만 있고 DBML 에 없음 | — | `content_json.tolerance.note`, `content_json.controller{mapping, note, inputDevices}`, `content_json.scoring[]`(채점 규칙), `content_json.feedbackNotes[]`, LLM 성공 시 feedback_json 의 `llmModel·inputFingerprint·reused` | △ 목록만 보고 |
| DBML 에만 있고 앱에 없음 | — | `users.login_id`, `users.password_hash` [설계], `enrollment_steps.completed_at` | 위 표 참고 |

### HEADER 가 고칠 곳 (의견)

1. YAML `/feedback/viewed` 200 스키마 → `{attemptId, feedbackViewedAt}` (✗)
2. YAML Conflict 설명에서 "이미 확정된 시도 재확정" 삭제 — 실제로는 200·재분석 (✗). 서버를 409 로 막으려면 코드 수정이라 이번 범위 밖
3. YAML WebSocket `measured` → `aligned` (✗)
4. DBML `enrollment_steps.completed_at` not null → null 또는 [설계] (✗)
5. DBML `events.axis` 값 목록 `x, y, xy, theta` → `xy, theta` (✗)
6. △ 항목은 선택: inputDevice default, 201 응답의 `samples: []`, 재제출 허용 설명, feedbackError JSON 문자열, `unknown` enum

---

## 2026-09-14 — BE 9차: web/backend/README.md 옛 내용 정리 (문서만)

- `app/analysis.py` → `app/analyzers/`(`__init__.py` · `alignment.py` · `judgment.py`) 3행으로 교체
- `REST 10개` → `REST 15개 + WebSocket 1개` (`main.py` 라우트 데코레이터로 직접 셈: REST 15, WS 1)
- 파일 표에 `app/scoring.py`, `app/course_judgment.py` 추가. `course_data.py` 설명에 채점 규칙·카탈로그 반영
- 코드 변경 없음. 이후 LLM 키가 올 때까지 대기

HEADER 참고: 같은 README 12행 실행 예시에 아직 `--reload` 가 있다(프롬프트 규칙과 반대).
이번 지시 범위 밖이라 두었다.

---

## 2026-09-14 — BE 8차: judgment checkItems 순서 (설계서 10.3, HEADER 결정)

`app/course_judgment.py` 의 `checkItems` **배열 순서만** `coat, wedge, history, focus, contam` 으로 바꿨다.
`recommendedOrder`·id·라벨은 그대로. 코드 수정 없음. 시드 재적재.

확인한 것(전부 실제 실행):
- 재적재 전후 14건 `rubric_scores_json` diff 없음 (판단 시도 [0,0,0,0] / [2,2,2,2] 그대로)
- `GET /api/courses/defect-report` 의 `scenario.checkItems` = coat, wedge, history, focus, contam /
  `recommendedOrder` = wedge, focus, contam, coat, history → 순서 다름, id 집합 같음, 라벨 그대로
- 최상위 `scenario` 와 `content.scenario` 의 순서 동일

이제 서버가 권장 순서를 화면 초기 순서로 내려보내지 않는다.
FRONT 의 `initialOrder` 섞기는 설계서 10.3 대로 이중 안전장치로 남긴다(지우지 않음).

LLM 실제 호출은 여전히 없다(API 키 없음).

---

## 2026-09-14 — BE 7차: endedAt · scenario 최상위 · capAt:1 · tiltControls (+ 환경 복구)

HEADER 프롬프트(2026-09-14)의 1~4 를 반영했다. 전부 실제로 돌려서 확인했다.

**환경 복구 (개인 맥북)**
- `.venv` 가 다른 노트북에서 넘어온 것이라 실행되지 않았다(없는 경로 `/Users/kimjinsu/...`, `/opt/anaconda3` 를 가리킴).
  Homebrew Python 3.11 로 `.venv.nosync` 에 새로 만들고 `.venv` 는 그 링크로 뒀다(iCloud 동기화 제외, 명령은 그대로).
  옛 venv 는 iCloud 가 파일을 안 내려받아 지우지 못해 `.venv-broken-old.nosync` 로 옮겨 뒀다.
- `.env` 13행에 따옴표 `"` 한 줄이 남아 `source .env` 가 실패했다 → 그 줄만 삭제. **키는 여전히 비어 있다.**
- `web/backend/.gitignore` 추가(`.venv` 링크, `*.nosync/`).

**1. judgment `endedAt`** — `main.py` `post_submission` 에 `ended_at = COALESCE(ended_at, 제출시각)`.
- 확인: 판단 실습 생성(endedAt null) → 제출 → endedAt = submittedAt
- 확인: 정렬 실습 생성 → WS 150샘플 → 확정 → 1.5초 뒤 제출 → endedAt 이 확정 시각 그대로(제출 시각과 다름)

**2. `scenario` 최상위** — `repo.py` `course_row_to_dict` 에 한 줄. `content` 는 그대로.
- 확인: `GET /api/courses/defect-report` 최상위 scenario 6키 / `content.scenario` 유지 / `photo-align` 은 `scenario: null`

**3. 기준2 축 간섭 modifier `adjust:-1` → `capAt:1`** — `course_data.py` 데이터만. `scoring.py` 무수정.
- 확인: 시드 전후 14건 `rubric_scores_json` diff 없음
- 확인: 채점기 직접 호출 — together+간섭 1(이전 규칙이면 0) / position_first·rotation_first+간섭 1 / 간섭 없음 2

**4. `alignment.tiltControls`** — `course_data.py` alignment 안에 W/S·A/D 2항목. 코드 수정 없음.
- 확인: `GET /api/courses/photo-align` 의 `alignment.tiltControls` 2항목, `controls` 는 3개 그대로

**FRONT 가 지울 수 있게 된 것**
- `scenario` 를 `content.scenario` 에서도 찾는 보정 코드 → 이제 최상위 `course.scenario`
- `src/data/controllerSettings.ts` 의 `KEYBOARD_TILT_CONTROLS` 상수 → `course.alignment.tiltControls`

**HEADER 확인 필요**
- `실습유형_설계.md` 10.3 의 checkItems 순서 변경이 서버에 반영되어 있지 않다.
  `course_judgment.py` 와 DB 의 checkItems 가 `wedge,focus,contam,coat,history` 로 **recommendedOrder 와 똑같다.**
  서버가 권장 순서를 그대로 내려보내는 상태이며, 지금은 FRONT 의 섞기 코드만 막고 있다.
  이번 지시 목록에 없어서 고치지 않았다. 설계서 7.3 순서(coat,wedge,history,focus,contam)로 바꾸면 데이터 한 곳이고,
  채점은 recommendedOrder 만 보므로 판단 시드 점수는 바뀌지 않는다.

검증용 테스트 시도(u-6)가 DB 에 남아 시드를 한 번 더 돌려 지웠다(최종 14건 점수 다시 동일 확인).
LLM 실제 호출은 여전히 없다(API 키 없음).

---

## 2026-09-13 — BE 6차: 채점을 데이터로 (A) · exercise_type (B) · judgment 실습 (C)

`기획/설계/실습유형_설계.md` 규격대로 A → B → C 순서로 진행했다.

**A. 채점을 과정 데이터로**
- 분석기가 `summary_json.scoring_metrics`(평평한 딕셔너리)를 만든다. 기존 필드는 그대로 뒀다.
- `app/scoring.py` 를 규칙 해석기로 다시 썼다. threshold / categorical /
  modifiers(adjust·capAt) / `{metric}` 치환만 지원한다. **도메인 단어가 하나도 없다**(검사 완료).
- 정렬 실습 채점 규칙을 `content_json.scoring` 으로 옮겼다.
- **시드 12건 재채점 결과 바뀐 점수 0건.** 추가로 옛 채점기와 새 규칙을 11만 조합으로
  대조했고, 차이는 아래 한 가지 경우뿐이다.

**B. exercise_type**
- `courses.exercise_type` 추가(유일한 스키마 변경). 기존 DB 도 자동으로 컬럼이 붙는다.
- 과정 응답에 `exerciseType` 추가(평평한 구조 유지).
- `app/analysis.py` → `app/analyzers/alignment.py`. `app/analyzers/__init__.py` 가 유형으로 고른다.
  정렬 실습 동작은 그대로다.

**C. judgment 실습**
- `app/analyzers/judgment.py` — firstPickRank / orderDistance / top3Overlap /
  answerLength / durationMs / passed (설계서 7.5절).
- `defect-report` 를 설계서 7절 그대로 시드에 넣었다(`available`, 시나리오·루브릭·채점 규칙 전부 데이터).
- 제출 검증을 유형별로 갈랐다. judgment 는 `{orderedIds, reason}` 이고 항목 누락·중복·
  없는 항목·빈 배열 전부 422.
- u-1 에게 배정 + 시연용 시도 2건(1차 [0,0,0,0] → 2차 [2,2,2,2]).
- LLM 프롬프트를 과정 데이터에서 조립하게 바꿨다. 시스템 프롬프트가 유형 중립이라
  **judgment 과정도 코드 변경 없이 피드백이 나온다**(가짜 응답으로 확인).

확인한 것(전부 실제 실행): 시드 점수 무변화 0건 / exerciseType 응답 /
judgment 생성→제출→채점 / 잘못된 orderedIds 422 5종 / 정렬 실습 생성→WS→확정→제출→채점 /
동시 요청 30개 전부 200 / judgment LLM 경로(가짜 응답, 지어낸 eventId 저장 거부까지).

**HEADER 확인 필요 3건**
1. 설계서 5.3 의 `axisInterference adjust:-1` 은 옛 코드와 한 경우에서 다르다.
   `convergenceOrder=together`(1점) + 축 간섭이면 옛 코드는 1 유지, 새 규칙은 0.
   시드에는 이 조합이 없어 점수 변화는 없었다. 옛 동작을 원하면 데이터에서
   `adjust:-1` → `capAt:1` 로 바꾸면 된다(코드 수정 없음).
2. 설계서 4절의 지표 8개 외에 `rotationOutsideComfort` / `rotationOutsideRange` 불리언을
   추가했다. modifiers 의 `when` 이 불리언만 받으므로 "회전은 modifier"를 구현하려면 필요했다.
3. 과정별 표현 주의사항을 `content_json.feedbackNotes` 로 넣었다(프롬프트에 NOTES 로 들어간다).

LLM 실제 호출은 여전히 없다(API 키 없음).

---

## 2026-09-13 — BE 5차: 기준2 재정의(HEADER) + 기준1 등급 수정

- **기준2(조정 순서)**: HEADER 지시대로 `theta-then-xy` 도 2점으로 바꿨다.
  보는 것은 "축을 섞지 않고 한 축씩 정리했는가"이고, 회전을 먼저 해서 위치가 틀어진 손해는
  기준3(보정 효율)에서 이미 반영되므로 두 번 깎지 않는다.
  축 간섭 시 한 단계 내림 / 적어 낸 순서와 기록이 다르면 만점 불가 — 둘 다 그대로 유지.
- **시드 12건 재계산**: 이제 people.ts 의 rubric 값은 "어떤 시도였는지"(궤적 모양·고른 순서·
  이유의 자세함)를 정하는 데만 쓰고, 저장하는 점수는 채점기가 그 궤적을 실제로 읽어 계산한다.
  결과는 people.ts 값과 거의 같고, 달라진 건 기준2가 0→2 로 바뀐 2건뿐이다(의도한 변화).

작업 중 발견해 함께 고친 것 2개:
- **기준1(정렬 정확도)이 등급을 못 가렸다.** "허용 범위 안이면 무조건 2점"이라 11건 전부 2점이
  나왔다. HEADER 원래 지시("허용 범위 대비 얼마나 여유 있는지")를 덜 구현한 것이라,
  허용 범위의 60% 안쪽이면 2점 / 안이지만 경계에 가까우면 1점 / 밖이면 0~1점으로 고쳤다.
- **궤적 생성기의 "1점 의도" 궤적이 실제로는 허용 범위 안이었다.** 최종 오차 값을 조정해
  세 등급이 실제로 갈리는 것을 확인했다.

확인한 것: 회전 먼저+정직 보고 → [2,2,2,2] / 순서 불일치 → 기준2 만점 불가 1 /
짧은 답변 → 기준4 0, 중간 길이 → 1 / 축 간섭 → 기준2 2에서 1로 내림 /
수렴 실패 → 기준1·2 모두 0. 매니저 화면 루브릭 평균이 0·1·2 로 갈리는 것,
동시 30개 요청 전부 200 도 다시 확인했다.

LLM 실제 호출은 여전히 없다(API 키 없음).

---

## 2026-09-13 — BE 4차: 동시 요청 500 수정 / 규칙 기반 채점 / 사용자 조회 / CORS

FRONT 보고 4건 전부 처리하고 실제로 돌려서 확인했다.

1. **동시 요청 500 수정** — `db.py` connect() 에 `check_same_thread=False`, `timeout=5.0`,
   `PRAGMA journal_mode=WAL`, `busy_timeout=5000` 추가.
   원인 확인까지 함: 수정 전 코드로 되돌려 같은 부하를 주니 동시 30개 중 18개가 500,
   수정 후에는 동시 40개 전부 200. 읽기 20 + 쓰기 10 섞어도 전부 200.
   → FRONT 가 넣어 둔 "요청 한 줄로 세우는" 임시 코드는 지워도 된다.

2. **규칙 기반 임시 채점 (HEADER ⓑ 안)** — `app/scoring.py` 신규.
   제출 시점에 채점해 저장하고 `rubric_source='rule'`, LLM 성공 시 덮어쓰고 `'llm'`.
   응답에 `rubricSource` 와 `rubricReasons`(규칙일 때만, 저장 안 하고 매번 계산) 추가.
   attempts 에 `rubric_source` 컬럼 추가 + 기존 DB 도 자동으로 컬럼이 붙게 했다.
   확인: 키 없이 제출만으로 [2,2,2,2] 나옴 / LLM 검증 실패해도 점수·답변 유지 /
   LLM 성공하면 source 가 llm 으로 바뀜(가짜 응답). 시드 12건은 `rule` 로 채웠다.

3. **사용자 조회 추가** — `GET /api/users` (role 필터), `GET /api/users/{id}`.
   없는 사용자 404, 잘못된 role 422 확인.

4. **CORS 에 4173 추가** — vite preview(빌드본)용.

주의할 점 2개:
- 기준2(조정 순서)를 HEADER 지시("기록 패턴과 고른 순서가 일치하는지")대로만 하면
  정직하게 보고한 사람이 0점이 된다. 루브릭 본문이 "절차를 지켰는가"이므로
  **기록에서 읽힌 실제 순서로 매기고, 적어 낸 순서가 기록과 다르면 만점을 주지 않는** 방식으로 했다.
  HEADER 확인 필요.
- WAL 을 켜면서 `wme.db-wal` / `wme.db-shm` 파일이 생긴다. `.gitignore` 의
  `data/local/*.db` 로는 안 걸러진다. `data/local/*.db-*` 한 줄 추가 필요.

LLM 실제 호출은 여전히 없다(API 키 없음).

---

## 2026-09-12 — BE 3차: 시드를 프론트에 맞춤 + 조작 계수 추가

지시받은 2건:
- **시드 교체**: 사용자 2명 → 담당자 최태원 + 학습자 8명(u-1 김진수 ~ u-8 문예린),
  시도 12건. people.ts 의 이름·소속·완료 단계·루브릭 값을 그대로 옮겼다.
  궤적은 합성 생성기를 쓰되 **루브릭 3번(보정 효율)이 낮을수록 과잉 보정이 많게** 만들었고,
  저장된 과잉 보정 횟수는 그 궤적을 분석기가 실제로 읽어 계산한 값이다.
  제출한 시도는 status='feedback_ready' + answer + rubric_scores + 규칙 기반 샘플 피드백
  (generatedBy='mock'), 미제출 시도는 'aligned'. u-1 / u-instructor id 유지.
- **control 블록**: courses.content_json 에 HEADER 확정값 그대로 추가. tolerance 4px/1.0° 확정.

추가로 맞춘 것(전부 web/backend 안, 안 하면 연결이 안 됨):
- 과정 응답을 프론트 Course 타입과 같은 **평평한 구조**로 바꿨다.
  기존에는 objectives/steps/rubric 이 content 안에 중첩돼 있어 course.objectives 로 못 읽었다.
  alignment(허용오차·시작오프셋·조작키 안내·준비물) 블록도 추가했다.
- 카탈로그 5개 과정을 전부 시드했다. photo-basics 에 배정이 걸려 있어서 필요했다.
- 과정 버전을 프론트와 같은 `course-2.0.0` 으로 맞췄다 (기존 align-1.0.0).

분석기 수정 1건: 속도를 200ms 창으로 재면서 움직임이 앞뒤로 번져 **0.5초 정지가 지워지고
보정 구간이 전부 하나로 붙는** 문제가 있었다. 창의 끝 샘플만 표시하도록 고치고
SEGMENT_GAP_MS 를 250 으로 낮췄다. 기존 검증 5케이스는 그대로 통과한다.

확인한 것(실제 호출): instructor/overview 8줄 / courses.control 응답 / u-1 시도 3건 /
카탈로그 5개 / 시도 0건인 u-6 로 새 실습 생성→WS→확정→제출→피드백 503(답변 보존).
LLM 실제 호출은 여전히 없다(API 키 없음).

---

## 2026-09-12 — BE 2차: 서버에 남은 '이상 탐지 시절' 필드 제거

HEADER 결정(과정 ID photo-align / input_device 승인 / 기울기 변환은 프론트) 반영하고,
서버 쪽 이전 컨셉 필드를 정렬 실습 기준으로 교체했다. DB 재생성 + 재시드 후 실제로 호출해 확인.

지시받은 5건:
- 제출 본문: `{evidenceIds, checkItemId, reason}` → `{orderOptionId, reason}`.
  검증은 course.content.orderOptions 의 id 4개와 대조. answer_json 형태도 함께 교체
- phase: idle/moving/settling/ended → idle/aligning/confirmed/submitted.
  **confirmed 에서 측정 종료 + 분석** (기존 ended 자리)
- 상태: measuring/measured → aligning/aligned. schema.sql CHECK, repo 전이표, main.py, seed.py 전부
- events 의 axis: 컬럼 추가 없이 metrics_json 안에 저장하고 응답에서 위로 올린다
- data/local/wme.db 재생성 + 재시드 완료

대조 중 추가로 찾은 어긋남 4건도 함께 맞췄다(전부 web/backend 안):
- 단계 ID: concept/baseline/practice/judgement → concept/marks/align/submit (프론트 StepId 기준)
- summary 응답을 camelCase 로 (finalDx 등). DB 저장은 6절 snake_case 유지
- events.metrics 에 errorBefore / errorAfter 추가 (프론트 AlignmentEvent.metrics)
- samples 응답에 dx / dy / dTheta 추가 / LLM 출력 evidenceIds → eventIds

확인한 것(실제 호출): 과정 조회 / 시도 생성(aligning) / WS 300샘플 + phase confirmed(aligned) /
잘못된 orderOptionId 422 / 정상 제출 / 잘못된 상태 전이 409 두 종류.
LLM 성공 경로는 **가짜 응답으로만** 검증했다. API 키가 없어 실제 호출은 아직 없다.

---

## 2026-09-12 — BE 1차: DB·분석·API·LLM 골격

정렬 실습으로 바뀐 과정에 맞춰 백엔드 1차를 만들고 실제로 돌려서 확인했다.

- `web/backend/schema.sql` — 6테이블. `실습과정_정렬.md` 9절 반영(measurements 에서 anomaly_score 제거,
  wafer_x/y/theta 추가 / events type 은 adjustment·overshoot·manual / summary·rubric 교체).
  sqlite3 로 생성해 에러 없음 확인.
- `app/analysis.py` — **규칙 기반 정렬 경로 분석**(모델 학습 없음). 보정 구간, 과잉 보정 횟수,
  축 간섭, 수렴 패턴(위치 먼저/회전 먼저)을 계산해 events 와 summary 를 만든다. 합성 궤적 5종으로 검증.
- `app/seed.py` — 과정 1개(`photo-align`) + 데모 사용자 2명 + 시도 2건(합성, `source='mock'`).
- `app/main.py` — REST 10개 + WS 1개. 시드 데이터를 실제로 응답하는 것까지 curl 로 확인.
  준비 중 과정 409 / 없는 근거 ID 422 / attempt_no 최대값+1 동작 확인.
- `app/llm/` — 입력 구성·출력 스키마·**응답 검증**·재시도 분리. **API 키는 아직 없다.**
  키 없을 때 503 + 답변 보존 + 재시도 가능까지 확인했고, 성공 경로는 가짜 응답으로만 검증했다.
  실제 모델 호출은 아직 한 번도 하지 않았다.

**FRONT 세션에 필요한 변경 3건** — 프론트는 건드리지 않았다.
`src/types/index.ts` 가 아직 이전 컨셉(anomalyScore, anomaly_candidate, ObservationSummary)이고,
과정 ID 가 `stage-anomaly` 로 하드코딩돼 있다. 서버는 `photo-align` 과 새 지표를 쓴다.

---
