# SKALA AI 웹서비스 주제 선정 진행 기록

> 과거 주제 선정 기록. 현재 확정 방향은 SEMI:ON B2B 사내교육이며 SEMI_ON_PROJECT_PLAN.md를 우선한다.

## 목표와 완료 기준
코딩 초보·개인·3일·Front-End 중심 조건에서 주제 10개 이상을 냉정하게 비교하고, 최종 1개의 화면·AI·DB·API·개발 일정·5분 발표를 일관되게 설계한다. 원문의 STEP 1~7과 세부 요구를 모두 충족해야 한다.

## 체크리스트
- [x] 첨부문 요구사항 추출: STEP 1~7, 아이디어별 10항목, 평가 8지표, 최종 이름 10개와 상세 설계 확인.
- [x] 전략·후보 평가: A 추천. 순수 웹 6개·센서 보조 4개 선정. 기존 제품과 공식 기술 문서 확인, 독창성을 최초 발명으로 주장하지 않음.
- [x] TOP 3·최종안 설계: TRACEON 81.0, GAPMAP 79.5, RENTCHECK 78.5. TRACEON 3화면·5테이블·9개 REST 경로/메서드와 근거 참조 흐름 대조.
- [x] 3일 개발·5분 발표·제출물 계획: 집중 작업 4+8+4=16h, 발표 300초. Day 2 종료 기능 동결, 실제 LLM 성공과 캐시 표시 구분, 산출물 목차 확정.
- [x] 검증: JavaScript로 10후보×8점수 범위·원점수·가중점수·순위 계산, 가중치100·개발16h·발표300초 확인. STEP1~7 요구사항 매핑과 데이터→AI근거→화면/API/DB 연결 검토. 실제 구현 및 사용자 효과 검증은 이번 추천·설계 범위 밖으로 명시.

## 현재 판단과 가정
- 실제 심사표·수업 외 개발 가능 시간·보유 부품·API 키는 미확인. 수상 보장 및 성공 확률 수치화 금지.
- 전공 차별화는 하드웨어 조립이 아닌 문제 선정과 데이터 해석으로도 가능하므로 A 전략 우선.
- 유력 후보: TRACEON, 실험 기록과 시계열을 연결해 이상 구간의 근거와 다음 확인 실험을 보여주는 웹서비스. 물리적 원인 확정이나 학습 모델 구축은 범위 밖.
- 기본 구현은 단일 사용자 로컬 웹, 정해진 입력 규격, 화면 3개, LLM 구조화 응답 1종. 하드웨어는 필수 아님.
- 개발 시간은 기획 4h + 구현 8h + 마감 4h = 집중 작업 16h 가정. 실제 확보 시간 부족 시 축소 기준 필요.

## 조사한 근거
- Saleae 공식 제품: https://www.saleae.com/logic — 신호 시각화·자연어 분석이 이미 존재. 최초 서비스라고 주장하지 않는다.
- Edge Impulse 공식: https://www.edgeimpulse.com/ — 범용 센서 이상 탐지 자체의 독창성은 낮게 본다.
- Wokwi 공식 ESP32 및 센서 지원: https://docs.wokwi.com/guides/esp32 , https://docs.wokwi.com/getting-started/supported-hardware
- Gemini 구조화 출력: https://ai.google.dev/gemini-api/docs/structured-output — JSON Schema 일부 지원 및 값의 의미 검증 필요.
- Recharts: https://recharts.github.io/api/AreaChart/ — syncId 기반 차트 동기화 지원.
- Espressif Arduino HTTPClient: https://github.com/espressif/arduino-esp32/blob/master/libraries/HTTPClient/src/HTTPClient.cpp

## 산출물과 다음 단계
- 수정 파일: 이 진행 기록만. 실제 서비스를 구현하는 요청이 아니라 주제 추천 및 설계 요청이다.
- 다음: 서로 다른 문제의 후보 10개를 확정하고 가중점수 계산, 최종 설계 작성.

## 후보 확정 및 평가 규칙
- A: TRACEON(실험 회고), GAPMAP(행사 공지 충돌), RENTCHECK(대여품 인수인계), PATHPLAY(사용 흐름 검토), FIXPATH(기기 점검), QUEUECRAFT(팝업 대기열).
- B: BOXTRACE(상자 취급 기록), ROOMTURN(회의실 환기 인계), SHELFREADY(필라멘트 보관), BINPULSE(쓰레기통 수거 우선순위).
- 가중치: 독창성10, 서비스15, AI15, 화면15, 전공5, 구현25, 발표10, 포트폴리오5. 총 100. 각 항목 10점 평가 후 80점 원점수와 100점 가중점수를 함께 표시.
- 동점은 구현 가능성이 높은 쪽 우선. 점수는 사용자 조건에 대한 판단이며 실측 성공확률이 아님.
- 최종 설계 방향: TRACEON, 저속 조도 실험 1종, 파일 입력은 정해진 JSON 규격, 최대 2채널, 화면 3개. 실험·관측·이벤트·분석·검증행동 5테이블.
- 다음: API/DB 일관성 및 기능 중단 기준을 구체화. 3일 시간표는 수업 시간 확정이 아닌 집중 작업 블록으로 제시.

## 최종 설계 기록
- 이름 TRACEON(상표 확인 전 가칭). 조도 저하 사례로 비전공자가 이해하도록 구성.
- 3화면: 실험 목록/입력 모달, 실험 재생 워크벤치, 검증 기록/인쇄용 보고서.
- 사용자 입력: 고정 JSON 규격, 1초 간격 저속 로그, 최대 2채널·1,000행. 합성 데모와 사용자 업로드 출처 구분. CSV 범용 파서는 제외.
- AI: 서버가 수치·이상 구간 계산 → LLM이 메모와 근거를 연결해 가설 최대 2개·다음 확인 최대 3개 생성 → 서버가 ID·시간 범위·구조 검증 → 차트 링크. 원인 확정·성공률 백분율 표시 금지.
- 모델 학습 없음. 실측값 계산은 규칙. 캐시 키는 입력/설정/프롬프트/모델 버전 포함. 입력 변경 시 과거 분석 표시, 재분석 유도.
- DB: experiments, samples, events, analyses, actions. 분석 입력 스냅샷 저장, actions는 analyses에 종속.
- API: GET/POST experiments, GET/PATCH experiments/:id, POST experiments/:id/events, PATCH events/:id, POST experiments/:id/analyses, GET analyses/:id, PATCH actions/:id.
- 스택 예시: Next.js 서버 포함 실행 + Recharts + SQLite + 구조화 출력 LLM. 수업 제공 템플릿이 있으면 그것 우선. 로컬 단일 사용자 데모로 범위 제한, 공개 배포 필수 여부는 미확인.
- 일정: Day 1 기획1h/화면1h/데이터설계1h/골격1h, Day 2 입력DB1.5h/차트1.5h/이벤트규칙1.5h/AI1.5h/저장보고서1h/검증1h, Day 3 회귀1h/제출물1h/리허설1h/여유1h.
- 발표: 20+30+20+100+50+35+25+20=300초. 가장 강한 장면은 AI 근거 카드 클릭과 해당 이상 구간·사용자 메모의 동시 강조.
- 다음: 최종 요구사항 표와 점수·시간 합계를 검증한 후 본문 전달.

## 완료 검증
- 순위/가중점수: TRACEON81.0, GAPMAP79.5, RENTCHECK78.5, PATHPLAY75.0, FIXPATH72.0, QUEUECRAFT72.0, BOXTRACE69.0, ROOMTURN63.0, SHELFREADY62.5, BINPULSE60.0.
- 동일가중 원점수는 순서대로 67,59,61,59,57,56,60,53,52,51 / 80. 최종 순위는 구현25%를 적용한 가중점수 기준.
- TRACEON 구현 가능성 7→6이면 78.5점으로 GAPMAP보다 낮아진다. 1위의 압도적 우위를 주장하지 않고 범위 준수와 개발 시간 확보를 조건으로 설명.
- 소스 범위: 인접 제품/공식 기술 문서 검토. 시장 전체 경쟁 조사 및 반 친구들과의 실제 중복 조사 아님.
- 요구 7 STEP, 10후보, 후보별10항목, 평가8지표, TOP3, 최종 이름10개, 3화면, 5테이블, 9 API 메서드/경로, 3일 및 5분 설계 모두 본문 포함 예정.
- 현재 상태: 분석·설계 완료, 최종 답변 전달. 서비스 코드/발표 PDF를 제작했다고 주장하지 않는다.
