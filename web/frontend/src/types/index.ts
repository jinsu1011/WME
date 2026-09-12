// 계획서 10절(DB 6테이블)과 1:1로 맞춘 타입.
// BE(FastAPI/SQLite)를 붙일 때 이 형태를 그대로 API 응답 스키마로 쓴다.

export type Role = 'learner' | 'instructor'

export interface User {
  id: string
  displayName: string
  role: Role
  /** 데모용 소속 표시. 실제 인사 데이터가 아니다. */
  department: string
}

/** 과정 공개 상태 — 카탈로그 배지와 실습 생성 가능 여부를 함께 결정한다. */
export type Availability = 'available' | 'preview' | 'coming_soon'

export type StepId = 'concept' | 'baseline' | 'practice' | 'judgement' | 'feedback'

export interface CourseStep {
  id: StepId
  title: string
  summary: string
}

/** 교육생이 고를 수 있는 점검 항목. 시연용 교육 항목이며 실제 기업 점검 절차가 아니다. */
export interface CheckItem {
  id: string
  label: string
  hint: string
}

/** 루브릭 한 항목. short 는 그래프 축 라벨, text 는 화면·AI 입력용 문장. */
export interface RubricCriterion {
  short: string
  text: string
}

export interface Course {
  id: string
  title: string
  subtitle: string
  description: string
  availability: Availability
  estimatedMinutes: number
  objectives: string[]
  prerequisites: string[]
  steps: CourseStep[]
  checkItems: CheckItem[]
  /** 피드백 기준(루브릭). AI 피드백 입력으로 그대로 전달하고, 성취도 그래프의 축이 된다. */
  rubric: RubricCriterion[]
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

/** 측정 데이터의 출처. 화면에 항상 표시하며 절대 섞어 쓰지 않는다. */
export type DataSource = 'mock' | 'replay' | 'live'

export type AttemptStatus =
  | 'measuring'
  | 'measured'
  | 'submitted'
  | 'feedback_ready'
  | 'feedback_failed'

/** 관측 단계 전환. 첫 버전은 자동 인식 없이 웹 버튼으로만 표시한다. */
export type PhaseName = 'idle' | 'moving' | 'settling' | 'ended'

export interface PhaseMarker {
  phase: PhaseName
  tMs: number
}

/** 한 시점의 측정값. roll/pitch/anomalyScore는 서버 계산 결과 자리. */
export interface Sample {
  tMs: number
  ax: number
  ay: number
  az: number
  gx: number
  gy: number
  gz: number
  roll: number
  pitch: number
  gyroMag: number
  anomalyScore: number | null
  quality: 'ok' | 'gap'
}

/** 근거로 선택할 수 있는 이상 후보 구간. */
export interface EvidenceEvent {
  id: string
  attemptId: string
  startMs: number
  endMs: number
  type: 'anomaly_candidate' | 'manual'
  metrics: {
    meanScore: number
    peakGyroMag: number
    tiltDeltaDeg: number
  }
}

export interface Answer {
  /** 선택한 근거 구간 ID. 반드시 같은 attempt의 event여야 한다. */
  evidenceIds: string[]
  checkItemId: string
  reason: string
  submittedAt: string
}

export interface Feedback {
  /** mock = 규칙 기반 샘플, llm = 실제 모델 호출 결과. 화면에 구분 표시한다. */
  generatedBy: 'mock' | 'llm'
  good: string[]
  improve: string[]
  /** 참조한 근거 구간 ID. 서버에서 유효성을 검증한 것만 남긴다. */
  evidenceIds: string[]
  nextStep: string
  cannotJudge: string[]
  generatedAt: string
}

export interface ObservationSummary {
  durationMs: number
  settlingDurationMs: number
  maxTiltDeltaDeg: number
  peakGyroMag: number
  anomalyWindowCount: number
}

/** 루브릭 항목별 달성 정도. 0=미충족, 1=부분, 2=충족. 자동 체크 + 강사 검토 결과다. */
export type RubricLevel = 0 | 1 | 2

export interface Attempt {
  id: string
  enrollmentId: string
  userId: string
  courseId: string
  attemptNo: number
  source: DataSource
  status: AttemptStatus
  startedAt: string
  endedAt: string | null
  phaseMarkers: PhaseMarker[]
  samples: Sample[]
  events: EvidenceEvent[]
  summary: ObservationSummary | null
  answer: Answer | null
  feedback: Feedback | null
  feedbackViewedAt: string | null
  /** course.rubric 과 같은 순서. 미제출 시도는 null. */
  rubricScores: RubricLevel[] | null
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
