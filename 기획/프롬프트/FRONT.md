<!-- 이 파일 전체를 복사해서 새 대화의 첫 메시지에 붙여넣는다. 마지막 갱신: 2026-09-13 -->

한국어로 답해줘. 나는 코딩 경험이 거의 없는 SKALA 교육생이고, 3일짜리 AI 웹서비스
미니 프로젝트를 하는 중이야. 초보가 이해할 수 있게 설명해줘.

이 대화는 **FRONT 세션**이야. `web/frontend` 화면만 담당해.

## 먼저 읽을 것 (프로젝트 루트 기준)

1. `이어서작업.md`              ← 지금 상태와 확정된 결정. 여기부터
2. `기획/설계/실습과정_정렬.md`  ← 실습 과정의 기준 문서
3. `기획/작업로그/Front.md`      ← 지난 작업
4. `web/frontend/` 코드 전체

읽고 나서 무엇을 어떤 순서로 할지 짧게 말한 뒤 시작해줘.

---

## 담당

**쓰기**: `web/frontend/`
**읽기만**: 그 외 전부. 특히 `web/backend/` 는 고치지 않는다. 서버가 바뀌어야 하면 HEADER로 가져간다.

## 스택

React + Vite + TypeScript + Tailwind v4 + Recharts + React Router

```bash
npm --prefix web/frontend install     # 노트북마다 한 번
npm --prefix web/frontend run dev     # http://localhost:5173
npm --prefix web/frontend run build   # 타입 검사 + 빌드
npm --prefix web/frontend run lint
```

서버도 함께 띄워야 server 모드가 된다 (`--reload` 없이 — iCloud 폴더에서 죽는다):

```bash
cd web/backend && ./.venv/bin/python -m uvicorn app.main:app --port 8000
```

## 구현된 것 (전부 브라우저에서 확인됨)

**화면 11개** — `/login`, `/learn`, `/learn/status`, `/learn/courses`, `/learn/records`,
`/courses/:id`, `/attempts/new`, `/attempts/:id/result`,
`/instructor`, `/instructor/learners`, `/instructor/learners/:id`

**데이터 계층** `src/api/`
- `VITE_API_MODE=mock | server` 로 전환. **mock 구현을 지우지 않는다 — 발표장 백업이다**
- server 모드는 Vite 프록시로 `/api`·`/ws` 를 8000번으로 넘긴다 (그래서 CORS를 안 탄다)
- 사람 정보는 한 벌만 쓴다. 로그인 세션은 id만 들고, 이름·소속은 데이터 계층에서 읽는다

**입력 어댑터** `src/input/`
- `ControllerSource` — 출력은 위치가 아니라 **속도** `{vx, vy, vTheta}`
- `KeyboardSource` — 방향키 / Q·E / Shift 미세조정
- `TiltSource` + `serial.ts` — Web Serial로 아두이노를 직접 읽는다 (서버를 안 거친다)

**센서 모드 2단계 조작** (키보드 모드는 건드리지 않았다)
- 기울기(roll/pitch) → **수평 맞추기**, 비틀기(yaw) → **회전 θ**, X/Y → 방향키
- 수평이 확보된 동안에만 yaw가 θ에 반영된다. 깨지면 잠긴다
- 영점 잡기 버튼 — 책상이 기울어 있어도 그 자세를 0으로 삼는다
- 3D 컨트롤러 패널 — **CSS `rotateX/Y/Z` 만. 3D 라이브러리를 쓰지 않는다**

## 남은 일

- [ ] **실물 보드로 확인** — 포트 목록에 뜨는지 / 3D 패널이 모형 따라 기울어지는지 /
      방향이 반대면 부호 뒤집기 / 회전 속도가 적당한지
- [ ] 수평 허용값이 서버 `content` 로 옮겨지면 `src/data/controllerSettings.ts` 상수 제거
- [ ] 발표 해상도 가독성 점검

## 지켜야 할 규칙

- **합성/재생/실측 구분(`source`)과 입력 출처(`inputDevice`)를 항상 화면에 표시한다**
- `rubricSource` 가 `rule` 이면 **"규칙 기반 임시 채점 · AI 미연결"**, `llm` 이면 "AI 채점"
- 허용 오차는 교육 과정 설정값이다. 실제 장비의 정렬 정밀도처럼 표현하지 않는다
- 재실습은 새 attempt다. 이전 기록을 화면에서 지우지 않는다
- **키보드만으로 실습 전체가 되는 상태를 반드시 유지한다** (발표 백업)
- 정렬 화면의 마크는 3D로 기울이지 않는다. 정렬은 평면에서 X/Y/θ 로만 일어난다
- 실제로 브라우저에서 확인한 것만 "확인했다"고 적는다
- 끝나면 `기획/작업로그/Front.md` 맨 위에 기록. git commit 은 하지 않는다
