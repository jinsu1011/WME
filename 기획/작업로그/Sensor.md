# Sensor 세션 작업 로그

> 작업을 끝낼 때 **맨 위에** 한 칸 추가한다. 자기 파일만 쓰므로 다른 세션과 충돌하지 않는다.
> Header 세션이 이 로그들을 모아 `기획/PROGRESS.md` 에 반영한다.

---

## 2026-09-13 — MPU6050 인식 및 실제 WME 수신 성공

- 사용자 재시도 요청 후 보드 리셋. INFO 보정 안내와 READY 후 실제 WME 샘플 169개 수신(115200 baud), 오류 없음.
- 수신 구간 보드 시각 3067~6427ms, 평균 50.0Hz, 샘플 간격 19~21ms.
- 실측 예: `WME,3067,-2.70,60.00,0.00`. pitch 약 60°이므로 평평한 자세 확인 후 드리프트 측정 예정.
- 1분 드리프트·방향 부호·장시간 접촉 안정성은 미측정. 이번 짧은 수신으로 회전 사용 여부는 판정하지 않음.


## 2026-09-13 — USB 재연결 후 업로드 성공, MPU6050 식별 실패

- 사용자 USB 재연결 후 Arduino UNO /dev/cu.usbmodem1101 재인식, WME 업로드 종료 코드 0으로 성공.
- 실제 시리얼 115200 baud / 8초 관찰: `ERR,MPU6050_NOT_FOUND` 23바이트, 정상 WME 샘플 0개.
- 0x68/0x69에서 예상 칩 식별값을 확인하지 못함. 센서 불량으로 단정하지 않으며 전압·배선·핀 접촉 점검이 다음 단계.
- 각도·드리프트·축 부호는 여전히 미측정. hardware/README.md 및 SENSOR_PROGRESS.md에 최신 상태 반영.


## 2026-09-13 — 실제 업로드 시도, 부트로더 무응답

- 사용자 후속 요청에 따라 검증된 WME 빌드를 Arduino Uno /dev/cu.usbmodem1101에 업로드 시도.
- 실패: arduino-cli 종료 코드 1, programmer is not responding / not in sync: resp=0x00. 성공적인 쓰기·검증 없음.
- 포트 점유 확인: 업로드 avrdude만 사용. USB DTR/RTS 리셋 후 별도 동기화 요청도 응답 0바이트.
- USB 인식과 MPU6050 연결 성공을 구분함. 센서 통신·실측은 여전히 미확인. 다음은 물리적 USB 재연결/리셋 후 재확인.


## 2026-09-13 — SENSOR 펌웨어·기록/분석 도구 준비

- `hardware/README.md` 갱신: 실제 UNO/USB 인식 상태, 조건부 배선표, 이전 ESP32 프로젝트 대신 Arduino Uno와 `/dev/cu.usbmodem1101` 선택 안내, WME 규격, 교육용 모형 고정법, 1분 측정·축 부호 확인 절차와 미측정 표.
- `hardware/firmware/wme_sensor/wme_sensor.ino`: Wire.h만 사용, 레지스터 직접 읽기, 시작 자이로 영점 보정, 중력 기반 roll/pitch, Z축 적분 yaw, 115200 baud / 목표 50Hz / WME LF 출력. 모든 코드 줄에 한국어 주석. I2C 실패 시 ERR 출력 후 정지.
- `data/capture_drift.py`: Python 표준 라이브러리 macOS 기록 도구. 30초 안정화 후 보드 시간 60초, 기존 파일 덮어쓰기 금지.
- `data/analyze_drift.py`, `data/README.md`: roll/pitch 최대-최소, yaw 끝-시작. 절댓값 1° 초과 시 화면 버튼 판정. 손상·부분 기록·리셋·큰 끊김은 판정 보류.
- 검증: Arduino AVR Boards 1.8.8 / Arduino Uno 컴파일 성공(flash 8338 bytes 25%, RAM 434 bytes 21%). 합성 경계값·오류 입력·가상 시리얼 수집·덮어쓰기 방지·코드 규격 검사 등 7개 테스트 통과. 합성 검증은 /private/tmp에서만 수행.
- **실제 업로드·MPU6050 통신·출력 주기 계측·드리프트·축 부호는 미확인/미측정.** 실측 CSV는 생성하지 않음. UNO/USB 포트 인식만 앞선 단계에서 실제 IDE로 확인.
- 모듈 정확한 5V 입력/풀업 사양은 미확인. 최초 센서 사진은 핀 미장착, 사용자는 이후 무납땜 연결을 보고했으며 실제 접촉은 검증하지 않음. 이를 확인 완료로 문서화하지 않았다.
- FRONT 연동은 FRONT 담당. 회전 채택 결과는 실측 후 HEADER에 전달. 이름·범위·구조·계수 변경 없음. web/, data/local/, PROGRESS.md, PROJECT_HEAD.md 수정 및 git commit/push 없음.
- 진행 기록: `hardware/SENSOR_PROGRESS.md`.
