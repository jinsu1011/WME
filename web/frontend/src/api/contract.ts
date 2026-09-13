/**
 * 화면이 기대하는 데이터 접근 계약.
 * mock 구현(시드 + localStorage)과 server 구현(FastAPI 호출)이 이 형태를 똑같이 지킨다.
 * 두 구현이 같은 형태여야 발표장에서 서버가 안 떠도 mock 으로 되돌릴 수 있다.
 *
 * 함수 이름과 인자는 REST 명세와 1:1이다. 마음대로 바꾸지 않는다.
 */
import type {
  AlignmentEvent,
  AlignmentSummary,
  Answer,
  Attempt,
  Course,
  Enrollment,
  InputDevice,
  InstructorRow,
  LearnerStats,
  PhaseMarker,
  PhaseName,
  Sample,
  StepId,
  User,
} from '@/types'

/** POST /api/attempts 요청 본문 */
export interface CreateAttemptInput {
  userId: string
  courseId: string
  inputDevice: InputDevice
  /** mock 모드에서만 쓴다. server 모드는 실습 중 WS 로 보내고 서버가 계산한다. */
  startedAt?: string
  samples?: Sample[]
  events?: AlignmentEvent[]
  phaseMarkers?: PhaseMarker[]
  summary?: AlignmentSummary
}

/** 피드백 생성 실패. 답변은 보존된다. */
export class FeedbackError extends Error {
  readonly retryable: boolean
  readonly answerPreserved: boolean
  constructor(message: string, retryable = true, answerPreserved = true) {
    super(message)
    this.name = 'FeedbackError'
    this.retryable = retryable
    this.answerPreserved = answerPreserved
  }
}

export interface ApiClient {
  /** GET /api/courses */
  listCourses: () => Promise<Course[]>
  /** GET /api/courses/{id} */
  fetchCourse: (id: string) => Promise<Course | undefined>
  /** GET /api/enrollments?userId= */
  listEnrollments: (userId: string) => Promise<Enrollment[]>
  /** GET /api/attempts?userId= — 목록에는 samples 가 들어오지 않는다 */
  listAttempts: (userId: string) => Promise<Attempt[]>
  /** GET /api/attempts/{id} */
  fetchAttempt: (id: string, includeSamples?: boolean) => Promise<Attempt | undefined>
  /** GET /api/instructor/overview — 구현 과정 한 줄씩 */
  instructorOverview: () => Promise<InstructorRow[]>

  /** 배정된 학습자 전체의 기록. 담당자 화면의 활동 집계에만 쓴다. */
  allAttempts: () => Promise<Attempt[]>
  fetchUser: (id: string) => Promise<User | undefined>
  statsFor: (userId: string) => Promise<LearnerStats | null>
  allLearnerStats: () => Promise<LearnerStats[]>

  /** PATCH /api/enrollments/{id}/progress */
  updateProgress: (enrollmentId: string, stepId: StepId, completed: boolean) => Promise<Enrollment | undefined>
  /** POST /api/attempts */
  createAttempt: (input: CreateAttemptInput) => Promise<Attempt>
  /** POST /api/attempts/{id}/phase */
  markPhase: (attemptId: string, phase: PhaseName, tMs: number) => Promise<Attempt | undefined>
  /** POST /api/attempts/{id}/submission */
  submitAnswer: (attemptId: string, answer: Omit<Answer, 'submittedAt'>) => Promise<Attempt | undefined>
  /** POST /api/attempts/{id}/feedback — 실패하면 FeedbackError 를 던진다 */
  requestFeedback: (attemptId: string) => Promise<Attempt | undefined>

  /**
   * 실습 중 표본을 보내는 통로.
   * server 모드는 WebSocket, mock 모드는 브라우저 안에서 직접 계산한다.
   * 화면은 어느 쪽인지 모른다.
   */
  openAlignmentChannel: (attemptId: string, handlers: ChannelHandlers) => AlignmentChannel
}

/** 서버(또는 mock)가 돌려주는 현재 오차 상태 */
export interface AlignmentState {
  tMs: number
  dx: number
  dy: number
  dTheta: number
  withinTolerance: boolean
}

export interface ChannelHandlers {
  /** 연결이 준비됐을 때. 허용 오차를 함께 받는다. */
  onReady?: (info: { tolerance: { positionPx: number; rotationDeg: number }; inputDevice: InputDevice }) => void
  /** 표본을 보낸 뒤 서버가 계산해 돌려준 상태 */
  onState?: (state: AlignmentState) => void
  onError?: (message: string) => void
  onClose?: () => void
}

export interface AlignmentChannel {
  /** 한 시점의 조작 상태를 보낸다. 초당 20~30회 정도로 제한해서 호출한다. */
  send: (sample: Omit<Sample, 'dx' | 'dy' | 'dTheta'>) => void
  close: () => void
  readonly kind: 'websocket' | 'local'
}
