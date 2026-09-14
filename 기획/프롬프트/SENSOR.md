<!-- 이 파일 전체를 새 SENSOR 대화의 첫 메시지에 붙여넣는다. 마지막 갱신: 2026-09-14 밤 4 (HEADER, 결정 15 반영 · 펌웨어 수정 허용) -->

한국어로 답해줘. 나는 코딩 경험이 거의 없는 SKALA 교육생이고, 3일짜리 AI 웹서비스
미니 프로젝트를 하는 중이야. 초보가 이해할 수 있게 설명하고, 내가 해야 할 동작은
**한 번에 하나씩** 안내해줘.

이 대화는 **SENSOR 세션**이야. `hardware/`와 `data/`만 담당해.

## 이번 목표 — 딱 하나

> **내가 센서 모형을 기울이고 돌리면, 웹 화면(정렬 실습의 3D 장비 뷰)이 그대로 따라 움직인다.**

이 세션은 **보드 쪽**을 끝낸다: 50Hz 펌웨어가 올라가 있고, 보정 실패로 멈추지 않고, `WME,` 줄이 끊김 없이 나온다.
화면 쪽(연결 안정화, 회전을 "각도 그대로" 방식으로 바꾸기)은 **FRONT(센서) 세션**이 한다. 이 세션이 보드를 끝낸 뒤 시작한다.

드리프트 3분 측정 같은 정식 측정은 **이번에 하지 않는다.**

## 먼저 읽을 것 (프로젝트 루트 기준)

1. `hardware/README.md`
2. `hardware/firmware/wme_sensor/wme_sensor.ino`
3. `hardware/SENSOR_PROGRESS.md` (맨 위 "최신 상태")
4. `기획/작업로그/Sensor.md`, `기획/작업로그/Header.md` 맨 위 (밤 3·밤 4)
5. `web/frontend/src/input/TiltSource.ts`, `serial.ts` — **읽기만.** 화면이 센서 줄을 어떻게 읽는지 확인용

읽은 뒤 아래 "할 일"을 짧은 체크리스트로 보고하고, 내가 준비됐다고 할 때 시작해.

---

## 담당 범위

- 쓰기: `hardware/`, `data/` (`data/local/` 제외), 끝날 때 `기획/작업로그/Sensor.md` 맨 위
- 읽기만: 그 외 전부. **`web/` 코드는 고치지 않는다** (FRONT 센서 세션 담당)
- 화면 확인을 위해 프론트 개발 서버를 켜는 것은 허용 (`npm --prefix web/frontend run dev`)
- 이름·범위·구조 변경은 여기서 정하지 않는다. git commit/push 는 하지 않는다

## HEADER 가 확인한 사실 (2026-09-14 밤)

| 항목 | 상태 |
|---|---|
| 보드 | Arduino UNO + MPU-6050 (`5V→VCC`, `GND→GND`, `A4→SDA`, `A5→SCL`), 납땜 완료 |
| 포트 | 회사 맥북에서 `/dev/cu.usbmodem101`. **집 컴퓨터는 다를 수 있다** → `ls /dev/cu.usbmodem*` |
| 펌웨어 | ⚠️ **임시 1Hz 펌웨어**가 올라가 있었다(보드 시각 1000ms 간격). 50Hz 로 바뀌었는지 기록 없음 |
| 알려진 문제 1 | 포트를 열면 보드가 리셋 → 2초 보정 → **그동안 움직이면 `ERR,KEEP_STILL_AND_RESET` 후 무한 정지**. 화면은 이 줄을 버려서 "연결됨인데 값 없음"으로 보인다 |
| 알려진 문제 2 | 타이밍이 한 번 20ms 이상 밀리면 `ERR,SAMPLE_TIMING_FAILED` 후 무한 정지 |
| 도구 | 회사 맥북에는 `arduino-cli` 설치됨. 집 컴퓨터는 확인 필요 |

## 할 일 — 이 순서로

### 0. 환경 확인
- `ls /dev/cu.usbmodem*` 로 포트 찾기, `lsof <포트>` 로 점유 확인 (IDE 시리얼 모니터·`screen`·크롬 연결이 잡고 있으면 안 된다)
- `which arduino-cli` — 없으면 **무엇을 설치하는지 말하고 내 허락을 받은 뒤** `brew install arduino-cli` → `arduino-cli core update-index` → `arduino-cli core install arduino:avr`

### 1. 지금 보드에 무엇이 올라가 있는지 (10초 읽기)
- 센서를 평평한 책상에 두고 손을 뗀 상태에서 115200 baud 로 10초 읽는다 (Python 표준 라이브러리 `termios`, **다 읽으면 포트를 닫는다**)
- 보고: 시작 줄(`INFO`/`ERR`), `WME` 줄 수, 보드 시각 간격(20ms 인지 1000ms 인지)

### 2. 펌웨어 수정 — ★ HEADER 가 허용한 두 가지만 ★

`hardware/firmware/wme_sensor/wme_sensor.ino` 에서:

**(a) 보정 중 움직이면 멈추지 말고 다시 보정한다**
- 지금: 움직임 감지 → `haltSensor(F("KEEP_STILL_AND_RESET"))` → 무한 정지
- 바꿈: `ERR,KEEP_STILL_RETRY` 한 줄을 내보내고 약 0.5초 기다린 뒤 **보정을 처음부터 다시**. 성공할 때까지 반복
- 매 시도 시작마다 `INFO,KEEP_STILL_CALIBRATING` 을 다시 내보낸다 (화면이 "가만히 두세요"를 띄울 수 있게)

**(b) 타이밍이 밀리면 멈추지 말고 다시 맞춘다**
- 지금: 20ms 이상 밀리면 `haltSensor(F("SAMPLE_TIMING_FAILED"))`
- 바꿈: `nextUs = nowUs` 로 주기를 다시 잡고 계속 측정. 밀린 샘플을 몰아서 내보내지 않는다. `INFO,TIMING_RESYNC` 한 줄은 내보내도 된다

**바꾸지 않는 것**
- 출력 규격 `WME,<t_ms>,<roll>,<pitch>,<yaw>\n`, 115200 baud, 20ms(50Hz), 소수 둘째 자리
- roll·pitch 계산, yaw 적분, 자이로 영점, 센서 설정 레지스터
- `MPU6050_NOT_FOUND`·I2C 읽기 실패의 정지 처리 (배선 문제는 가짜 값을 내지 않고 멈추는 게 맞다)
- 외부 라이브러리 추가 금지 (`Wire.h` 만), 모든 줄의 한국어 주석 스타일 유지

### 3. 컴파일 · 업로드

```bash
arduino-cli compile --fqbn arduino:avr:uno hardware/firmware/wme_sensor
arduino-cli upload  -p <포트> --fqbn arduino:avr:uno hardware/firmware/wme_sensor
```

- 경로에 한글·공백 때문에 실패하면 스케치 폴더를 `/private/tmp/wme_sensor/` 로 **복사해서** 컴파일·업로드 (원본은 저장소에 그대로, 수정은 원본에)
- `programmer is not responding` 이면 포트 점유 확인 → USB 뽑았다 꽂기 → 다시

### 4. 보드 동작 확인 (시험 3개, 결과 표로)

| 시험 | 방법 | 기대 |
|---|---|---|
| 정상 | 평평하게 두고 10초 읽기 | `INFO,KEEP_STILL_CALIBRATING` → `INFO,READY` → `WME` 약 50Hz, 간격 19~21ms, `ERR` 0 |
| 보정 중 움직임 | 포트를 연 직후(리셋) 모형을 흔들다가 3초 뒤 내려놓기 | `ERR,KEEP_STILL_RETRY` 가 몇 번 나온 뒤 **스스로** `INFO,READY` → `WME` 출력 |
| 축 움직임 | 읽는 동안 좌우로 기울이기 → 앞뒤로 기울이기 → 위에서 보고 시계 방향으로 돌리기 | 각각 roll / pitch / yaw 가 크게 바뀐다. **어느 방향일 때 + 인지** 적는다 |

### 5. 화면에서 수신만 확인 (코드 안 고침)
1. 포트를 닫는다 (크롬이 포트를 잡아야 한다)
2. `npm --prefix web/frontend run dev` (이미 떠 있으면 그대로) → **크롬** `http://localhost:5173`
3. 나에게 한 단계씩 안내: 신입사원 `1`/`1` → 정렬 실습 → 대기방 → **`연습 시작` 누르기 전에** 입력 출처 `모형 컨트롤러` 선택 →
   `모형 컨트롤러 연결` → 포트 선택(**내가 직접 누른다**) → **3초간 손 떼기** → `영점 잡기`
4. 확인: 패널 값이 계속 바뀌는지 / 기울이면 3D 스테이지가 기우는지(방향이 같은지) / 값이 부드럽게 바뀌는지(50Hz)
5. **화면 문제는 고치지 않고 기록한다** — FRONT 센서 세션에 넘긴다. 특히: 연결이 실패했으면 화면에 뜬 문구 그대로, 크롬 콘솔 오류

### 6. 기록 · 인계
- `hardware/SENSOR_PROGRESS.md` 최신 상태, `hardware/README.md` 출력 규격에 `INFO`/`ERR` 줄 종류 추가, `기획/작업로그/Sensor.md` 맨 위
- **FRONT 센서 세션에 넘길 내용**을 로그 끝에 따로 적는다:
  - 보드가 내보내는 `INFO`/`ERR` 줄 전체 목록과 뜻
  - 축 부호 표 (좌우·앞뒤·시계 방향이 각각 + 인지 −)
  - 5번에서 본 화면 문제

## 기록 원칙
- 실제 센서에서 읽은 숫자만 "확인했다"고 쓴다. 짧은 관찰은 "참고"로
- 1Hz 에서 본 값과 50Hz 값을 섞지 않는다
- 포트가 끊기거나 보드가 리셋되면 숨기지 않는다
- 센서를 붙인 모형은 **교육용 컨트롤러**다
- 최종 상태는 **저장소의 수정된 50Hz 펌웨어**가 보드에 올라가 있는 것
