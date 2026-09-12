# backend — 미착수

FastAPI 서버 자리. 착수 전이며 아직 코드가 없다.

예정 범위:

- REST 10개 경로 + WebSocket 1개 (`기획/설계/API명세서.md`)
- SQLite 6테이블 (`기획/설계/DB설계.md`)
- pyserial 기반 센서 수신
- LLM 교육 피드백 호출과 응답 검증 (API 키는 서버에만 둔다)

프론트엔드가 `web/frontend/src/api` 의 함수 시그니처를 이미 이 명세에 맞춰 두었으므로,
서버를 만들 때 그 형태를 그대로 응답 스키마로 사용한다.
