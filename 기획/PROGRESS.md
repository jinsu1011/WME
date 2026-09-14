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

## 다음 작업 (9/15)

### 수업에서 확인
- [ ] 제출물 양식·템플릿 / 제출 날짜(9/17?) / 배포 요구 / **LLM 키 수령**

### HEADER ← 문서
1. [ ] `설계/DB설계.md` · `설계/API명세서.md` 에 `exercise_type` · judgment 제출 본문·`tiltControls`·`scenario` 반영 (**제출물**)
2. [ ] `설계/화면설계.md` — 화면 11개 + judgment 실습 화면 (지금 비어 있음)
3. [ ] `설계/실습과정_정렬.md` 11절 — 확정값(허용 오차·조작 계수) 반영
4. [ ] DB 다이어그램 PNG (`DB설계.md` 2절 mermaid → `제출/`)
5. [ ] `제출/프로젝트기술서.md` — **양식 받은 뒤** → 발표 대본 5분 → 발표자료

### BACK
- [ ] `web/backend/README.md` 12행 `--reload` 삭제 (HEADER 결정 9/14)
- [ ] **LLM 실제 호출 1회 성공** — 정렬·판단 둘 다, 오류 응답·`feedback_error` 에 키 노출 없는지

### FRONT
- [ ] D 키로 기울기 각도가 실제로 바뀌는지 확인 (9/14 변경 뒤 미확인 — 조작 코드는 안 건드림)
- [ ] **실물 센서를 브라우저에 꽂아 실제 수신 확인** (아직 아무도 못 함)
- [ ] 발표 해상도 가독성 점검 / `coatingScene.ts` 붙이기(선택)

### SENSOR
- [ ] 저장소 50Hz 펌웨어 재업로드(보드에 임시 1Hz 가 올라가 있음)
- [ ] 3분 정지 드리프트 → 되돌아오기 6회 → 축 부호 → 모형 조립 후 30초

## 열린 결정

- **수평 판정 허용 범위** — 지금 프론트 상수 `LEVEL_TOLERANCE_DEG` ±2.0°. 센서 흔들림 측정 후 확정 → 서버 `content_json` 으로
- **회전(θ)을 센서 yaw 로 받을지** — 정지 3분 밀림 ≤ 3° **그리고** 되돌아오기 오차 ≤ 2° 면 채택.
  못 넘으면 화면 버튼·키보드 유지

## 막힌 것 · 확인 필요

- **제출물 양식·템플릿** — 아직 파일을 못 받았다. 기술서는 이게 풀려야 쓴다
- **제출 날짜** — 수업이 9/15 시작이면 3일차는 9/17 로 보이나 **확인 필요**
- 배포(호스팅) 요구 여부
- **LLM API 키** — 9/15 회사에서 OpenAI 키를 받기로 했다. 서버는 키만 넣으면 되는 상태

## 하지 않은 것 (오해 방지)

- **LLM 실제 호출: 0회.** 피드백은 규칙 기반 샘플이며 화면에 그렇게 표시한다
- **센서 실측(드리프트·부호·되돌아오기): 미측정.** 브라우저에서 실센서로 실습한 적 없음
- 제출용 PDF·발표 대본·화면설계서·기술서·DB 다이어그램 PNG: 미작성
- 화면·DB 의 학습 기록은 시연용 시드이며 실제 교육생 기록이 아니다
- 허용 오차(4px / 1.0°)는 **교육 과정 설정값**이며 실제 장비의 정렬 정밀도가 아니다
