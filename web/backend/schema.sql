-- WME (We Make Experts) — SQLite 스키마
-- 기준 문서: 기획/설계/DB설계.md 4절 DDL + 기획/설계/실습과정_정렬.md 9절 변경분
-- 과정: 포토공정 입문 — 마스크·웨이퍼 정렬 실습
--
-- 실습과정_정렬.md 9절에 따라 DB설계.md 의 DDL에서 바뀐 곳:
--   measurements : anomaly_score 제거, wafer_x / wafer_y / wafer_theta 추가
--   events       : type 이 adjustment / overshoot / manual
--   attempts     : summary_json 의 내용이 6절 지표로 교체 (컬럼 구조는 그대로)
--   courses      : rubric_json 이 7절 루브릭 4개, content_json 에 허용 오차 설정값 추가
--   attempts     : rubric_source 추가 (규칙 기반 채점과 LLM 채점을 구분한다)
--   attempts     : status 가 aligning / aligned / submitted / feedback_ready / feedback_failed
--                  (이전 measuring / measured 를 정렬 실습 용어로 교체)
--
-- 테이블 6개 구성은 그대로다.

PRAGMA foreign_keys = ON;

-- 1. users — 데모 사용자. 비밀번호·개인정보를 저장하지 않는다.
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('learner','instructor')),
  department    TEXT NOT NULL
);

-- 2. courses — 과정
--    content_json 에 5절 단계와 허용 오차 설정값(tolerance)이 들어간다.
--    rubric_json 은 7절 루브릭 4개. 배열 순서가 rubric_scores_json 의 순서다.
CREATE TABLE IF NOT EXISTS courses (
  id                TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  subtitle          TEXT NOT NULL,
  description       TEXT NOT NULL,
  availability      TEXT NOT NULL CHECK (availability IN ('available','preview','coming_soon')),
  estimated_minutes INTEGER NOT NULL,
  content_json      TEXT NOT NULL,
  rubric_json       TEXT NOT NULL,
  version           TEXT NOT NULL
);

-- 3. enrollments — 배정·진도. 진도는 steps_completed_json 으로만 계산한다.
CREATE TABLE IF NOT EXISTS enrollments (
  id                   TEXT PRIMARY KEY,
  user_id              TEXT NOT NULL REFERENCES users(id),
  course_id            TEXT NOT NULL REFERENCES courses(id),
  status               TEXT NOT NULL CHECK (status IN ('not_started','in_progress','completed')),
  steps_completed_json TEXT NOT NULL DEFAULT '[]',
  completed_at         TEXT,
  UNIQUE (user_id, course_id)
);

-- 4. attempts — 실습 시도. 재실습은 새 행이며 이전 시도를 덮어쓰지 않는다.
--    summary_json 은 실습과정_정렬.md 6절 지표:
--    { final_dx, final_dy, final_dtheta, duration_ms,
--      adjustment_count, overshoot_count, converged }
CREATE TABLE IF NOT EXISTS attempts (
  id                  TEXT PRIMARY KEY,
  enrollment_id       TEXT NOT NULL REFERENCES enrollments(id),
  attempt_no          INTEGER NOT NULL,
  source              TEXT NOT NULL CHECK (source IN ('mock','replay','live')),
  -- 입력 장치. 센서가 없어도 실습이 성립한다(실습과정_정렬.md 10절).
  -- 화면이 "키보드 조작 / 모형 컨트롤러"를 표시하기 위해 저장한다.
  input_device        TEXT NOT NULL DEFAULT 'keyboard'
                        CHECK (input_device IN ('keyboard','model_controller')),
  -- 정렬 실습 기준 상태. aligning(정렬 중) → aligned(정렬 확정) → submitted(답변 제출)
  --                        → feedback_ready / feedback_failed
  status              TEXT NOT NULL CHECK (status IN
                        ('aligning','aligned','submitted','feedback_ready','feedback_failed')),
  started_at          TEXT NOT NULL,
  ended_at            TEXT,
  phase_markers_json  TEXT NOT NULL DEFAULT '[]',
  summary_json        TEXT,
  answer_json         TEXT,
  feedback_json       TEXT,
  feedback_status     TEXT NOT NULL DEFAULT 'none'
                        CHECK (feedback_status IN ('none','pending','ready','failed')),
  feedback_error      TEXT,
  feedback_viewed_at  TEXT,
  rubric_scores_json  TEXT,
  -- 루브릭 점수의 출처. rule = 규칙 기반 임시 채점, llm = 모델 채점.
  -- 화면이 둘을 구분해 표시해야 한다. 규칙 채점을 AI 채점이라고 말하지 않는다.
  rubric_source       TEXT CHECK (rubric_source IN ('rule','llm')),
  duration_sec        INTEGER NOT NULL DEFAULT 0,
  course_version      TEXT NOT NULL,
  model_version       TEXT NOT NULL,
  settings_version    TEXT NOT NULL,
  UNIQUE (enrollment_id, attempt_no)
);

-- 5. measurements — 시계열 측정값
--    roll/pitch 는 컨트롤러 입력(기울기), wafer_* 는 그 입력으로 움직인 화면 웨이퍼 상태다.
--    키보드로 조작할 때는 IMU 원본(ax..gyro_mag)이 없으므로 NULL 을 허용한다.
--    anomaly_score 는 실습과정_정렬.md 9절에 따라 제거했다(이상 탐지 과정이 아니다).
CREATE TABLE IF NOT EXISTS measurements (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id    TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  t_ms          INTEGER NOT NULL,
  ax REAL, ay REAL, az REAL,
  gx REAL, gy REAL, gz REAL,
  roll          REAL NOT NULL,   -- 컨트롤러 기울기(도). 키보드일 때는 환산된 등가 입력
  pitch         REAL NOT NULL,
  gyro_mag      REAL,
  wafer_x       REAL NOT NULL,   -- 화면 웨이퍼 마크 위치(px). 마스크 마크 기준 상대 좌표
  wafer_y       REAL NOT NULL,
  wafer_theta   REAL NOT NULL,   -- 화면 웨이퍼 회전(도)
  quality       TEXT NOT NULL DEFAULT 'ok' CHECK (quality IN ('ok','gap')),
  UNIQUE (attempt_id, t_ms)
);

-- 6. events — 보정 구간. 답변과 AI 피드백이 이 ID를 참조한다.
--    adjustment : 의미 있는 보정이 일어난 구간
--    overshoot  : 목표를 지나쳤다가 되돌아온 구간
--    manual     : 학습자가 직접 지정한 구간
CREATE TABLE IF NOT EXISTS events (
  id           TEXT PRIMARY KEY,
  attempt_id   TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  start_ms     INTEGER NOT NULL,
  end_ms       INTEGER NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('adjustment','overshoot','manual')),
  metrics_json TEXT NOT NULL DEFAULT '{}',
  CHECK (end_ms > start_ms)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_user     ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_enrollment  ON attempts(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_attempts_started     ON attempts(started_at);
CREATE INDEX IF NOT EXISTS idx_measurements_attempt ON measurements(attempt_id, t_ms);
CREATE INDEX IF NOT EXISTS idx_events_attempt       ON events(attempt_id);
