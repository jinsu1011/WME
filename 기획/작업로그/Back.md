# Back 세션 작업 로그

> 작업을 끝낼 때 **맨 위에** 한 칸 추가한다. 자기 파일만 쓰므로 다른 세션과 충돌하지 않는다.
> Header 세션이 이 로그들을 모아 `기획/PROGRESS.md` 에 반영한다.

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
