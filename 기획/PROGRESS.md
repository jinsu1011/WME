# 진행 상황

> 이 파일은 **완료 · 진행 중 · 다음 작업**만 담는다. 결정의 배경은 `../PROJECT_HEAD.md`,
> 전체 계획은 `SEMI_ON_PROJECT_PLAN.md` 를 본다.
> 세션별 담당은 `기획/프롬프트/`, **이어받기는 루트의 `이어서작업.md`** 를 본다.
> 최종 수정: 2026-09-14 저녁 마감 (HEADER) — 실제 코드·DB·서버와 대조

## 한 줄 상태

**구현은 거의 끝났다.** 프론트·백엔드 연결, 범용성 구조(채점 데이터화 · `exercise_type` ·
조작 없는 judgment 실습), 3D 장비 뷰(노광·현상 연출 포함)까지 동작한다.
남은 것은 **LLM 실제 호출(9/15 키 수령) · 센서 실측 · 제출 문서**다.

**수업은 9/15 에 시작한다.** 제출물 양식·템플릿 파일은 아직 받지 못했다.

## 완료

### 기획·결정
- [x] 서비스명 **WME (We Make Experts)** 확정
- [x] 주제·방향 확정 — B2B 사내 기술교육 플랫폼
- [x] 실습 과정을 **마스크·웨이퍼 정렬 실습**으로 전환, `설계/실습과정_정렬.md` 작성
- [x] 포지셔닝 확정 — "실장비 대체"가 아니라 "투입 전 판단 훈련"
- [x] 세션 4개 분담, 프롬프트(`기획/프롬프트/`), 세션별 로그(`기획/작업로그/`)
- [x] Front·Back 교차 확인 — 불일치 7건 발견·배정
- [x] **결정 13건 확정** — 목록은 `이어서작업.md` 3.5단계 (9/14 추가: 12 `alignment.tiltControls`, 13 설치물 `.nosync`)
- [x] `설계/실습유형_설계.md` — 범용성 규격(채점을 데이터로, 실습 유형). 10.3 문서·데이터 모두 반영(9/14)
- [x] `설계/DB설계.md` 전면 재작성 — 실제 `schema.sql` 기준. 행 수·과정 상태 9/14 정정 (**제출물**)
- [x] `설계/API명세서.md` 작성 — REST 15 + WS 1 (**제출물**)
- [x] `제출/발표자료_초안.md` — 슬라이드 8장 설계 + 예상 질문
- [x] 루트 `README.md`·`PROJECT_HEAD.md` 0절 현재 상태로 갱신(9/14)

### 프론트엔드 (`web/frontend`)
- [x] React + Vite + TypeScript + Tailwind v4 + Recharts + React Router + Three.js
- [x] 화면 11개(라우트) — `/login`, `/learn`, `/learn/status`, `/learn/courses`, `/learn/records`,
      `/courses/:id`, `/attempts/new`, `/attempts/:id/result`,
      `/instructor`, `/instructor/learners`, `/instructor/learners/:id`
- [x] 실습 유형 2종 — `photo-align`(alignment) / `defect-report`(judgment, 조작 없음)
- [x] **mock / server 전환** — `npm run dev`(mock, 5173) / `npm run dev:server`(server, 5174)
- [x] **3D 장비 뷰** — 스테이지·웨이퍼·마스크, 마우스 시점 회전(줌·팬 끔), WebGL 불가 시 2D 대체
- [x] **정렬 확정 → 노광 → 현상 → 오차만큼 어긋난 패턴** 연출
- [x] 조작 키를 물리 위치(`event.code`)로 판정 — 한글 입력 상태에서도 동작
- [x] 키보드 기울기(W/A/S/D) + 수평 판정 + 회전 잠금 (저장값에는 넣지 않음)
- [x] Web Serial 수신 코드(`src/input/serial.ts`, `TiltSource.ts`) — 파싱·판정은 주입 함수로 확인
- [x] **보정 코드 2개 제거(9/14)** — `scenario` 는 `course.scenario` 만, 기울기 키 안내는 `course.alignment.tiltControls`.
      mock 시드에도 같은 값. `initialOrder` 섞기는 유지. 타입·빌드·린트, mock·server 브라우저 확인
- [x] `node_modules` 를 `deps.nosync` + 링크로 재설치(9/14) — iCloud 폴더에서 깨져 있었음

### 백엔드 (`web/backend`)
- [x] `schema.sql` 6테이블 + `courses.exercise_type`
- [x] `main.py` **REST 15개 + WebSocket 1개**
- [x] 분석기 `app/analyzers/` — alignment(규칙 기반, 모델 학습 없음) / judgment
- [x] 채점을 과정 데이터(`content_json.scoring`)로 — `scoring.py` 는 규칙 해석기
- [x] `rubric_source` — `rule`(규칙 기반 임시 채점) / `llm`
- [x] 동시 요청 500 수정(WAL·busy_timeout)
- [x] `llm/` 입력 구성·출력 스키마·응답 검증·재시도, 제공자 자동 선택(anthropic/openai), 오류 메시지 키 노출 차단
- [x] **BE 7~9차(9/14, HEADER 서버 확인)** — judgment `ended_at`, `scenario` 최상위, 조정 순서 기준 `capAt:1`,
      `alignment.tiltControls`, judgment `checkItems` 순서를 권장 순서와 다르게, `web/backend/README.md` 정리.
      시드 14건 점수 무변화
- [x] 시드 — 학습자 8 + 담당자 1, 배정 17, 과정 5(실습 가능 2), 시도 14(정렬 12 + 판단 2). 9/14 저녁 재적재 상태

### 센서 (`hardware/`, `data/`)
- [x] Arduino UNO + MPU6050 인식, 50Hz `WME,` 샘플 수신(시리얼 모니터 기준)
- [x] 펌웨어 `wme_sensor.ino`, 수집 `data/capture_drift.py`, 분석 `data/analyze_drift.py`
- [x] 평평한 자세 원시값 진단 — 이전의 pitch 60° 고정 현상은 **재현되지 않음**(원인 미확정)

## ⚠️ 과제 요건 수령 (2026-09-14 밤) — 우선순위 전환

과제 PDF 를 받았다 → **`기획/과제요건.md`** 가 기준. **기획·설계를 평가하고 구현은 점수가 아니다.**
제출물: `{반_이름}_WME-개요.pdf`(UI 흐름도 캡처 필수) · `-API.yml`(OpenAPI) · `-DB.dbml`. **3일차 13:30 마감(미준수 0점), 14:30 발표 5분.**
사용자 지시: **3D·센서 유지**, PPT 는 추후. HEADER 결정 R1~R9 는 `과제요건.md` 5절.

### HEADER 가 9/14 밤에 만든 것
- [x] `기획/과제요건.md` — 과제 PDF 요약·평가 기준·제출물·결정 R1~R9·불일치 M1~M3
- [x] `기획/설계/서비스개요.md` — 개요 PDF 원본 (문제 정의·액터 4종·기능 요구사항 FR 21개·예외·고려사항)
- [x] `기획/설계/화면설계.md` — 화면 13개(S-01~12, S-07a)·전체 흐름·UI↔API↔DB 대조표·캡처 목록 22장
- [x] **`제출/WME-DB.dbml` 초안 → 논리 설계로 정규화(R6)** — 19테이블·그룹 4개, M:N 4개(배정↔단계, 시도↔루브릭, 시도↔확인 항목, 피드백↔근거).
      시연 앱(6테이블 + JSON)과의 매핑은 테이블 Note·화면설계 4절. API 응답 구조는 그대로
- [x] **`제출/WME-API.yml` 초안** (OpenAPI 3.0.3) — `$ref` 43개 전부 연결, 서버 경로 14개 전부 포함 + [설계] 로그인,
      **실제 GET 응답 12종 스키마 대조 불일치 0**
- [x] `제출/체크리스트.md` 새 기준으로 교체, 프롬프트 BACK·FRONT 갱신

## 다음 작업

### 사용자
- [ ] **반·이름 알려주기** → 제출 파일명 확정
- [ ] 발표자료(PPT) 형식 결정 (추후)
- [ ] 9/15 LLM 키 수령

### HEADER
1. [ ] BACK·FRONT 결과 받아 YAML·DBML·화면설계 보정
2. [ ] dbdiagram.io · Swagger Editor 에서 실제로 열어 확인 (브라우저 필요)
3. [ ] 개요 PDF 조립 — 서비스개요 + 캡처 흐름도(강조 박스·화살표·설명) + ERD 캡처 + Swagger 캡처 + 고려사항
4. [ ] `DB설계.md`·`API명세서.md` 는 원본 자료로 두고, 제출물과 어긋나지 않게 exercise_type·judgment 보강
5. [ ] 발표 5분 구성 (PPT 결정 후)

### BACK (순서대로)
- [ ] `web/backend/README.md` `--reload` 삭제
- [ ] **`제출/WME-API.yml` 실제 서버 대조** — POST·PATCH 응답, 오류 코드·본문, WebSocket 메시지, enum
- [ ] **`제출/WME-DB.dbml` 매핑 대조** — 논리 테이블의 모든 컬럼이 시연 앱 어딘가(JSON 포함)에 실제로 있는지, enum·NULL·기본값 (schema.sql 은 바꾸지 않음)
- [ ] LLM 실제 호출 (키 받으면). 로그인 API 는 구현하지 않는다(설계만)

### FRONT (BACK 다음)
- [ ] **M1** 진도 기록 API 연결 · **M2** 피드백 열람 API 연결
- [ ] **UI 흐름도 캡처 22장** → `제출/캡처/` (`화면설계.md` 5절)
- [ ] D 키 기울기 확인
- [ ] (문서 끝난 뒤) 실물 센서 브라우저 확인

### SENSOR — 목표: 모형 움직임이 화면에 실시간으로 보이게
- [x] 9/14 밤 회사 맥북에서 보드 인식 확인 (`/dev/cu.usbmodem101`). **보드는 임시 1Hz 펌웨어** (보드 시각 1000ms 간격)
- [ ] arduino-cli 설치(사용자 허락) → **저장소 50Hz 스케치 재업로드** → 50Hz 출력 확인
- [ ] 크롬 mock 화면 `모형 컨트롤러 연결` → 기울기·수평 판정·회전·끊김·키보드 복귀 확인표 (방향 문제는 기록만)
- [ ] (그 뒤) 3분 정지 드리프트 → 되돌아오기 6회 → 축 부호 → 모형 조립 후 30초

## 열린 결정

- **수평 판정 허용 범위** — 지금 프론트 상수 `LEVEL_TOLERANCE_DEG` ±2.0°. 센서 흔들림 측정 후 확정 → 서버 `content_json` 으로
- **회전(θ)을 센서 yaw 로 받을지** — 정지 3분 밀림 ≤ 3° **그리고** 되돌아오기 오차 ≤ 2° 면 채택.
  못 넘으면 화면 버튼·키보드 유지

## 막힌 것 · 확인 필요

- **제출 파일명의 반·이름** — 과제 요건은 받았다(`기획/과제요건.md`). 반·이름만 미정
- **제출 날짜** — 3일차 13:30. 수업이 9/15 시작이면 9/17 로 보이나 **확인 필요**
- 배포(호스팅) — 과제 요건에 요구 없음
- **센서 환경** — 회사 컴퓨터에는 아두이노 도구가 없고 보드도 연결돼 있지 않다. 보드 펌웨어(50Hz/1Hz) 기록이 서로 다르다
- **LLM API 키** — 9/15 회사에서 OpenAI 키를 받기로 했다. 서버는 키만 넣으면 되는 상태

## 하지 않은 것 (오해 방지)

- **LLM 실제 호출: 0회.** 피드백은 규칙 기반 샘플이며 화면에 그렇게 표시한다
- **센서 실측(드리프트·부호·되돌아오기): 미측정.** 브라우저에서 실센서로 실습한 적 없음
- 개요 PDF·UI 흐름도 캡처·발표 대본: 미작성 (API YAML·DB DBML·서비스개요·화면설계는 초안)
- 로그인 API·비밀번호 해시: **설계에만 있다**(`[설계]`). 시연 앱은 데모 로그인
- 화면·DB 의 학습 기록은 시연용 시드이며 실제 교육생 기록이 아니다
- 허용 오차(4px / 1.0°)는 **교육 과정 설정값**이며 실제 장비의 정렬 정밀도가 아니다
