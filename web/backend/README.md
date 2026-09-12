# web/backend — WME 서버

FastAPI + SQLite. 과정은 **포토공정 입문 — 마스크·웨이퍼 정렬 실습** 하나다.
기준 문서: `기획/설계/실습과정_정렬.md`, `기획/설계/DB설계.md`.

## 실행

```bash
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
./.venv/bin/python -m app.seed              # DB 생성 + 시드
./.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

DB 파일은 `data/local/wme.db` 에 만들어진다(깃에 올라가지 않는다).

## 파일

| 파일 | 역할 |
|---|---|
| `schema.sql` | 6테이블 DDL. `실습과정_정렬.md` 9절 변경 반영 |
| `app/analysis.py` | **정렬 경로 분석 — 규칙 기반**. 과잉 보정·축 간섭·수렴 패턴. 모델 학습 없음 |
| `app/course_data.py` | 과정 정의(단계·루브릭 4개·허용 오차). 업종 내용은 전부 여기에만 |
| `app/trajectory.py` | 데모용 합성 궤적. 실측이 아니다(`source='mock'`) |
| `app/seed.py` | 시드 삽입 |
| `app/repo.py` | DB 읽기·쓰기와 응답 직렬화 |
| `app/main.py` | REST 10개 + WebSocket 1개 |
| `app/llm/prompt.py` | LLM 입력 구성 |
| `app/llm/schema.py` | 출력 JSON 스키마 + **응답 검증** |
| `app/llm/client.py` | **호출부. 여기만 API 키를 만진다** |
| `app/llm/service.py` | 입력 구성 → 호출 → 검증 → 저장 / 실패 시 재시도 |

## API 키

키는 **서버 환경변수에만** 둔다. 코드나 깃에 올라가는 파일에 넣지 않는다.

```bash
export WME_LLM_API_KEY="..."
```

키가 없으면 `POST /api/attempts/{id}/feedback` 은 503 을 돌려주고
`feedback_status='failed'` 로 남는다. **학습자가 제출한 답변은 지워지지 않고, 재시도할 수 있다.**
`GET /api/health` 의 `llmConfigured` 로 키 설정 여부만 확인할 수 있다(키 값은 내보내지 않는다).

## 지켜지는 규칙

- 재실습은 새 attempt (`attempt_no` = 최대값+1). 이전 기록을 덮어쓰지 않는다
- 준비 중 과정은 시도를 만들 수 없다 (409)
- 답변·피드백이 참조하는 근거 ID 는 그 시도의 events 에 있어야 한다 (422 / 저장 거부)
- 루브릭 점수는 길이가 루브릭 개수와 같고 값이 0·1·2 여야 한다 (저장 거부)
- 진도는 저장된 단계 기록으로만 올린다
- 학습자가 쓴 글은 데이터다. 프롬프트에서 구분자로 감싸고, 그 안의 명령문을 지시로 따르지 않는다
- 허용 오차는 **교육 과정 설정값**이며 실제 장비의 정렬 정밀도가 아니다
