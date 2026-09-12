# API 명세서

> 작성 예정. 경로 목록은 확정됐고 요청·응답 상세를 채워야 한다.
> 프론트엔드의 `web/frontend/src/api/index.ts` 함수가 이 명세와 1:1로 대응한다.

## 공통

- Base URL: `http://localhost:8000`
- 형식: JSON
- 인증: 없음(로컬 데모). 데모 계정 선택은 인증 구현이 아니다.

## REST

| # | Method / Path | 역할 | 상세 |
|---|---|---|---|
| 1 | `GET /api/courses` | 과정 카탈로그 | [ ] |
| 2 | `GET /api/courses/{id}` | 과정 상세 | [ ] |
| 3 | `GET /api/enrollments` | 배정·진도 | [ ] |
| 4 | `PATCH /api/enrollments/{id}/progress` | 단계 완료 기록 | [ ] |
| 5 | `POST /api/attempts` | 실습 시도 생성 | [ ] |
| 6 | `POST /api/attempts/{id}/phase` | 측정 단계 전환 | [ ] |
| 7 | `GET /api/attempts/{id}` | 시도·결과 조회 | [ ] |
| 8 | `POST /api/attempts/{id}/submission` | 답변 제출 | [ ] |
| 9 | `POST /api/attempts/{id}/feedback` | 피드백 생성·재시도 | [ ] |
| 10 | `GET /api/instructor/overview` | 담당자 요약 | [ ] |

## WebSocket

| Path | 역할 | 상세 |
|---|---|---|
| `WS /ws/attempts/{id}` | 실시간 측정·상태 전달 | [ ] |

## 오류 코드

| 코드 | 상황 |
|---|---|
| 404 | 대상 없음 |
| 409 | 준비 중 과정 / 잘못된 상태 전환 / 동일 장치 측정 중 |
| 422 | 입력·근거 오류 |
| 503 | 센서 또는 AI 서비스 사용 불가 |

각 경로마다 채울 것: 요청 파라미터·본문, 필수 여부, 응답 예시, 발생 가능한 오류, FE의 처리 방식.
