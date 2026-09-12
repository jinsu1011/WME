# DB 설계

> 작성 예정. 테이블과 주요 컬럼은 확정됐다.
> 프론트엔드의 `web/frontend/src/types/index.ts` 가 이 스키마와 1:1로 대응한다.

## 테이블 6개

| Table | 목적 | 상세 |
|---|---|---|
| `users` | 교육생·담당자 데모 사용자 | [ ] |
| `courses` | 과정 내용·공개 상태·평가 기준·버전 | [ ] |
| `enrollments` | 배정·단계 진도·이수 상태 | [ ] |
| `attempts` | 실습 시도·답변·피드백·참조 버전 | [ ] |
| `measurements` | 시계열 측정값 | [ ] |
| `events` | 근거로 선택할 이상 후보 구간 | [ ] |

## 관계

```
users ||--o{ enrollments
courses ||--o{ enrollments
enrollments ||--o{ attempts
attempts ||--o{ measurements
attempts ||--o{ events
```

## 제약

- [ ] `(user_id, course_id)` 배정 중복 불가
- [ ] `(enrollment_id, attempt_no)` 중복 불가
- [ ] `(attempt_id, t_ms)` 측정 시각 고유
- [ ] 답변이 참조하는 event 는 같은 attempt 소속
- [ ] 준비 중 과정은 attempt 생성 불가
- [ ] 모델·교육 기준·설정 버전을 attempt 에 저장
- [ ] 재실습은 새 attempt. 이전 기록을 덮어쓰지 않음

## 채울 것

- [ ] 컬럼별 타입·NULL 허용·기본값
- [ ] JSON 컬럼의 내부 구조
- [ ] 인덱스
- [ ] ERD 이미지 → `제출/DB다이어그램.png`
