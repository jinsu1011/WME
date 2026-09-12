# Front 세션 작업 로그

> 작업을 끝낼 때 **맨 위에** 한 칸 추가한다. 자기 파일만 쓰므로 다른 세션과 충돌하지 않는다.
> Header 세션이 이 로그들을 모아 `기획/PROGRESS.md` 에 반영한다.

---

## 2026-09-12 — 정렬 실습으로 화면 전면 교체

`기획/설계/실습과정_정렬.md` 기준으로 데이터 → 입력 어댑터 → 화면 순서로 교체했다. 브라우저에서 확인한 것만 적는다.

- **데이터·타입**: `types/index.ts` 를 정렬 지표로 교체(`AlignmentSummary` = final_dx/dy/dtheta·duration_ms·adjustment_count·overshoot_count·converged, `Sample` 에 wafer_x/y/theta 추가, `anomalyScore` 제거). `courses.ts` 를 「포토공정 입문 — 마스크·웨이퍼 정렬 실습」으로 교체(목표 4·단계 5·루브릭 4: 정렬 정확도/조정 순서/보정 효율/설명·기록) + 카탈로그 4개 과정도 포토공정 맥락으로. 허용 오차·조작 안내·마크 이름·준비물·컨트롤러 고지 문구는 전부 `courses.ts` 의 `alignment` 설정에 둠. `seedAttempts.ts` 는 합성 궤적과 새 요약으로 재생성.
- **입력 어댑터**: `src/input/` 신설. `ControllerSource`(출력은 위치가 아니라 속도 `{vx,vy,vTheta}`) + `KeyboardSource`(방향키·Q/E·Shift 미세조정, 지금 사용) + `TiltSource`(센서 자리, `available:false` 로 미구현 명시 + 기울기→속도 변환 규칙만 공개). 화면은 인터페이스만 본다.
- **정렬 실습 화면**: 정렬 마크 SVG(고정 사각 프레임 + 움직이는 십자선 + 허용 범위 상자 + 지나온 경로), 실시간 dx/dy/dθ 숫자 표시, 허용 오차 안에 들면 색·링·문장으로 함께 표시, 조작 안내, 입력 출처 선택(키보드 사용 중 / 모형 컨트롤러 연결 안 됨), 정렬 확정 → 조정 순서·이유 폼 → 제출.
- **저장**: `src/api/index.ts` 안에서만 localStorage 처리(`createAttempt` = POST /api/attempts, `submitAnswer` = POST /api/attempts/{id}/submission). 시드 기록은 그대로 두고 새 기록만 쌓인다. 채점은 `src/lib/scoring.ts` 의 규칙 기반(과잉 보정·축 분리·이유 길이). 화면에 `AI 미연결 · 규칙 기반 샘플` 로 표시.
- **결과 화면**: 최종 오차·회전 오차·소요 시간·보정 횟수·과잉 보정·허용 범위 + 통과 여부 배지, 보정 궤적(경로 SVG + 오차 감소 선그래프, 허용 범위 기준선), 제출 답변, 규칙 기반 피드백, 기준별 확인 결과.
- **나머지 화면**: 과정 ID를 `IMPLEMENTED_COURSE_ID` 상수로 정리, 기록 목록의 `데이터 출처` → `입력 출처`(+ 시연용 기록만 `예시 데이터` 배지), 성취도 설명 문구를 과정 비의존 표현으로.
- 브라우저 확인: 키보드로 초기 오차(62px, -44px, 6.5°) → 허용 오차 안(1.4px, 0.7°) → 확정 → 제출 → 4차 기록 생성 → 결과 화면(통과, 과잉 보정 0회, 88% 충족)까지 실제로 진행. 실습 목록·현재 상황·과정·기록·대기방·교육 현황·학습자 상세 모두 새 라벨로 확인. 타입 검사·빌드·린트 통과(기존 `useDemo` fast-refresh 경고 1건만 남음).
- HEADER 확인 필요: `기획/설계/DB설계.md` 의 `attempts.source` CHECK 와 `summary_json` 설명이 이전 컨셉(mock/replay/live, 이상 후보 수)에 맞춰져 있다. 화면은 입력 출처(`keyboard`/`controller`)를 별도 필드로 두고 표시한다.
