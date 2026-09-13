/**
 * mock 구현 — 시드 데이터 + localStorage. **발표장 백업 경로다. 지우지 않는다.**
 * 서버가 없어도 실습·채점·피드백이 전부 브라우저 안에서 동작한다.
 *
 * 계약(`contract.ts`)은 server 구현과 똑같다. 화면은 어느 쪽인지 모른다.
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
import { courses, getCourse, IMPLEMENTED_COURSE_ID } from '@/data/courses'
import { learners, seedEnrollments, users } from '@/data/people'
import { seedAttempts } from '@/data/seedAttempts'
import { computeLearnerStats } from '@/lib/stats'
import { detectOvershoots, isWithinTolerance } from '@/lib/alignment'
import { scoreAlignment, scoreJudgment } from '@/lib/scoring'
import { judgmentMetrics } from '@/lib/judgment'
import type {
  AlignmentChannel,
  ApiClient,
  ChannelHandlers,
  CreateAttemptInput,
} from './contract'

const enrollments: Enrollment[] = seedEnrollments.map((e) => ({ ...e }))

/** 브라우저에 남는 학습자 기록. server 모드에서는 쓰지 않는다. */
const STORAGE_KEY = 'wme.attempts.v1'

function loadSaved(): Attempt[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Attempt[]) : []
  } catch {
    return []
  }
}

function persist(list: Attempt[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    console.warn('[wme] 실습 기록을 브라우저에 저장하지 못했습니다.')
  }
}

let saved: Attempt[] = loadSaved()

function allRecords(): Attempt[] {
  return [...seedAttempts, ...saved]
}

/** 기록이 너무 길어지면 저장 전에 솎아낸다. 모양은 유지하고 개수만 줄인다. */
function thin<T>(list: T[], max = 240): T[] {
  if (list.length <= max) return list
  const step = list.length / max
  return Array.from({ length: max }, (_, i) => list[Math.floor(i * step)]!)
}

async function listCourses(): Promise<Course[]> {
  return courses
}

async function fetchCourse(id: string): Promise<Course | undefined> {
  return getCourse(id)
}

async function listEnrollments(userId: string): Promise<Enrollment[]> {
  return enrollments.filter((e) => e.userId === userId)
}

async function listAttempts(userId: string): Promise<Attempt[]> {
  return allRecords()
    .filter((a) => a.userId === userId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

async function fetchAttempt(id: string): Promise<Attempt | undefined> {
  return allRecords().find((a) => a.id === id)
}

async function allAttemptsOf(): Promise<Attempt[]> {
  return allRecords()
}

async function fetchUser(id: string): Promise<User | undefined> {
  return users.find((u) => u.id === id)
}

async function statsFor(userId: string): Promise<LearnerStats | null> {
  const user = users.find((u) => u.id === userId)
  if (!user) return null
  return computeLearnerStats(user, enrollments, allRecords())
}

async function allLearnerStats(): Promise<LearnerStats[]> {
  return learners.map((u) => computeLearnerStats(u, enrollments, allRecords()))
}

async function instructorOverview(): Promise<InstructorRow[]> {
  const records = allRecords()
  return learners.map((user) => {
    const enrollment = enrollments.find(
      (e) => e.userId === user.id && e.courseId === IMPLEMENTED_COURSE_ID,
    )!
    const mine = records
      .filter((a) => a.userId === user.id)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    const stats = computeLearnerStats(user, enrollments, records)
    return {
      user,
      course: getCourse(IMPLEMENTED_COURSE_ID)!,
      enrollment,
      attemptCount: mine.length,
      latestAttempt: mine.at(-1) ?? null,
      needsReview: stats.needsReview,
    }
  })
}

async function updateProgress(
  enrollmentId: string,
  stepId: StepId,
  completed: boolean,
): Promise<Enrollment | undefined> {
  const index = enrollments.findIndex((e) => e.id === enrollmentId)
  if (index < 0) return undefined
  const target = enrollments[index]!
  const steps = new Set(target.stepsCompleted)
  if (completed) steps.add(stepId)
  else steps.delete(stepId)
  const course = getCourse(target.courseId)
  const stepsCompleted = [...steps]
  const updated: Enrollment = {
    ...target,
    stepsCompleted,
    status:
      course && stepsCompleted.length >= course.steps.length && course.steps.length > 0
        ? 'completed'
        : stepsCompleted.length > 0
          ? 'in_progress'
          : 'not_started',
  }
  enrollments[index] = updated
  return updated
}

/**
 * POST /api/attempts — 실습 시도 생성.
 * mock 모드는 화면이 모아 둔 기록을 그대로 저장한다. 재실습은 새 기록으로 쌓는다.
 */
async function createAttempt(input: CreateAttemptInput): Promise<Attempt> {
  const course = getCourse(input.courseId)
  const mine = allRecords().filter((a) => a.userId === input.userId && a.courseId === input.courseId)
  const now = new Date().toISOString()
  const attemptId = `a-local-${Date.now()}`
  const samples = input.samples ?? []
  const last = samples.at(-1)
  const settings = course?.alignment

  const summary =
    input.summary ??
    (last && settings
      ? {
          finalDx: last.dx,
          finalDy: last.dy,
          finalDTheta: last.dTheta,
          durationMs: last.tMs,
          adjustmentCount: 0,
          overshootCount: detectOvershoots(samples, settings).length,
          converged: isWithinTolerance(last.dx, last.dy, last.dTheta, settings),
        }
      : null)

  const attempt: Attempt = {
    id: attemptId,
    enrollmentId:
      enrollments.find((e) => e.userId === input.userId && e.courseId === input.courseId)?.id ??
      `e-${input.userId}-local`,
    userId: input.userId,
    courseId: input.courseId,
    attemptNo: mine.length + 1,
    // 학습자가 직접 조작해 남긴 기록이므로 시연용 예시(mock)와 구분한다.
    source: 'live',
    inputDevice: input.inputDevice,
    status: 'aligned',
    startedAt: input.startedAt ?? now,
    endedAt: now,
    phaseMarkers: input.phaseMarkers ?? [],
    samples: thin(samples),
    events: (input.events ?? []).map((e) => ({ ...e, attemptId })),
    summary,
    answer: null,
    feedback: null,
    feedbackStatus: 'none',
    feedbackError: null,
    feedbackViewedAt: null,
    rubricScores: null,
    rubricSource: null,
    rubricReasons: null,
    durationSec: Math.round((summary?.durationMs ?? input.durationMs ?? 0) / 1000),
    courseVersion: course?.version ?? 'unknown',
    modelVersion: 'rule-align-0.1',
    settingsVersion: 'settings-0.2',
  }

  saved = [...saved, attempt]
  persist(saved)
  return attempt
}

async function markPhase(
  attemptId: string,
  phase: PhaseName,
  tMs: number,
): Promise<Attempt | undefined> {
  const index = saved.findIndex((a) => a.id === attemptId)
  if (index < 0) return undefined
  const target = saved[index]!
  const updated: Attempt = {
    ...target,
    phaseMarkers: [...target.phaseMarkers, { phase, tMs }],
    status: phase === 'confirmed' ? 'aligned' : target.status,
  }
  saved = saved.map((a, i) => (i === index ? updated : a))
  persist(saved)
  return updated
}

/**
 * POST /api/attempts/{id}/submission — 답변 제출.
 * mock 모드는 규칙 기반으로 채점하고 샘플 피드백을 붙인다(AI 미연결).
 */
async function submitAnswer(
  attemptId: string,
  answer: Omit<Answer, 'submittedAt'>,
): Promise<Attempt | undefined> {
  const index = saved.findIndex((a) => a.id === attemptId)
  if (index < 0) return undefined
  const target = saved[index]!
  const course = getCourse(target.courseId)
  if (!course) return undefined

  const full: Answer = { ...answer, submittedAt: new Date().toISOString() }

  // 유형에 따라 요약과 채점 규칙이 다르다. 플랫폼(기록·루브릭·피드백 구조)은 같다.
  let scored
  let summary = target.summary
  if (course.exerciseType === 'judgment' && course.scenario && full.orderedIds) {
    const metrics = judgmentMetrics(
      full.orderedIds,
      course.scenario,
      full.reason.trim().length,
      target.durationSec * 1000,
    )
    summary = metrics
    scored = scoreJudgment(course, metrics, full)
  } else {
    scored = scoreAlignment(course, target, full)
  }

  const updated: Attempt = {
    ...target,
    summary,
    answer: full,
    status: 'feedback_ready',
    rubricScores: scored.levels,
    // mock 모드도 규칙 기반 채점이다. 화면이 AI 채점과 구분해 표시한다.
    rubricSource: 'rule',
    rubricReasons: scored.reasons,
    feedback: scored.feedback,
    feedbackStatus: 'ready',
    feedbackError: null,
  }
  saved = saved.map((a, i) => (i === index ? updated : a))
  persist(saved)
  return updated
}

/** mock 모드에서는 제출 시점에 이미 샘플 피드백이 붙어 있다. */
async function requestFeedback(attemptId: string): Promise<Attempt | undefined> {
  const target = saved.find((a) => a.id === attemptId)
  if (!target) return undefined
  if (target.feedback) return target
  if (!target.answer) return target
  return submitAnswer(attemptId, target.answer)
}

/**
 * mock 채널 — 브라우저 안에서 직접 오차를 계산한다.
 * 화면은 WebSocket 인지 로컬 계산인지 구분하지 않는다.
 */
function openAlignmentChannel(attemptId: string, handlers: ChannelHandlers): AlignmentChannel {
  const attempt = allRecords().find((a) => a.id === attemptId)
  const settings = getCourse(attempt?.courseId ?? IMPLEMENTED_COURSE_ID)?.alignment
  let closed = false

  if (settings) {
    handlers.onReady?.({
      tolerance: { positionPx: settings.tolerancePx, rotationDeg: settings.toleranceDeg },
      inputDevice: attempt?.inputDevice ?? 'keyboard',
    })
  }

  return {
    kind: 'local',
    send: (sample: Omit<Sample, 'dx' | 'dy' | 'dTheta'>) => {
      if (closed || !settings) return
      // 고정 마크가 원점이므로 움직이는 마크의 위치가 곧 남은 오차다(서버와 같은 규칙).
      const dx = sample.waferX
      const dy = sample.waferY
      const dTheta = sample.waferTheta
      handlers.onState?.({
        tMs: sample.tMs,
        dx,
        dy,
        dTheta,
        withinTolerance: isWithinTolerance(dx, dy, dTheta, settings),
      })
    },
    close: () => {
      if (closed) return
      closed = true
      handlers.onClose?.()
    },
  }
}

export const mockApi: ApiClient = {
  listCourses,
  fetchCourse,
  listEnrollments,
  listAttempts,
  fetchAttempt,
  instructorOverview,
  allAttempts: allAttemptsOf,
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

/** 개발·시연 편의용. 저장된 학습자 기록만 지우고 시드 기록은 건드리지 않는다. */
export function clearSavedAttempts(): void {
  saved = []
  persist(saved)
}

