<!-- 이 파일 전체를 복사해서 새 대화의 첫 메시지에 붙여넣는다. 마지막 갱신: 2026-09-14 밤 (HEADER, 과제 요건 반영) -->

한국어로 답해줘. 나는 코딩 경험이 거의 없는 SKALA 교육생이고, 3일짜리 AI 웹서비스
미니 프로젝트를 하는 중이야. 이 대화는 FRONT 세션이야. web/frontend 만 담당해.

서비스명 WME. 제출자: 9반 김진수. 저장소: https://github.com/jinsu1011/WME

## 0. ★ 제일 먼저 확인
- **HEADER 세션이 `git pull`·`./시작.sh` 를 끝낸 뒤에 이 대화를 시작한다.** 설치·pull 은 HEADER 한 곳에서만 한다
- 너는 확인만 한다: `git log --oneline -1` 이 `57730f4` 이후 커밋인지, `ls web/frontend/node_modules/.bin | grep -E "^vite$"` 가 나오는지
- 둘 중 하나라도 아니면 **직접 설치·pull 하지 말고** 멈추고 "HEADER 에서 git pull·./시작.sh 를 먼저 하세요"라고 알린다
- 끝낼 때 commit + push 는 내가 한다

## 먼저 읽을 것
1. 기획/과제요건.md                 ← ★ 과제 평가 기준·제출물. 여기부터
2. 기획/설계/화면설계.md             ← ★ 화면 목록·UI 흐름·대조표·캡처 목록 (이번 작업 기준)
3. 이어서작업.md                    ← 지금 상태와 확정된 결정
4. 기획/작업로그/Front.md           ← 지금까지 한 것
5. web/frontend/ 코드

## 과제에서 달라진 것 (중요)

**이 과제는 기획·설계를 평가한다. 구현은 점수가 아니다.**
제출물 중 개요 PDF 에 **UI 흐름도를 실제 화면 캡처로** 넣어야 한다(필수).
감점 포인트: **"UI 데이터와 API 불일치"**, **"핵심 기능이 UI 에 없음"**.
→ FRONT 의 역할은 ① 화면이 API 를 빠짐없이 쓰게 연결 2곳, ② **UI 흐름도용 캡처**다.
**3D 장비 뷰와 센서는 유지한다.** 단 새 기능은 만들지 않는다.

## 실행 · 설치

```bash
npm --prefix web/frontend run dev          # mock  → http://localhost:5173
npm --prefix web/frontend run dev:server   # server → http://localhost:5174 (서버 8000 이 떠 있어야 함)
```

- 새 노트북이면 설치부터 — `이어서작업.md` 1단계 (1). `node_modules` 는 `deps.nosync/node_modules` 링크
- iCloud 폴더에서 그냥 `npm install` 하지 않는다
- 포트가 이미 쓰이고 있으면 그걸 쓴다. 설치·서버 켜고 끄기는 **이 세션 하나만**

## 지금 상태 (2026-09-15 새벽, 커밋 c1cb566)

화면 11개(라우트) + 실습 2종. mock / server 두 모드 동작. 타입·빌드·린트 통과(기존 `useDemo` 경고 1건).
3D 장비 뷰 + 노광·현상 연출, 키보드(event.code)·Web Serial 입력, `course.scenario`·`course.alignment.tiltControls` 사용.

**9/14 밤 집에서 끝낸 센서 작업 (실물 확인, 결정 15·16 — 다시 고치지 않는다)**
- 센서 모드: 값 다듬기(`SENSOR_SMOOTHING_SEC`), 앞뒤 부호 반전(`SENSOR_AXIS_SIGN`), X/Y 가운데 고정(`고정` 표시),
  비튼 각도 그대로 회전(수평 잠금 없음), ±0.5°·Q/E 미세조정, "port already open" 수정
- 실습 성공(키보드·센서 공통): 정렬 시작 뒤 수평(±4°) + 허용 오차 안 5초 유지 → 진행 막대 → `실습 성공`. 저장·채점과 무관
- 화면 상수(`data/controllerSettings.ts`): `LEVEL_TOLERANCE_DEG 4.0`, `LEVEL_EXIT_MARGIN_DEG 1.0`, `SUCCESS_HOLD_MS 5000` — **결정 16 D 로 화면 상수 유지, 서버로 옮기지 않는다**

**새 노트북에 앉으면** `git pull` → `./시작.sh`. **떠날 때** `./정리.sh` → 커밋·푸시(내가 한다).

## 할 일 — 이 순서로

### 1. 화면 ↔ API 연결 2곳 (`화면설계.md` 4절 M1·M2)

HEADER 가 코드를 대조해서 찾았다. API 는 서버에 있는데 **어떤 화면도 부르지 않는다.**

- **M1 진도 기록** — `updateProgress`(`PATCH /api/enrollments/{id}/progress`)
  정렬·판단 실습에서 단계를 마치면 호출해 `stepsCompleted` 가 실제로 쌓이게 한다.
  과정 `steps` id(예: 정렬 `concept`·`marks`·`align`·`submit`·`feedback`)를 **데이터에서 읽어** 쓰고, 어느 시점에 어느 단계를 완료로 볼지 짧게 정리해서 로그에 적는다.
  실패해도 실습 흐름을 막지 않는다
- **M2 피드백 열람** — `POST /api/attempts/{id}/feedback/viewed`
  `src/api/contract.ts`·`server.ts`·`mock.ts` 에 함수를 추가하고, 결과 화면에서 피드백이 보이면 한 번 호출한다
- 확인: mock·server 둘 다. server 는 호출 후 `GET /api/enrollments?userId=u-1` 의 `stepsCompleted`, `GET /api/attempts/{id}` 의 `feedbackViewedAt` 이 바뀌는지
- ⚠️ server 모드에서 만든 테스트 기록은 DB 에 남는다. 캡처 전에 BACK 이 시드를 재적재하거나, 캡처에 방해되지 않게 한다

### 2. ★ UI 흐름도 캡처 24장 (`화면설계.md` 5절 표 그대로)

- ⚠️ **BACK 이 API 대조 테스트를 끝내고 시드를 재적재한 뒤에** 찍는다 (테스트 기록이 화면에 섞이지 않게). BACK 작업로그 맨 위에서 재적재 완료를 확인
- C-23(실습 성공)은 키보드 모드로 재현한다. C-24(센서)는 보드가 없으면 생략하고 보고
- 결과 화면(C-16·C-18)은 **키보드 모드 기록**으로 찍는다 (결정 16 B)

- **server 모드(5174)** 에서, 너비 1440px, 개발 도구·주소창 없이 화면 영역만
- 저장: `제출/자료/캡처/C-01_로그인.png` 형식 — **이 폴더만 예외로 쓰기 허용**
- 목록의 **상태**를 정확히 맞춘다 (예: C-02 틀린 비밀번호 오류, C-10 크게 어긋난 채 확정, C-13 수평 깨짐 → 회전 잠김, C-19 피드백 실패)
- 강조 박스·화살표는 넣지 않는다 (HEADER 가 PDF 에서 넣는다)
- 캡처하다가 **화면설계.md 의 설명과 실제 화면이 다르면** 고치지 말고 목록으로 보고한다

### 3. D 키 기울기 확인
W/A/S/D 를 누르고 있으면 기울기 각도가 바뀌고, ±4° 넘으면 `기울어짐` + 회전 잠김, `수평으로 되돌리기` 로 복귀하는지. C-13 캡처와 같이 확인한다.

### 4. 센서는 하지 않는다
센서 작업은 9/14 밤에 끝났다. `TiltSource.ts`·`controllerSettings.ts` 와 `AlignmentExercise.tsx` 의 센서·실습 성공 부분은 건드리지 않는다.
M1 때문에 `AlignmentExercise.tsx` 를 고쳐야 하면 진도 호출 몇 줄만 넣는다.

## 반드시 지킬 것
- web/backend, 기획/ 는 읽기만. 제출/ 은 `제출/자료/캡처/` 만 쓴다
- 업종·과정 문구는 src/data/ 에만
- 저장되는 값·채점·결과 화면 구조를 바꾸지 않는다 (M1·M2 연결은 HEADER 지시로 허용)
- 새 기능을 만들지 않는다. 3D·센서는 지금 상태 유지
- 키보드만으로 실습 전체가 되는 상태를 유지한다 (발표 백업)
- mock 모드는 지우지 않는다
- 허용 오차는 교육 과정 설정값, 모형은 교육용 컨트롤러라는 고지를 유지한다
- 실제로 브라우저에서 확인한 것만 "확인했다"고 적는다
- 끝나면 기획/작업로그/Front.md 맨 위에 기록. git commit 은 하지 않는다

시작 전에 무엇을 어떤 순서로 할지 짧게 말하고 시작해줘.
