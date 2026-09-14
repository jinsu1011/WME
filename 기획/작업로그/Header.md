# Header 세션 작업 로그

> 작업을 끝낼 때 **맨 위에** 한 칸 추가한다. 자기 파일만 쓰므로 다른 세션과 충돌하지 않는다.
> Header 세션이 이 로그들을 모아 `기획/PROGRESS.md` 에 반영한다.

---

## 2026-09-14 (밤 4) — 과제 대비 진행 점검 · 체크리스트 재작성 · 센서 연결 원인 분석

- `제출/체크리스트.md` 전면 재작성 — A 제출 파일 / B 개요 PDF 목차 / C 세부 평가 기준 대조 / D 구현 상태 / E 최종 확인
- 파일 실제 대조: YAML 파싱 OK(경로 16, 스키마 33), DBML 19테이블·enum 14·관계 23, UI 캡처 0장, 개요 PDF 없음
- 현재 상태 자체 평가: 지금 그대로 제출 시 약 4.5/10, 설계 내용 품질 기준 약 7.5/10 (감점 요인: 캡처·PDF 없음, M1·M2)
- 센서 웹 연결 실패 원인 후보(코드 분석, 보드 미연결로 재현 못 함): ① 연결 시 리셋 → 보정 중 움직임 → 펌웨어 무한 정지, 프론트가 ERR 줄을 버려 안내 없음
  ② 화면 이탈·끊기 때 포트가 안 닫혀 재연결 시 already open ③ 포트 점유 ④ 크롬·localhost 아님 ⑤ 연습 시작 후 장치 전환 불가 ⑥ 1Hz 펌웨어 잔존 여부 미확인
- FRONT·BACK·SENSOR 작업 배분 제안은 사용자 확인 대기 (프롬프트 파일 미반영)

---

## 2026-09-14 (밤 3) — 보드 연결 확인 · SENSOR 프롬프트 재작성

- 사용자가 회사 맥북에 보드 연결 → `/dev/cu.usbmodem101` 인식 (Belkin 허브 경유)
- HEADER 가 포트를 8초 읽음(쓰기 없음): 리셋 직후 `INFO,KEEP_STILL_CALIBRATING` → `ERR,KEEP_STILL_AND_RESET` (보정 중 움직임, `wme_sensor.ino:74` 조건)
- 사용자가 `screen` 으로 본 화면: **보드 시각 1000ms 간격 = 임시 1Hz 펌웨어.** 처음에 HEADER 가 시작 문구만 보고
  "최종 50Hz" 라고 판단한 것은 **틀렸다** — SENSOR.md 의 "임시 1Hz" 기록이 맞았다
- 참고 값(1Hz 짧은 관찰, 판정에 안 씀): roll 약 −2°, pitch 약 −6°, yaw 22초에 +3.5°
- 사용자 요청으로 `screen` 종료, 포트 해제 확인
- **목표 확인**: 모형 움직임이 화면(3D 장비 뷰)에 실시간으로 보이게 → 50Hz 펌웨어 재업로드가 먼저 필요
- `기획/프롬프트/SENSOR.md` 재작성 — 이번 목표 하나로 좁힘: 포트 확인 → arduino-cli 설치(허락 후) → 저장소 50Hz 스케치 업로드 →
  50Hz 확인 → mock 화면에서 `모형 컨트롤러 연결` → 방향·수평·회전·끊김 확인표 → 기록. 측정은 그 뒤
- 이 컴퓨터: arduino IDE/cli 없음, Homebrew 6.0.21·크롬 있음, 프론트·서버 꺼져 있음

---

## 2026-09-14 (밤 2) — 제출용 ERD 정규화 결정(R6 변경) · 센서 환경 확인

- **사용자 위임으로 HEADER 판단: 제출용 DBML 을 논리 설계로 정규화.** 데이터 모델 20점 세부 기준(UI 모든 필드·PK/FK·1:N·M:N·타입)을
  JSON 한 칸으로는 그림에서 충족하지 못한다. 19테이블·그룹 4개·M:N 4개(배정↔단계, 시도↔루브릭, 시도↔확인 항목, 피드백↔근거)
- API 응답 구조는 바꾸지 않음(배열 = 하위 테이블 행). 시연 앱은 JSON 컬럼 유지 — 매핑을 테이블 Note·화면설계 4절(5열 대조표)·YAML description 에 기록
- 검증: 외래키 23개 대상 존재·타입 일치, 인덱스 컬럼 존재, enum 전부 사용, 그룹 누락 0, 괄호 짝
- 반영: 과제요건 R6, 서비스개요 고려사항 7, 화면설계 4절, BACK.md 3번(1:1 대조 → 매핑 대조, schema.sql 변경 금지), PROGRESS·체크리스트·HEADER·이어서작업
- **센서 환경(회사 컴퓨터)**: 아두이노 IDE·arduino-cli 없음, USB 보드 미연결, `data/raw` 실측 파일 0개.
  보드 펌웨어는 기록끼리 다름(SENSOR_PROGRESS "최종 50Hz" vs SENSOR.md "임시 1Hz") → 연결해서 확인 필요

---

## 2026-09-14 (밤) — 과제 PDF 수령 · 평가 기준 대응 설계 산출물 초안

- **과제 PDF 26쪽 전체 확인** → `기획/과제요건.md`. 기획·설계만 평가(구현 제외), 제출물은 개요 PDF·API YAML·DB DBML,
  3일차 13:30 마감(미준수 0점)·14:30 발표 5분, 창의성 평가 안 함, 감점은 UI·API·ERD 불일치
- **사용자 지시**: 3D·센서 유지, PPT 는 추후. **HEADER 결정 R1~R9** (반·이름·로그인·JSON·액터는 추천안으로 진행, 변경 가능)
- **`제출/WME-DB.dbml`** — `schema.sql` 기준 6테이블·enum 11개·인덱스·JSON 컬럼 note. 스크립트로 컬럼·외래키 대조: 설계 추가 2칸 외 일치
- **`제출/WME-API.yml`** (OpenAPI 3.0.3) — 실제 서버 `/openapi.json` 에서 경로·요청 모델을 가져오고(응답 스키마가 비어 있음),
  **실제 응답 샘플 12종으로 스키마를 작성**. 검증: `$ref` 43 전부 해석 / 경로 누락 0 / 파라미터·본문 필드 일치 / 응답 12종 불일치 0.
  에러 코드는 서버가 실제로 내는 404·409·422·503 + [설계] 401 만. WebSocket·Web Serial 은 description 에
- **`기획/설계/서비스개요.md`** — 문제 정의(수치 없음), 액터 4종, FR 21개(화면·API 매핑), 예외 10종, 고려사항 10개
- **`기획/설계/화면설계.md`** 전면 작성 — 화면 13개, mermaid 흐름, 화면별 구성·API, **UI↔API↔DB 대조표**, 캡처 22장 목록
- **코드 대조로 찾은 불일치**: M1 `PATCH /progress` 어떤 화면도 호출 안 함(진도가 안 쌓임) / M2 `feedback/viewed` 호출 안 함 / M3 로그인 API 없음
- 예외 시나리오를 코드로 확인하고 서비스개요 문구 2곳 정정(확정 전엔 제출 폼 자체가 없음, 판단 항목은 화면에서 누락·중복 불가)
- 프롬프트 BACK(YAML·DBML 서버 대조)·FRONT(M1·M2 연결 → 캡처 22장)·HEADER 갱신, 체크리스트·PROGRESS·이어서작업·PROJECT_HEAD 7절
- **확인 못 한 것**: dbdiagram.io·Swagger Editor 에서 실제로 열어보기(브라우저), POST·PATCH 응답·오류 본문 실호출(BACK 에 배정)

**다음**: BACK 대조 → FRONT 연결·캡처 → HEADER 보정 → 개요 PDF 조립

---

## 2026-09-14 (저녁) — 하루 마감: BACK·FRONT 최종 보고 확인 · 이어받기 전체 최신화

- **FRONT 보고 확인 — 일치**: `KEYBOARD_TILT_CONTROLS` 삭제(src 전체에 없음), `server.ts:68` `raw.scenario ?? null`,
  `types/index.ts:71` `tiltControls`, mock 시드 `courses.ts:114`, `AlignmentExercise.tsx:669` 에서 사용.
  `node_modules` → `deps.nosync/node_modules` 링크, `.bin` 에 vite·tsc 있음, `vite.js` 존재
- **BACK 마감 보고 확인 — 일치**: `web/backend/README.md` 에 analyzers·REST 15·scoring.py·course_judgment.py 반영
- **HEADER 결정**: backend README 12행 `--reload` 는 **지운다**(규칙과 반대, 따라 치면 2분마다 죽음) → 내일 BACK 1번
- **결정 12·13 을 결정표에 추가** — 12 `alignment.tiltControls` 위치, 13 설치물은 `.nosync` + 링크·노트북마다 새로
- `이어서작업.md` 전면 갱신 — 설치 절차를 FRONT·BACK 이 실제로 동작시킨 `.nosync` 방식으로,
  `.env` 따옴표 주의, 규칙 3 "설치·서버 실행은 한 세션만", **내일 할 일 역할별 표**
- 프롬프트 `BACK.md`(내일: --reload → LLM 6단계)·`FRONT.md`(내일: D 키 확인 → 실물 센서, 설치 안내)·`HEADER.md` 갱신
- `PROGRESS.md` 내일 기준으로 재작성
- 확인 못 한 것: FRONT 의 D 키 기울기 동작(FRONT 도 미확인 보고) → 내일 FRONT 1번

**내일**: 수업에서 양식·날짜·배포·키 확인 → DB설계·API명세서 반영 → 화면설계 → 11절 → DB 다이어그램 PNG

---

## 2026-09-14 — BE 8차 결과 확인 (checkItems 순서)

- **BACK 보고를 서버로 확인 — 일치**: `checkItems` = coat, wedge, history, focus, contam /
  `recommendedOrder` = wedge, focus, contam, coat, history. id 집합 같음, 최상위 `scenario` 와 `content.scenario` 동일.
  판단 시드 점수 [0,0,0,0] / [2,2,2,2] 그대로
- 설계서 10.3 이 이제 문서·데이터 모두 반영됨. FRONT `initialOrder` 는 유지
- BACK 이 다시 올린 DB설계 불일치(준비 중 표기·행 수 16/12)는 **앞 작업에서 이미 고쳐 커밋(`dbd37d3`)** — 추가 조치 없음
- `web/backend/README.md` 옛 내용은 아직 그대로(REST 10, `analysis.py`) → `BACK.md` 에 짧은 일로 추가
- `BACK.md` 0번 완료 처리. BACK 남은 일은 LLM 실제 호출 + README 정리

---

## 2026-09-14 — BE 7차 결과 확인 · checkItems 미반영 발견

- **BACK 보고 4건을 코드·실행 중 서버로 확인 — 전부 일치**: `main.py:289` `COALESCE(ended_at, ?)` /
  `repo.py:126` `scenario` 최상위(defect-report 있음, photo-align null) / `course_data.py:93` `capAt: 1` /
  `alignment.tiltControls` 2항목 + 기존 controls 3개. 서버는 14:25 재시작돼 반영 상태
- **설계서 10.3 이 문서에만 반영돼 있었다(HEADER 결함).** 9/13 에 "순서를 바꿨다"고 적었지만 서버 데이터는
  권장 순서와 같은 그대로였다. BACK 이 발견. 결정은 유지 → `BACK.md` 0번으로 지시, 설계서 10.3 에 정정 기록
- `DB설계.md` 불일치 2곳 수정 — defect-report "준비 중" → 실습 가능, 행 수 enrollments 17 · attempts 14
- BACK 이 FRONT 에 넘긴 2건(보정 코드 `scenario`, 상수 `KEYBOARD_TILT_CONTROLS`)을 PROGRESS FRONT 항목으로. `initialOrder` 는 유지
- **보고에 없던 변경 발견**: `web/frontend/node_modules` 가 `deps.nosync/node_modules` 링크로 바뀌어 있고(14:08),
  링크 대상은 불완전하다 — 패키지 폴더 이름은 있으나 `vite/bin` 이 없고 `.bin` 이 비어 있다. 실행 중인 dev 서버(14:00·14:08 시작)는 떠 있을 때 불러와 동작 중이지만 **새로 띄우면 실패할 수 있다.**
  빈 충돌 사본 `node_modules 2` 도 생겼다. FRONT 폴더라 HEADER 는 손대지 않고 사용자에게 보고
- **문서 최신화** — 루트 `README.md`(미착수·부품 미확보 → 현재 상태, 실행을 server 모드로),
  `PROJECT_HEAD.md` 0절(서비스 코드 없음 → 현재 상태, 옛 컨셉 절 경고), `HEADER.md`·`FRONT.md` 프롬프트,
  `API명세서.md` 분석기 경로(`analysis.py` → `analyzers/alignment.py`). 그 뒤 사용자 요청으로 커밋·푸시
- `web/backend/README.md` 에도 옛 내용(REST 10, `analysis.py`)이 있으나 BACK 폴더라 BACK 에 넘김
- BACK 보고는 "개인 맥북"이라 적었으나 서버 프로세스가 이 컴퓨터에서 떠 있어 **같은 컴퓨터·같은 폴더의 동시 세션**으로 보인다

---

## 2026-09-14 (회사 컴퓨터) — 환경 구축 · 옛 상태 정리 · 일정 정정

- **환경 구축**: 프론트 `npm install`, 백엔드 venv + requirements, `app.seed` 완료.
  iCloud 폴더에서 `.venv/bin/python` 링크가 사라지는 문제 → `.venv` 를 `.venv.nosync` 링크로 두는 방식으로
  동작 확인(이 구성은 동시에 돈 다른 프로세스가 만든 것으로 보인다). 서버 8000 + 화면 5174(server 모드)에서
  `/api/health`, 담당자 현황, 학습자 8명이 프록시를 거쳐 오는 것까지 확인. GitHub 원격에 새 커밋 없음
- **`PROGRESS.md` · `이어서작업.md` 옛 내용 정리** — 실제 코드·DB 와 대조해서 고침:
  * "프론트↔백엔드 연결 미완" → 연결 완료 (mock/server 전환)
  * REST 10개 → **15개** + WS 1 (`main.py` 라우트 직접 확인)
  * 배정 16 → **17**, 시도 12 → **14**(정렬 12 + 판단 2), 과정 5개 중 실습 가능 2 (DB 직접 조회)
  * "센서 부품 미확보" → UNO + MPU6050 수신 성공, 실측은 미완
  * **새 컴퓨터 실행 절차의 `npm run dev` 는 mock 모드(5173)였다** → `dev:server`(5174) 로 정정.
    그대로 따라 하면 서버가 떠 있어도 화면은 시드 데이터를 보여 줘서 연결이 안 된 것처럼 착각할 수 있었다
- **BACK 남은 4건을 코드로 확인 — 전부 미반영**: judgment `ended_at` 저장, `scenario` 최상위,
  `axisInterference` `adjust:-1` → `capAt:1`, 기울기 키 안내의 과정 설정 이동
- **일정 정정**: 수업은 **9/15 시작**(사용자 확인). 제출물 양식 파일 미수령.
  3일차 = 9/17 로 보이나 계산값이라 1일차에 확인하도록 표시

- **HEADER 결정 변경 — 기울기 키 안내 위치: `control.keyboard` → `alignment.tiltControls`**.
  화면은 기울기 키를 키보드 모드일 때만 기존 안내와 따로 보여 준다(`AlignmentExercise.tsx` 667행).
  `alignment.controls` 에 섞으면 센서 모드에도 보이고, `control.keyboard` 는 숫자 계수 자리라 문구를 섞지 않는다
- `기획/프롬프트/BACK.md` 전면 갱신 — 남은 4건마다 원인·고칠 위치·확인 방법, 시드 재실행 시 기록이 지워진다는 경고,
  옛 수치(REST 11·배정 16·`analysis.py`) 정정. 이전 문서의 "기준1 modifier" 는 **조정 순서(criterion 1, 루브릭 두 번째)** 가 맞다

**다음**: DB설계·API명세서에 exercise_type·judgment 반영 → `화면설계.md` → `PROJECT_HEAD.md` 0절·5절 정리 → 기술서(양식 받은 뒤)

---

## 2026-09-14 — 3D 장비 뷰 결과 확인 · 프롬프트 최신화

FRONT 가 3D 장비 뷰·노광/현상 연출·키보드 기울기·시점 회전까지 끝냈다. 판단과 기록:

- **한글 입력 상태에서 Q/E 가 안 먹던 버그를 잡은 것이 이번 작업의 최대 성과다.**
  `event.key` 로 판정해 한글 모드에서 'ㅂ'·'ㄷ' 로 들어왔다. 방향키는 IME 영향이 없어
  더 찾기 어려웠다. 발표 중 회전 조작이 통째로 안 되는 사고가 날 뻔했다
- **노광 → 현상 → 패턴 찍힘 연출 승인.** "마크만 겹치고 끝나서 정렬이 왜 중요한지 안 보인다"는
  문제를 화면으로 푼 것이다. 오차가 크면 패턴이 어긋난 자리에 찍힌다 — 결과가 눈에 보인다
- **시점 회전에서 줌·팬을 끈 판단 승인.** 휠은 페이지 스크롤을 막고, 팬은 물체를 화면 밖으로
  끌고 나간다. 발표 중 길을 잃는 것이 가장 큰 위험이다
- 키보드 기울기 값을 저장값에 넣지 않은 판단 승인 (서버로 가는 roll/pitch 는 0 유지).
  화면 표시와 수평 판정에만 쓰는 것이 맞다
- **HEADER 결정**: 기울기 키(W/A/S/D) 안내를 `content_json.control.keyboard` 로 옮긴다(BACK).
  조작 안내는 과정 설정값이어야 한다(결정 4). 올라가면 FRONT 가 상수를 지운다
- `기획/프롬프트/FRONT.md` 를 현재 상태 기준으로 전면 교체, `BACK.md` 에 3-b 추가,
  `이어서작업.md` 현재 상태 갱신

**미완**: 센서 실측(수신 문제·드리프트), LLM 실제 호출, 화면설계·기술서·발표대본

---

## 2026-09-13 (밤) — 3D 장비 뷰 결정 번복 · 센서 수신 문제 기록

- **이전 지시를 뒤집었다.** "3D 라이브러리 쓰지 마라, CSS 로, 옆에 작게 둬라"는 HEADER 지시로
  작은 원판 표시등이 나왔는데, 사용자가 원한 것은 **실습 화면 중앙의 장비 그 자체**였다.
  → 결정 10: **Three.js 로 장비 뷰(스테이지+웨이퍼+마스크)를 중앙에, 현미경 뷰(2D 마크)는 옆으로.**
  실제 얼라이너가 그 구성이고, 현미경 뷰만 있으면 "마크 겹치기 게임"으로 보인다는 진단과도 맞는다.
  포토리얼은 목표가 아니며, WebGL 불가 시 기존 CSS 패널로 자동 대체한다
- **센서 "연결됨 / 수신 없음"** — `serial.ts` 파싱 코드를 읽어 정상임을 확인. 보드 쪽 문제로 판단.
  진단 순서(IDE 모니터 115200 → `WME,` / `ERR,MPU6050_NOT_FOUND` / 무출력 구분)를
  FRONT·SENSOR 프롬프트 양쪽에 기록. 포트는 `cu.usbmodem101`
- 프롬프트 갱신: FRONT 에 3D 작업(할 일 0)과 수신 진단, SENSOR 에 할 일 0-a 추가
- `이어서작업.md` 결정표에 10·11 추가

**다음**: `설계/화면설계.md` → DB설계·API명세서에 `exercise_type` 반영 → 기술서(1일차 양식 확인 후) → 발표 대본

---

## 2026-09-13 (저녁) — 범용성 설계 · API명세서 · 발표자료 초안 · 결과 판정

- **범용성 진단**: 업종 문구는 분리돼 있으나 채점 규칙이 `scoring.py` 코드에 박혀 있어
  "데이터만 갈아끼우면 된다"가 과장이었음. `기획/설계/실습유형_설계.md` 신설(규격 계약서)
- A·B·C 구현 결과 판정 — BACK/FRONT 보고 4건 처리:
  * `together`+축 간섭은 `adjust:-1` → **`capAt:1`** (같은 현상을 두 번 깎지 않는다)
  * 불리언 지표 2개 추가(`rotationOutsideComfort/Range`) 승인 — 규칙 문법 대신 지표를 늘린 판단이 맞다
  * `content_json.feedbackNotes` 승인 — 표현 규칙은 과정마다 달라야 한다
  * **`checkItems` 순서가 `recommendedOrder` 와 같던 것은 HEADER 설계 결함.** FRONT가 발견.
    데이터 순서를 고치고 FRONT의 `initialOrder` 셔플은 이중 안전장치로 유지
- `기획/설계/API명세서.md` 작성(564줄) — REST 15 + WS 1, 실제 라우트·오류코드와 대조. **제출물**
- `제출/발표자료_초안.md` 작성 — 슬라이드 8장, 시간 배분, 예상 질문 6개.
  "웨이퍼 한 장에 얼마" 수치는 출처 없이 쓰지 않기로 하고 구조만으로 논리가 서게 구성
- **LLM 키 연결 경로 검증** — `llmConfigured: true` 까지 확인.
  이 과정에서 **오류 메시지에 API 키가 그대로 실려 나가는 결함 발견** → DB·로그 흔적 제거,
  `client.py` 를 분류된 문구만 내보내도록 교체(원본 예외 메시지 차단 + `_redact` 이중 안전장치),
  제공자 자동 선택(anthropic/openai) 추가. **HEADER가 BACK 폴더를 직접 수정한 예외 작업**
- 실제 화면 5개를 브라우저로 직접 확인. "판단 훈련"이 화면에서 증명되지 않는다는 진단 →
  문구 3개 + judgment 실습으로 해결
- `이어서작업.md`·프롬프트 4종 갱신. 일정 착각(3일차 제출) 정정

**다음**: `설계/화면설계.md` → DB설계·API명세서에 `exercise_type` 반영 → 기술서(1일차 양식 확인 후) → 발표 대본

---

## 2026-09-13 — DB설계서 전면 재작성 · 세션 README 4종 갱신

- `기획/설계/DB설계.md` 전면 재작성(454줄). 이전 컨셉 잔재(anomaly_score / anomaly_candidate /
  stage-anomaly / measuring·measured) 제거하고 실제 `schema.sql` 기준으로 맞춤.
  **추정 없이 시드 DB에서 직접 조회한 값으로 JSON 예시 작성** (summary·answer·feedback·events.metrics).
  `rubric_source` 컬럼, WAL, 평평한 과정 응답 반영. 10절에 대조 확인 기록 추가
- `기획/프롬프트/{HEADER,FRONT,BACK,SENSOR}.md` 4종을 현재 상태로 재작성 —
  회사 노트북에서 이어받을 수 있게 실행 명령·구현 현황·남은 일·규칙을 각 파일에 자족적으로 기록
- 센서 조작 방식 변경 결정 반영: 기울기=수평(평행) 맞추기, yaw=회전, X/Y=키보드.
  근거는 접촉식 마스크 얼라이너의 평행 조정 단계(실제 순서가 평행 → 회전·위치)
- yaw 판정 기준 확정: 정지 3분 밀림 ≤ 3° **그리고** 되돌아오기 오차 ≤ 2°.
  정지 드리프트만으로는 부족하다고 판단해 되돌아오기 시험을 추가

**다음**: `설계/API명세서.md`(제출물) → `화면설계.md` → `제출/프로젝트기술서.md` → 발표 대본 → 슬라이드

---

## 2026-09-12 — 교차 확인 · 결정 9건 · 이어받기 파일 갱신

- Front·Back 실제 코드 대조(교차 확인). 불일치 7건을 찾아 세션별로 배정
  (제출 본문·phase·상태값·events.axis·동기 함수·시드 사용자·Course.control)
- BACK 2차·3차 결과를 DB와 코드로 직접 검증: users 9 / enrollments 16 / attempts 12 / courses 5,
  과정 응답 평평화(`repo.py:57`), control 블록, COURSE_VERSION `course-2.0.0` 확인
- BACK이 지시 외로 처리한 3건(구조 평평화·버전 통일·분석기 속도창 버그) 승인
- **결정 9건 확정** — 입력 장치명 `inputDevice`/`model_controller`, 기울기 변환은 프론트 계산,
  계수는 과정 설정값, 센서는 **Web Serial 직통**(서버 경유 아님),
  3축 매핑(roll→X / pitch→Y / yaw→θ, 전부 속도 방식), 서버 시드를 프론트에 맞춤,
  `VITE_API_MODE=mock|server` 안전장치, 버전 `course-2.0.0` 통일
- `이어서작업.md` 전면 갱신 — 현재 상태, 결정 9건, 세션별 붙여넣기 프롬프트 4종(FRONT는 연동 지시문)
- `기획/PROGRESS.md` 갱신. 이전 컨셉 잔재 수치(시도 15건 → 실제 12건) 정정

**다음**: `설계/DB설계.md` 전면 갱신(제출물 DB 다이어그램) → `API명세서.md` → 화면설계 → 기술서 → 발표

---

## 2026-09-12 — 컨셉 전환 · 세션 체계 · DB설계서

- 서비스명 **WME (We Make Experts)** 확정. 문서 전체 반영
- 실습 과정을 **마스크·웨이퍼 정렬 실습**으로 전환. `기획/설계/실습과정_정렬.md` 신설(과정 정의·5단계·
  측정 지표 7개·루브릭 4개·DB 변경점 9절·발표 문장). 이 문서가 실습에 대한 기준
- `기획/설계/DB설계.md` 작성(345줄) — ERD, 6테이블 컬럼, SQLite DDL 전문, JSON 구조,
  서버가 검증할 제약 8개, 설계 판단 근거
- 세션 체계를 Header/Front/Back/Sensor 4개로 정리. 계획 세션은 폐지하고 문서·발표자료를 Header로 통합
- 세션별 작업 로그를 `기획/작업로그/` 로 분리 — 동시 편집 충돌 방지
- 깃 저장소 연결(jinsu1011/WME, 비공개) + README 작성
- Front/Back 결과물 교차 확인: 과정 ID `photo-align` 양쪽 일치, `.venv`·`.DS_Store` 미추적 확인

**아직 아무에게도 배정되지 않은 작업**: 프론트 `src/api/index.ts` 를 실제 서버 호출로 바꾸는 연결 작업.
