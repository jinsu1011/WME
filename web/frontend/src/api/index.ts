/**
 * 계획서 11절 REST 명세와 1:1로 맞춘 데이터 접근 계층.
 * 지금은 시드 데이터를 읽는 동기 함수지만, BE(FastAPI)를 붙일 때
 * 이 파일의 본문만 fetch 로 바꾸면 화면 코드는 그대로 둔다.
 */
import type { Attempt, Course, Enrollment, InstructorRow, LearnerStats, User } from '@/types'
import { courses, getCourse } from '@/data/courses'
import { instructor, learners, seedEnrollments, users } from '@/data/people'
import { seedAttempts } from '@/data/seedAttempts'
import { computeLearnerStats } from '@/lib/stats'

const enrollments: Enrollment[] = [...seedEnrollments]
const attempts: Attempt[] = [...seedAttempts]

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
  return attempts
    .filter((a) => a.userId === userId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

/** GET /api/attempts/{id} */
export function fetchAttempt(id: string): Attempt | undefined {
  return attempts.find((a) => a.id === id)
}

export function fetchUser(id: string): User | undefined {
  return users.find((u) => u.id === id)
}

export function statsFor(userId: string): LearnerStats | null {
  const user = users.find((u) => u.id === userId)
  if (!user) return null
  return computeLearnerStats(user, enrollments, attempts)
}

export function allLearnerStats(): LearnerStats[] {
  return learners.map((u) => computeLearnerStats(u, enrollments, attempts))
}

export function allAttempts(): Attempt[] {
  return attempts
}

/** GET /api/instructor/overview */
export function instructorOverview(): InstructorRow[] {
  return learners.map((user) => {
    const enrollment = enrollments.find(
      (e) => e.userId === user.id && e.courseId === 'stage-anomaly',
    )!
    const mine = attempts
      .filter((a) => a.userId === user.id)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    const stats = computeLearnerStats(user, enrollments, attempts)
    return {
      user,
      course: getCourse('stage-anomaly')!,
      enrollment,
      attemptCount: mine.length,
      latestAttempt: mine.at(-1) ?? null,
      needsReview: stats.needsReview,
    }
  })
}

export { instructor }
