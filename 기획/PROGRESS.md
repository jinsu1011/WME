# 진행 상황

> 이 파일은 **완료 · 진행 중 · 다음 작업**만 담는다. 결정의 배경은 `../PROJECT_HEAD.md`,
> 전체 계획은 `SEMI_ON_PROJECT_PLAN.md` 를 본다.
> 세션별 담당은 `기획/프롬프트/`, **이어받기는 루트의 `이어서작업.md`** 를 본다.
> 최종 수정: 2026-09-14 (회사 컴퓨터 / HEADER) — 실제 코드·DB 와 대조해 옛 내용 정리

## 한 줄 상태

**구현은 거의 끝났다.** 프론트·백엔드 연결, 범용성 구조(채점 데이터화 · `exercise_type` ·
조작 없는 judgment 실습), 3D 장비 뷰(노광·현상 연출 포함)까지 동작한다.
남은 것은 **센서 실측 · LLM 실제 호출 · 제출 문서**다.

**수업은 9/15 에 시작한다** (9/14 확인). 제출물 양식·템플릿 파일은 아직 받지 못했다.

## 완료

### 기획·결정
- [x] 서비스명 **WME (We Make Experts)** 확정
- [x] 주제·방향 확정 — B2B 사내 기술교육 플랫폼
- [x] 실습 과정을 **마스크·웨이퍼 정렬 실습**으로 전환, `설계/실습과정_정렬.md` 작성
- [x] 포지셔닝 확정 — "실장비 대체"가 아니라 "투입 전 판단 훈련"
- [x] 세션 4개 분담, 프롬프트(`기획/프롬프트/`), 세션별 로그(`기획/작업로그/`)
- [x] Front·Back 교차 확인 — 불일치 7건 발견·배정
- [x] **결정 11건 확정** — 목록은 `이어서작업.md` 3.5단계
- [x] `설계/실습유형_설계.md` — 범용성 규격(채점을 데이터로, 실습 유형)
- [x] `설계/DB설계.md` 전면 재작성 — 실제 `schema.sql` 기준 (**제출물**, exercise_type 반영 필요)
- [x] `설계/API명세서.md` 작성 — REST 15 + WS 1 (**제출물**, judgment 반영 필요)
- [x] `제출/발표자료_초안.md` — 슬라이드 8장 설계 + 예상 질문

### 프론트엔드 (`web/frontend`)
- [x] React + Vite + TypeScript + Tailwind v4 + Recharts + React Router + Three.js
- [x] 화면 11개(라우트) — `/login`, `/learn`, `/learn/status`, `/learn/courses`, `/learn/records`,
      `/courses/:id`, `/attempts/new`, `/attempts/:id/result`,
      `/instructor`, `/instructor/learners`, `/instructor/learners/:id`
- [x] 실습 유형 2종 — `photo-align`(alignment) / `defect-report`(judgment, 조작 없음).
      `/attempts/new` 가 유형을 보고 화면을 고른다
- [x] **mock / server 전환** — `npm run dev`(mock, 5173) / `npm run dev:server`(server, 5174).
      mock 은 발표 백업이라 지우지 않는다
- [x] **3D 장비 뷰** — 스테이지·웨이퍼·마스크, 마우스 시점 회전(줌·팬 끔), WebGL 불가 시 2D 대체
- [x] **정렬 확정 → 노광 → 현상 → 오차만큼 어긋난 패턴** 연출
- [x] 조작 키를 물리 위치(`event.code`)로 판정 — 한글 입력 상태에서도 동작
- [x] 키보드 기울기(W/A/S/D) + 수평 판정 + 회전 잠금 (저장값에는 넣지 않음)
- [x] Web Serial 수신 코드(`src/input/serial.ts`, `TiltSource.ts`) — 파싱·판정은 주입 함수로 확인

### 백엔드 (`web/backend`)
- [x] `schema.sql` 6테이블 + `courses.exercise_type`
- [x] `main.py` **REST 15개 + WebSocket 1개**
- [x] 분석기 `app/analyzers/` — alignment(규칙 기반 정렬 경로 분석, 모델 학습 없음) / judgment
- [x] 채점을 과정 데이터(`content_json.scoring`)로 — `scoring.py` 는 도메인 단어 없는 규칙 해석기.
      시드 재채점 점수 변화 0건
- [x] `rubric_source` — `rule`(규칙 기반 임시 채점) / `llm`
- [x] 동시 요청 500 수정(WAL·busy_timeout) — 동시 40개 전부 200
- [x] `llm/` 입력 구성·출력 스키마·응답 검증·재시도, 제공자 자동 선택(anthropic/openai),
      오류 메시지에 API 키가 실리던 결함 차단
- [x] 시드 — 학습자 8 + 담당자 1, 배정 17, 과정 5(실습 가능 2: `photo-align`·`defect-report`),
      시도 14(정렬 12 + 판단 2). *DB 에서 직접 조회, 2026-09-14*

### 센서 (`hardware/`, `data/`)
- [x] Arduino UNO + MPU6050 인식, 50Hz `WME,` 샘플 수신(시리얼 모니터 기준)
- [x] 펌웨어 `wme_sensor.ino`, 수집 `data/capture_drift.py`, 분석 `data/analyze_drift.py`
- [x] 평평한 자세 원시값 진단 — 이전의 pitch 60° 고정 현상은 **재현되지 않음**(원인 미확정)

## 다음 작업

### HEADER ← 문서
1. [ ] `설계/DB설계.md` · `설계/API명세서.md` 에 `exercise_type` · judgment 제출 본문 반영 (**제출물**)
2. [ ] `설계/화면설계.md` — 화면 11개 + judgment 실습 화면 (지금 비어 있음)
3. [ ] `PROJECT_HEAD.md` 0절·5절 갱신 — "서비스 코드 없음" 등 옛 상태가 남아 있다
4. [ ] `설계/실습과정_정렬.md` 11절 — 확정값(허용 오차·조작 계수) 반영
5. [ ] `제출/프로젝트기술서.md` — **양식 받은 뒤** → 발표 대본 5분 → 발표자료

### BACK
- [x] judgment 제출 시 `ended_at` 저장 — BE 7차, HEADER 코드·서버 확인(9/14)
- [x] 과정 응답 `scenario` 최상위 — BE 7차, 확인
- [x] 조정 순서 기준 `axisInterference` `adjust:-1` → `capAt:1` — BE 7차, 시드 14건 점수 무변화, 확인
- [x] `alignment.tiltControls` 추가 — BE 7차, 확인
- [ ] **judgment `checkItems` 순서를 권장 순서와 다르게** (설계서 10.3 — 문서만 바뀌고 데이터 미반영이었음)
- [ ] **LLM 실제 호출 1회 성공** — 키 확보 후

### FRONT
- [ ] **실물 센서를 브라우저에 꽂아 실제 수신 확인** (아직 아무도 못 함)
- [ ] 보정 코드 제거 — `content.scenario` 도 찾는 코드 → `course.scenario` / 상수 `KEYBOARD_TILT_CONTROLS` → `course.alignment.tiltControls`
      (서버 준비 완료. `initialOrder` 섞기는 **지우지 않는다** — 설계서 10.3)
- [ ] 3D 겉모습 다듬기, `coatingScene.ts`(스핀 코팅 데모) 붙이기 — 계획만 있음

### SENSOR
- [ ] 3분 정지 드리프트 → 되돌아오기 6회 → 축 부호 → 모형 조립 후 30초

## 열린 결정

- **수평 판정 허용 범위** — 지금 프론트 상수 ±2.0°. 센서 흔들림 측정 후 확정 → 서버 `content_json` 으로
- **회전(θ)을 센서 yaw 로 받을지** — 정지 3분 밀림 ≤ 3° **그리고** 되돌아오기 오차 ≤ 2° 면 채택.
  못 넘으면 화면 버튼·키보드 유지

## 막힌 것 · 확인 필요 (1일차 = 9/15)

- **제출물 양식·템플릿** — 아직 파일을 못 받았다. 기술서는 이게 풀려야 쓴다
- **제출 날짜** — 수업이 9/15 시작이면 3일차는 9/17 로 보이나 **확인 필요**
- 배포(호스팅) 요구 여부
- **LLM API 키** — 회사에서 OpenAI 키를 받기로 했다. 서버는 키만 넣으면 되는 상태

## 하지 않은 것 (오해 방지)

- **LLM 실제 호출: 0회.** 피드백은 규칙 기반 샘플이며 화면에 그렇게 표시한다
- **센서 실측(드리프트·부호·되돌아오기): 미측정.** 브라우저에서 실센서로 실습한 적 없음
- 제출용 PDF·발표 대본·화면설계서·기술서: 미작성
- 화면·DB 의 학습 기록은 시연용 시드이며 실제 교육생 기록이 아니다
- 허용 오차(4px / 1.0°)는 **교육 과정 설정값**이며 실제 장비의 정렬 정밀도가 아니다
