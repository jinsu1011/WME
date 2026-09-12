# Back 세션 작업 로그

> 작업을 끝낼 때 **맨 위에** 한 칸 추가한다. 자기 파일만 쓰므로 다른 세션과 충돌하지 않는다.
> Header 세션이 이 로그들을 모아 `기획/PROGRESS.md` 에 반영한다.

---

## 2026-09-12 — BE 1차: DB·분석·API·LLM 골격

정렬 실습으로 바뀐 과정에 맞춰 백엔드 1차를 만들고 실제로 돌려서 확인했다.

- `web/backend/schema.sql` — 6테이블. `실습과정_정렬.md` 9절 반영(measurements 에서 anomaly_score 제거,
  wafer_x/y/theta 추가 / events type 은 adjustment·overshoot·manual / summary·rubric 교체).
  sqlite3 로 생성해 에러 없음 확인.
- `app/analysis.py` — **규칙 기반 정렬 경로 분석**(모델 학습 없음). 보정 구간, 과잉 보정 횟수,
  축 간섭, 수렴 패턴(위치 먼저/회전 먼저)을 계산해 events 와 summary 를 만든다. 합성 궤적 5종으로 검증.
- `app/seed.py` — 과정 1개(`photo-align`) + 데모 사용자 2명 + 시도 2건(합성, `source='mock'`).
- `app/main.py` — REST 10개 + WS 1개. 시드 데이터를 실제로 응답하는 것까지 curl 로 확인.
  준비 중 과정 409 / 없는 근거 ID 422 / attempt_no 최대값+1 동작 확인.
- `app/llm/` — 입력 구성·출력 스키마·**응답 검증**·재시도 분리. **API 키는 아직 없다.**
  키 없을 때 503 + 답변 보존 + 재시도 가능까지 확인했고, 성공 경로는 가짜 응답으로만 검증했다.
  실제 모델 호출은 아직 한 번도 하지 않았다.

**FRONT 세션에 필요한 변경 3건** — 프론트는 건드리지 않았다.
`src/types/index.ts` 가 아직 이전 컨셉(anomalyScore, anomaly_candidate, ObservationSummary)이고,
과정 ID 가 `stage-anomaly` 로 하드코딩돼 있다. 서버는 `photo-align` 과 새 지표를 쓴다.

---
