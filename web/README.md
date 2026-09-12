# web — 서비스 코드

| 폴더 | 내용 | 상태 |
|---|---|---|
| `frontend/` | React + Vite + TypeScript 화면 | 구현 중 |
| `backend/` | FastAPI · 센서 수신 · AI 연결 | 미착수 |

## 실행

프로젝트 루트에서:

```bash
npm --prefix web/frontend install
npm --prefix web/frontend run dev
```

기본 주소는 http://localhost:5173 이다.

| 명령 | 설명 |
|---|---|
| `npm --prefix web/frontend run dev` | 개발 서버 |
| `npm --prefix web/frontend run build` | 타입 검사 + 프로덕션 빌드 |
| `npm --prefix web/frontend run lint` | 정적 검사 |

## frontend 구조

```
src/
├── data/       업종·고객사·과정 시드 데이터 (업종 의존 내용은 전부 여기)
├── types/      DB 6테이블과 1:1 타입
├── api/        REST 명세와 1:1 함수 (지금은 시드 데이터를 읽는 mock)
├── lib/        집계·역할 상태
├── charts/     Recharts 래퍼와 색 토큰
├── components/ 공용 UI
├── pages/      화면 9개
└── sensor/     센서 데이터 소스 어댑터 (mock/replay/live) — 미구현
```

## 지금 상태

- 화면 9개 구현, 시드 데이터 기반으로 동작한다.
- BE·센서·LLM은 아직 연결하지 않았다. 화면은 연결된 것처럼 보이게 하지 않는다.
- `npm run build` 와 타입 검사는 통과 상태로 유지한다.
