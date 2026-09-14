/**
 * server 구현 — FastAPI(web/backend) 호출.
 * 계약(`contract.ts`)은 mock 구현과 똑같다. 화면은 어느 쪽인지 모른다.
 *
 * 서버가 계산하는 것: summary, events, rubricScores, 피드백.
 * 프론트는 조작 표본만 보내고 결과를 받는다.
 */
import type {
  Answer,
  Attempt,
  Course,
  Enrollment,
  InstructorRow,
  LearnerStats,
  PhaseName,
  Sample,
  StepId,
  User,
} from '@/types'
import { IMPLEMENTED_COURSE_ID } from '@/data/courses'
import { computeLearnerStats } from '@/lib/stats'
import type {
  AlignmentChannel,
  ApiClient,
  ChannelHandlers,
  CreateAttemptInput,
} from './contract'
import { FeedbackError } from './contract'

/**
 * 비워 두면 화면과 같은 출처로 요청한다(Vite 가 /api·/ws 를 실습 서버로 넘긴다).
 * 다른 주소의 서버를 직접 부르려면 VITE_API_BASE 에 적는다.
 */
const BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.trim() ?? ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw toError(res.status, detail)
  }
  return (await res.json()) as T
}

function toError(status: number, detail: unknown): Error {
  // 서버는 피드백 실패를 {detail:{message, retryable, answerPreserved}} 로 준다.
  const body = (detail as { detail?: unknown })?.detail ?? detail
  if (body && typeof body === 'object' && 'message' in body) {
    const d = body as { message: string; retryable?: boolean; answerPreserved?: boolean }
    return new FeedbackError(d.message, d.retryable ?? true, d.answerPreserved ?? true)
  }
  const text = typeof body === 'string' ? body : `요청이 실패했습니다 (HTTP ${status})`
  return new Error(text)
}

/**
 * 과정 응답을 화면이 쓰는 형태로 맞춘다.
 * - `exerciseType` 이 없으면 alignment 로 본다(서버 기본값과 같다)
 * - `scenario` 는 최상위로 온다. judgment 가 아닌 과정은 없으므로 null 로 채운다
 */
function normalizeCourse(raw: Course): Course {
  return {
    ...raw,
    exerciseType: raw.exerciseType ?? 'alignment',
    scenario: raw.scenario ?? null,
  }
}

/** 서버 응답에 samples 가 없을 수 있다. 화면이 항상 배열을 볼 수 있게 채운다. */
function normalizeAttempt(raw: Attempt): Attempt {
  return {
    ...raw,
    samples: raw.samples ?? [],
    events: raw.events ?? [],
    phaseMarkers: raw.phaseMarkers ?? [],
    feedbackStatus: raw.feedbackStatus ?? (raw.feedback ? 'ready' : 'none'),
    feedbackError: raw.feedbackError ?? null,
    rubricSource: raw.rubricSource ?? null,
    rubricReasons: raw.rubricReasons ?? null,
  }
}

async function listCourses(): Promise<Course[]> {
  const list = await request<Course[]>('/api/courses')
  return list.map(normalizeCourse)
}

async function fetchCourse(id: string): Promise<Course | undefined> {
  try {
    return normalizeCourse(await request<Course>(`/api/courses/${id}`))
  } catch {
    return undefined
  }
}

async function listEnrollments(userId: string): Promise<Enrollment[]> {
  return request<Enrollment[]>(`/api/enrollments?userId=${encodeURIComponent(userId)}`)
}

async function listAttempts(userId: string): Promise<Attempt[]> {
  const list = await request<Attempt[]>(`/api/attempts?userId=${encodeURIComponent(userId)}`)
  return list.map(normalizeAttempt).sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

async function fetchAttempt(id: string, includeSamples = true): Promise<Attempt | undefined> {
  try {
    const raw = await request<Attempt>(
      `/api/attempts/${id}?includeSamples=${includeSamples ? 'true' : 'false'}`,
    )
    return normalizeAttempt(raw)
  } catch {
    return undefined
  }
}

/** 서버는 배정된 모든 과정을 한 줄씩 준다. 화면은 실습 과정 한 줄만 쓴다. */
interface RawOverviewRow {
  user: User
  courseId: string
  enrollment: Enrollment
  attemptCount: number
  latestAttempt: Attempt | null
  needsReview: boolean
}

async function instructorOverview(): Promise<InstructorRow[]> {
  const [rows, course] = await Promise.all([
    request<RawOverviewRow[]>('/api/instructor/overview'),
    fetchCourse(IMPLEMENTED_COURSE_ID),
  ])
  if (!course) return []
  return rows
    .filter((r) => r.courseId === course.id)
    .map((r) => ({
      user: r.user,
      course,
      enrollment: r.enrollment,
      attemptCount: r.attemptCount,
      latestAttempt: r.latestAttempt ? normalizeAttempt(r.latestAttempt) : null,
      needsReview: r.needsReview,
    }))
}

/** 배정된 학습자 전체의 기록. 담당자 화면의 활동 집계용이다. */
async function allAttempts(): Promise<Attempt[]> {
  const learners = await listLearners()
  const lists = await Promise.all(learners.map((u) => listAttempts(u.id)))
  return lists.flat()
}

/** GET /api/users/{id} — 이름·소속은 서버에서만 읽는다(화면에 따로 들고 있지 않는다). */
async function fetchUser(id: string): Promise<User | undefined> {
  try {
    return await request<User>(`/api/users/${id}`)
  } catch {
    return undefined
  }
}

/** GET /api/users?role=learner */
async function listLearners(): Promise<User[]> {
  return request<User[]>('/api/users?role=learner')
}

/** 집계는 프론트가 한다(서버가 주는 배정·시도 기록에서만 계산한다). */
async function statsFor(userId: string): Promise<LearnerStats | null> {
  const user = await fetchUser(userId)
  if (!user) return null
  const [enrollments, attempts] = await Promise.all([listEnrollments(userId), listAttempts(userId)])
  return computeLearnerStats(user, enrollments, attempts)
}

async function allLearnerStats(): Promise<LearnerStats[]> {
  const learners = await listLearners()
  return Promise.all(
    learners.map(async (user) => {
      const [enrollments, attempts] = await Promise.all([
        listEnrollments(user.id),
        listAttempts(user.id),
      ])
      return computeLearnerStats(user, enrollments, attempts)
    }),
  )
}

async function updateProgress(
  enrollmentId: string,
  stepId: StepId,
  completed: boolean,
): Promise<Enrollment | undefined> {
  return request<Enrollment>(`/api/enrollments/${enrollmentId}/progress`, {
    method: 'PATCH',
    body: JSON.stringify({ stepId, completed }),
  })
}

async function createAttempt(input: CreateAttemptInput): Promise<Attempt> {
  const raw = await request<Attempt>('/api/attempts', {
    method: 'POST',
    body: JSON.stringify({
      userId: input.userId,
      courseId: input.courseId,
      source: 'live',
      inputDevice: input.inputDevice,
    }),
  })
  return normalizeAttempt(raw)
}

async function markPhase(
  attemptId: string,
  phase: PhaseName,
  tMs: number,
): Promise<Attempt | undefined> {
  const raw = await request<Attempt>(`/api/attempts/${attemptId}/phase`, {
    method: 'POST',
    body: JSON.stringify({ phase, tMs }),
  })
  return normalizeAttempt(raw)
}

async function submitAnswer(
  attemptId: string,
  answer: Omit<Answer, 'submittedAt'>,
): Promise<Attempt | undefined> {
  const raw = await request<Attempt>(`/api/attempts/${attemptId}/submission`, {
    method: 'POST',
    // 실습 유형에 따라 답변 형태가 다르다. 있는 것만 보낸다(서버가 형태를 검증한다).
    body: JSON.stringify({
      ...(answer.orderOptionId ? { orderOptionId: answer.orderOptionId } : {}),
      ...(answer.orderedIds ? { orderedIds: answer.orderedIds } : {}),
      reason: answer.reason,
    }),
  })
  return normalizeAttempt(raw)
}

async function requestFeedback(attemptId: string): Promise<Attempt | undefined> {
  const raw = await request<Attempt>(`/api/attempts/${attemptId}/feedback`, { method: 'POST' })
  return normalizeAttempt(raw)
}

/** WebSocket 채널. 프론트는 표본만 보내고 서버가 계산한 오차를 받는다. */
function openAlignmentChannel(attemptId: string, handlers: ChannelHandlers): AlignmentChannel {
  const origin = BASE || window.location.origin
  const wsUrl = `${origin.replace(/^http/, 'ws')}/ws/attempts/${attemptId}`
  const socket = new WebSocket(wsUrl)
  const queue: string[] = []

  socket.onopen = () => {
    // 연결 전에 밀린 표본을 순서대로 보낸다.
    while (queue.length > 0) socket.send(queue.shift()!)
  }

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string)
      if (msg.type === 'ready') {
        handlers.onReady?.({ tolerance: msg.tolerance, inputDevice: msg.inputDevice })
      } else if (msg.type === 'state') {
        handlers.onState?.({
          tMs: msg.tMs,
          dx: msg.dx,
          dy: msg.dy,
          dTheta: msg.dtheta ?? msg.dTheta,
          withinTolerance: Boolean(msg.withinTolerance),
        })
      } else if (msg.type === 'error') {
        handlers.onError?.(String(msg.message ?? '수신 중 문제가 발생했습니다.'))
      }
    } catch {
      handlers.onError?.('서버 메시지를 읽지 못했습니다.')
    }
  }

  socket.onerror = () => handlers.onError?.('실습 서버와의 연결에 문제가 있습니다.')
  socket.onclose = () => handlers.onClose?.()

  return {
    kind: 'websocket',
    send: (sample: Omit<Sample, 'dx' | 'dy' | 'dTheta'>) => {
      const payload = JSON.stringify({ type: 'sample', ...sample })
      if (socket.readyState === WebSocket.OPEN) socket.send(payload)
      else if (socket.readyState === WebSocket.CONNECTING) queue.push(payload)
    },
    close: () => {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close()
      }
    },
  }
}

export const serverApi: ApiClient = {
  listCourses,
  fetchCourse,
  listEnrollments,
  listAttempts,
  fetchAttempt,
  instructorOverview,
  allAttempts,
  fetchUser,
  statsFor,
  allLearnerStats,
  updateProgress,
  createAttempt,
  markPhase,
  submitAnswer,
  requestFeedback,
  openAlignmentChannel,
}


