/**
 * 계획서 11절 REST 명세와 1:1로 맞춘 데이터 접근 계층.
 * 지금은 시드 데이터 + localStorage 로 동작하지만, BE(FastAPI)를 붙일 때
 * 이 파일의 본문만 fetch 로 바꾸면 화면 코드는 그대로 둔다.
 *
 * 화면은 localStorage 를 직접 만지지 않는다. 저장·조회는 전부 이 파일 안에서만 한다.
 */
import type {
  AlignmentEvent,
  AlignmentSummary,
  Answer,
  Attempt,
  Course,
  Enrollment,
  Feedback,
  InputSource,
  InstructorRow,
  LearnerStats,
  PhaseMarker,
  RubricLevel,
  Sample,
  User,
} from '@/types'
import { courses, getCourse, IMPLEMENTED_COURSE_ID } from '@/data/courses'
import { instructor, learners, seedEnrollments, users } from '@/data/people'
import { seedAttempts } from '@/data/seedAttempts'
import { computeLearnerStats } from '@/lib/stats'
import { scoreAlignment } from '@/lib/scoring'

const enrollments: Enrollment[] = [...seedEnrollments]

/** 브라우저에 남는 학습자 기록. BE 가 붙으면 이 저장소는 통째로 사라진다. */
const STORAGE_KEY = 'wme.attempts.v1'

function loadSaved(): Attempt[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Attempt[]) : []
  } catch {
    // 저장 형식이 바뀌었거나 저장소를 쓸 수 없는 경우. 기록이 없는 것으로 본다.
    return []
  }
}

function persist(list: Attempt[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // 저장 실패를 조용히 삼키지 않기 위해 콘솔에만 남긴다. 화면 동작은 계속된다.
    console.warn('[wme] 실습 기록을 브라우저에 저장하지 못했습니다.')
  }
}

let saved: Attempt[] = loadSaved()

/** 시드(시연용) + 저장된 기록을 합친 전체 목록. 시드를 지우거나 덮어쓰지 않는다. */
function allRecords(): Attempt[] {
  return [...seedAttempts, ...saved]
}

/** GET /api/courses */
export function listCourses(): Course[] {
  return courses
}

/** GET /api/courses/{id} */
export function fetchCourse(id: string): Course | undefined {
  return getCourse(id)
}

/** GET /api/enrollments?userId= */
export function listEnrollments(userId: string): Enrollment[] {
  return enrollments.filter((e) => e.userId === userId)
}

export function listAttempts(userId: string): Attempt[] {
  return allRecords()
    .filter((a) => a.userId === userId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

/** GET /api/attempts/{id} */
export function fetchAttempt(id: string): Attempt | undefined {
  return allRecords().find((a) => a.id === id)
}

export function fetchUser(id: string): User | undefined {
  return users.find((u) => u.id === id)
}

export function statsFor(userId: string): LearnerStats | null {
  const user = users.find((u) => u.id === userId)
  if (!user) return null
  return computeLearnerStats(user, enrollments, allRecords())
}

export function allLearnerStats(): LearnerStats[] {
  return learners.map((u) => computeLearnerStats(u, enrollments, allRecords()))
}

export function allAttempts(): Attempt[] {
  return allRecords()
}

/** GET /api/instructor/overview */
export function instructorOverview(): InstructorRow[] {
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

/** 정렬 실습 한 번의 기록. POST /api/attempts 의 요청 본문에 해당한다. */
export interface CreateAttemptInput {
  userId: string
  courseId: string
  inputSource: InputSource
  startedAt: string
  samples: Sample[]
  events: AlignmentEvent[]
  phaseMarkers: PhaseMarker[]
  summary: AlignmentSummary
}

/** 기록이 너무 길어지면 저장 전에 솎아낸다. 모양은 유지하고 개수만 줄인다. */
function thin<T>(list: T[], max = 240): T[] {
  if (list.length <= max) return list
  const step = list.length / max
  return Array.from({ length: max }, (_, i) => list[Math.floor(i * step)]!)
}

/**
 * POST /api/attempts — 실습 시도 생성.
 * 재실습은 항상 새 기록으로 쌓고 이전 기록을 지우지 않는다.
 */
export function createAttempt(input: CreateAttemptInput): Attempt {
  const course = getCourse(input.courseId)
  const mine = allRecords().filter((a) => a.userId === input.userId && a.courseId === input.courseId)
  const now = new Date().toISOString()
  const attemptId = `a-local-${Date.now()}`

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
    inputSource: input.inputSource,
    status: 'aligned',
    startedAt: input.startedAt,
    endedAt: now,
    phaseMarkers: input.phaseMarkers,
    samples: thin(input.samples),
    events: input.events.map((e) => ({ ...e, attemptId })),
    summary: input.summary,
    answer: null,
    feedback: null,
    feedbackViewedAt: null,
    rubricScores: null,
    durationSec: Math.round(input.summary.durationMs / 1000),
    courseVersion: course?.version ?? 'unknown',
    modelVersion: 'rule-align-0.1',
    settingsVersion: 'settings-0.2',
  }

  saved = [...saved, attempt]
  persist(saved)
  return attempt
}

/**
 * POST /api/attempts/{id}/submission — 답변 제출.
 * 제출과 동시에 규칙 기반 채점·샘플 피드백을 붙인다(AI 미연결 상태).
 * BE 가 붙으면 채점·피드백은 서버가 하고 이 함수는 그 응답을 받기만 한다.
 */
export function submitAnswer(attemptId: string, answer: Answer): Attempt | undefined {
  const index = saved.findIndex((a) => a.id === attemptId)
  if (index < 0) return undefined
  const target = saved[index]!
  const course = getCourse(target.courseId)
  if (!course) return undefined

  const scored = scoreAlignment(course, target, answer)
  const updated: Attempt = {
    ...target,
    answer,
    status: 'feedback_ready',
    rubricScores: scored.levels as RubricLevel[],
    feedback: scored.feedback as Feedback,
  }
  saved = saved.map((a, i) => (i === index ? updated : a))
  persist(saved)
  return updated
}

/** 개발·시연 편의용. 저장된 학습자 기록만 지우고 시드 기록은 건드리지 않는다. */
export function clearSavedAttempts(): void {
  saved = []
  persist(saved)
}

export { instructor }
