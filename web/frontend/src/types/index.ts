// 계획서 10절(DB 6테이블)과 1:1로 맞춘 타입.
// BE(FastAPI/SQLite)를 붙일 때 이 형태를 그대로 API 응답 스키마로 쓴다.
// 실습 과정 정의는 기획/설계/실습과정_정렬.md 가 기준이다.
// snake_case 인 DB 컬럼명과의 대응은 각 주석에 적는다.

export type Role = 'learner' | 'instructor'

export interface User {
  id: string
  displayName: string
  role: Role
  /** 데모용 소속 표시. 실제 인사 데이터가 아니다. */
  department: string
}

/**
 * 실습 유형 (기획/설계/실습유형_설계.md 3절).
 * alignment = 마스크·웨이퍼 정렬(키보드/모형 컨트롤러 조작)
 * judgment  = 상황 판단·확인 순서(조작 없음, 순서 배열 + 서술)
 * 서버 응답에 없으면 alignment 로 본다(서버 기본값과 같다).
 */
export type ExerciseType = 'alignment' | 'judgment'

/** 과정 공개 상태 — 카탈로그 배지와 실습 생성 가능 여부를 함께 결정한다. */
export type Availability = 'available' | 'preview' | 'coming_soon'

/** 정렬 실습의 5단계 (실습과정_정렬.md 5절). */
export type StepId = 'concept' | 'marks' | 'align' | 'submit' | 'feedback'

export interface CourseStep {
  id: StepId
  title: string
  summary: string
}

/** 답변 폼의 선택지 한 개. 과정 내용이므로 문구는 전부 src/data 에만 둔다. */
export interface ChoiceOption {
  id: string
  label: string
  hint: string
}

/** 루브릭 한 항목. short 는 그래프 축 라벨, text 는 화면·AI 입력용 문장. */
export interface RubricCriterion {
  short: string
  text: string
}

/** 조작 안내 한 줄. "방향키 = 위치" 같은 문구를 컴포넌트에 직접 쓰지 않기 위해 데이터로 둔다. */
export interface ControlHint {
  keys: string
  effect: string
}

/**
 * 정렬 실습의 과정 설정값. DB 의 courses.content_json 에 들어간다.
 * 허용 오차는 **교육 과정 설정값이며 실제 장비의 정렬 정밀도가 아니다.**
 */
export interface AlignmentSettings {
  /** 허용 위치 오차 (화면 px) */
  tolerancePx: number
  /** 허용 회전 오차 (도) */
  toleranceDeg: number
  /** 화면 px 을 교육용으로 환산해 보여줄 때 쓰는 값. 장비 실측 환산이 아니다. */
  umPerPx: number
  /** 실습 시작 시 웨이퍼 마크가 어긋나 있는 초기 위치 */
  startOffset: { x: number; y: number; theta: number }
  /** 조작 안내 문구 */
  controls: ControlHint[]
  /** 교육용 컨트롤러임을 밝히는 문구. 화면에 항상 표시한다. */
  controllerNotice: string
  /** 정렬 마크 이름. 업종 문구이므로 컴포넌트에 직접 쓰지 않는다. */
  markLabels: { fixed: string; moving: string }
  /** 화면 시야(반지름, px). 움직이는 마크가 이 밖으로 나가지 않게 막는다. */
  fieldRadius: number
  /** 실습 준비물. 문구를 컴포넌트에 쓰지 않기 위해 데이터로 둔다. */
  materials: string[]
}

/**
 * 기울기 → 이동 변환 계수. 과정 설정값이며 서버가 준다.
 * 화면·입력 어댑터에 숫자를 직접 적지 않고 이 값을 쓴다.
 */
export interface ControlSettings {
  deadZoneDeg: number
  gainPxPerDeg: number
  maxSpeedPx: number
  yawDeadZoneDeg: number
  yawGainDegPerDeg: number
  maxSpeedDeg: number
  keyboard: { movePxPerSec: number; rotateDegPerSec: number; fineFactor: number }
}

/** judgment 실습의 시나리오. 문구는 전부 과정 데이터 안에 있다. */
export interface ScenarioObservation {
  label: string
  value: string
}

export interface ScenarioCheckItem {
  id: string
  label: string
}

export interface JudgmentScenario {
  situation: string
  observations: ScenarioObservation[]
  checkItems: ScenarioCheckItem[]
  /** 이 교육 과정이 정한 확인 순서. **제출 전에는 화면에 보여주지 않는다.** */
  recommendedOrder: string[]
  /** 권장 순서가 정답이 아니라는 표시. 결과 화면에 항상 함께 둔다. */
  orderNote: string
  /** 왜 그 순서인지. 제출 후에만 보여준다. */
  rationale: string
}

export interface Course {
  id: string
  title: string
  subtitle: string
  description: string
  availability: Availability
  /** 어떤 실습 화면을 쓸지 고른다. */
  exerciseType: ExerciseType
  estimatedMinutes: number
  objectives: string[]
  prerequisites: string[]
  steps: CourseStep[]
  /** 제출 폼에서 고르는 조정 순서 선택지 */
  orderOptions: ChoiceOption[]
  /** 피드백 기준(루브릭). AI 피드백 입력으로 그대로 전달하고, 성취도 그래프의 축이 된다. */
  rubric: RubricCriterion[]
  /** 정렬 실습 과정만 가진다. 소개·준비 중 과정은 없다. */
  alignment: AlignmentSettings | null
  /** 기울기 → 이동 변환 계수. 과정 설정값이며 서버가 준다. */
  control: ControlSettings | null
  /** judgment 실습만 가진다. */
  scenario: JudgmentScenario | null
  version: string
}

export type EnrollmentStatus = 'not_started' | 'in_progress' | 'completed'

export interface Enrollment {
  id: string
  userId: string
  courseId: string
  status: EnrollmentStatus
  stepsCompleted: StepId[]
  completedAt: string | null
}

/** 기록의 출처. 시연용 예시 기록과 실제 조작 기록을 섞어 보여주지 않는다. */
export type DataSource = 'mock' | 'replay' | 'live'

/**
 * 무엇으로 움직이는 마크를 조작했는지. 화면에 항상 표시한다.
 * keyboard = 키보드 조작, model_controller = 센서를 붙인 교육용 모형 컨트롤러.
 * 이름과 값은 서버 응답(`inputDevice`)과 1:1로 맞춘다.
 */
export type InputDevice = 'keyboard' | 'model_controller'

export type AttemptStatus = 'aligning' | 'aligned' | 'submitted' | 'feedback_ready' | 'feedback_failed'

/** 피드백 생성 상태. 실패해도 제출한 답변은 보존된다. */
export type FeedbackStatus = 'none' | 'pending' | 'ready' | 'failed'

/** 실습 진행 상태 전환. 자동 인식 없이 화면 버튼으로만 기록한다. */
export type PhaseName = 'idle' | 'aligning' | 'confirmed' | 'submitted'

export interface PhaseMarker {
  phase: PhaseName
  tMs: number
}

/**
 * 한 시점의 기록. DB measurements 테이블 한 행.
 * roll/pitch 는 컨트롤러 입력(키보드일 때는 0), wafer* 는 화면 속 웨이퍼 마크 상태다.
 */
export interface Sample {
  tMs: number
  roll: number
  pitch: number
  waferX: number
  waferY: number
  waferTheta: number
  /** 고정 마크 기준 남은 오차 */
  dx: number
  dy: number
  dTheta: number
  /** 수신 품질. 서버가 준다. */
  quality?: 'ok' | 'gap'
}

/** 보정 구간. 규칙 기반으로 계산하며 학습자가 고르는 값이 아니다. */
export interface AlignmentEvent {
  id: string
  attemptId: string
  startMs: number
  endMs: number
  /** adjustment = 보정 구간, overshoot = 목표를 지나쳤다 되돌아온 구간, manual = 학습자 표시 */
  type: 'adjustment' | 'overshoot' | 'manual'
  /** 어떤 축을 움직인 구간인지 */
  axis: 'xy' | 'theta'
  metrics: {
    /** 구간 시작 시점의 남은 오차 (px 또는 도) */
    errorBefore: number
    /** 구간 끝 시점의 남은 오차 */
    errorAfter: number
  }
}

export interface Answer {
  /** alignment — course.orderOptions 의 id. 어떤 순서로 조정했는지 */
  orderOptionId?: string
  /** judgment — 확인 순서. scenario.checkItems 의 id 를 빠짐없이 한 번씩 담는다 */
  orderedIds?: string[]
  /** 왜 그 순서로 했는지 (루브릭 4번 '설명·기록'의 근거) */
  reason: string
  submittedAt: string
}

export interface Feedback {
  /** mock = 규칙 기반 샘플, llm = 실제 모델 호출 결과. 화면에 구분 표시한다. */
  generatedBy: 'mock' | 'llm'
  good: string[]
  improve: string[]
  /** 참조한 보정 구간 ID. 서버에서 유효성을 검증한 것만 남긴다. */
  eventIds: string[]
  nextStep: string
  cannotJudge: string[]
  generatedAt: string
}

/**
 * 정렬 결과 요약 (실습과정_정렬.md 6절). DB attempts.summary_json.
 * finalDx=final_dx, finalDy=final_dy, finalDTheta=final_dtheta,
 * durationMs=duration_ms, adjustmentCount=adjustment_count,
 * overshootCount=overshoot_count, converged=converged
 */
export interface AlignmentSummary {
  /** 최종 위치 오차 (화면 px) */
  finalDx: number
  finalDy: number
  /** 최종 회전 오차 (도) */
  finalDTheta: number
  durationMs: number
  adjustmentCount: number
  overshootCount: number
  /** 과정 설정값인 허용 오차 안에 들어왔는지 */
  converged: boolean
  /** 서버의 규칙 기반 경로 분석 결과. 화면은 위 7개 값만 쓴다. */
  pathAnalysis?: Record<string, unknown>
}

/**
 * judgment 실습의 결과 요약 (설계서 7.5).
 * 채점기는 이 값들만 보므로 도메인 단어가 들어가지 않는다.
 */
export interface JudgmentSummary {
  durationMs: number
  /** 1순위로 놓은 항목이 권장 순서에서 몇 번째인가 (1부터) */
  firstPickRank: number
  /** 각 항목의 (학습자 위치 − 권장 위치) 절댓값 합. 0이면 완전 일치 */
  orderDistance: number
  /** 상위 3개가 권장 상위 3개와 겹치는 개수 (0~3) */
  top3Overlap: number
  answerLength: number
  /** orderDistance <= 4 이면 참 */
  passed: boolean
}

/** 시도 요약. 실습 유형에 따라 담기는 값이 다르다. */
export type AttemptSummary = AlignmentSummary | JudgmentSummary

/** 어느 유형의 요약인지 가른다. */
export function isAlignmentSummary(summary: AttemptSummary | null): summary is AlignmentSummary {
  return summary !== null && 'finalDx' in summary
}

/** 루브릭 항목별 달성 정도. 0=미충족, 1=부분, 2=충족. */
export type RubricLevel = 0 | 1 | 2

/**
 * 누가 채점했는지. 화면에 반드시 구분해서 표시한다.
 * rule = 규칙 기반 임시 채점(AI 미연결), llm = 실제 모델 채점.
 */
export type RubricSource = 'rule' | 'llm'

export interface Attempt {
  id: string
  enrollmentId: string
  userId: string
  courseId: string
  attemptNo: number
  /** 시연용 예시 기록인지 실제 조작 기록인지 */
  source: DataSource
  /** 무엇으로 조작했는지 */
  inputDevice: InputDevice
  status: AttemptStatus
  startedAt: string
  endedAt: string | null
  phaseMarkers: PhaseMarker[]
  /** 목록 응답에는 들어오지 않는다. 상세 조회에서만 채워진다. */
  samples: Sample[]
  events: AlignmentEvent[]
  summary: AttemptSummary | null
  answer: Answer | null
  feedback: Feedback | null
  /** 피드백 생성 상태. 실패 시 화면에 다시 시도 버튼을 둔다. */
  feedbackStatus: FeedbackStatus
  /** 생성 실패 이유. 답변은 보존된다. */
  feedbackError: string | null
  feedbackViewedAt: string | null
  /** course.rubric 과 같은 순서. 미제출 시도는 null. */
  rubricScores: RubricLevel[] | null
  /** 규칙 기반인지 모델 채점인지. 채점 전이면 null. */
  rubricSource: RubricSource | null
  /** 기준별 채점 이유. 규칙 기반 채점일 때만 온다. course.rubric 과 같은 순서. */
  rubricReasons: string[] | null
  /** 실습에 사용한 시간(초). 학습 활동량 집계에만 쓴다. */
  durationSec: number
  /** 재현성을 위해 시도 시점의 버전을 고정 저장한다. */
  courseVersion: string
  modelVersion: string
  settingsVersion: string
}

/** 한 학습자의 집계 지표. 저장된 attempt/enrollment 에서만 계산한다. */
export interface LearnerStats {
  user: User
  assignedCourses: number
  completedCourses: number
  /** 배정 과정의 단계 완료 비율 0~100 */
  progressPct: number
  attemptCount: number
  submittedCount: number
  /** 루브릭 항목별 평균 달성도 0~100. 제출한 시도가 없으면 null. */
  rubricPct: number[] | null
  /** 최근 시도부터 순서대로의 전체 루브릭 달성도 0~100 */
  rubricTrend: { label: string; value: number }[]
  lastActiveAt: string | null
  needsReview: boolean
}

/** 강사 화면 한 줄. 실제 저장 기록에서만 만든다. */
export interface InstructorRow {
  user: User
  course: Course
  enrollment: Enrollment
  attemptCount: number
  latestAttempt: Attempt | null
  needsReview: boolean
}
