# WME — We Make Experts

> **장비를 운용하는 기업을 위한 B2B 사내 기술교육 플랫폼**
> SKALA AI 웹서비스 미니 프로젝트 (3일, 개인)

실장비 실습을 대체하는 것이 아니다. 실장비에 투입되기 전에,
**신호를 읽고 무엇을 먼저 확인할지 판단하는 훈련**을 저비용으로 반복하게 한다.

제품 자체는 업종 중립이고, 이번 데모는 반도체 장비 기업(가상 고객사)에 납품한 인스턴스다.

---

## 이어서 작업하려면

**👉 [`이어서작업.md`](이어서작업.md) 를 먼저 연다.**

역할(HEADER / FRONT / BACK / SENSOR)별로 새 대화에 붙여넣을 프롬프트와
지금까지의 진행 상황이 들어 있다.

## 실행

설치(venv·DB 시드 포함)는 [`이어서작업.md`](이어서작업.md) 1단계를 따른다. 설치 후:

```bash
cd web/backend && ./.venv/bin/python -m uvicorn app.main:app --port 8000   # 서버
npm --prefix web/frontend run dev:server                                  # 화면 http://localhost:5174
```

서버 없이 보려면 `npm --prefix web/frontend run dev` (mock 모드, http://localhost:5173 — 발표 백업용).

데모 로그인 — 신입사원 `1` / `1`, 매니저 `2` / `2` (인증 구현이 아니라 데모 전환)

## 지금 상태 (2026-09-14)

| 영역 | 상태 |
|---|---|
| 프론트엔드 | 화면 11개 + 실습 2종(정렬 / 판단). 3D 장비 뷰, mock·server 두 모드 동작 |
| 백엔드 (API·DB) | REST 15 + WebSocket 1, SQLite 6테이블, 규칙 기반 분석·채점 동작 |
| LLM 피드백 | 입력 구성·검증·재시도 구현. **API 키 없어 실제 호출 0회** |
| 센서 | Arduino UNO + MPU6050 수신 성공. 드리프트·부호 **미측정** |
| 제출 문서 | DB설계·API명세서 원본 있음. 화면설계·기술서·발표 대본 미작성 |

상세는 [`기획/PROGRESS.md`](기획/PROGRESS.md).

## 구조

```
├── 이어서작업.md      다른 노트북·새 대화에서 이어받을 때
├── PROJECT_HEAD.md    제품 정의·확정된 결정·원칙
├── 기획/              계획서 · 진행상황 · 설계문서 · 세션 프롬프트 · 작업로그
├── web/frontend/      React + Vite + TypeScript + Three.js 화면
├── web/backend/       FastAPI · SQLite · 규칙 기반 분석·채점 · LLM 연결부
├── hardware/          Arduino 펌웨어 (wme_sensor)
├── data/              센서 수집·분석 도구, local/ 에 SQLite DB(깃 제외)
└── 제출/              제출물
```

## 원칙

- 데이터의 출처(시연용 기록 / 서버 기록 / 입력 장치)를 화면에 항상 표시한다
- 규칙 기반 채점을 AI 채점이라고 부르지 않는다
- 판단은 학습자가 한다. AI는 근거를 제시하고 피드백할 뿐이다
- 구현한 것과 계획한 것을 문서·발표에서 분리해 말한다

---

*학습 기록과 고객사는 시연용 가상 데이터다. 실제 기업·직원 정보가 아니다.*
