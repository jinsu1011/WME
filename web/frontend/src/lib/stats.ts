import type { Attempt, Course, Enrollment, LearnerStats, User } from '@/types'
import { getCourse } from '@/data/courses'
import { DEMO_NOW } from '@/data/seedAttempts'

const MAX_LEVEL = 2

export function courseProgressPct(enrollment: Enrollment, course: Course | undefined): number {
  if (!course) return 0
  if (course.steps.length === 0) return enrollment.status === 'completed' ? 100 : 0
  return Math.round((enrollment.stepsCompleted.length / course.steps.length) * 100)
}

/** 전체 루브릭 달성도 0~100. 제출한 시도만 대상. */
export function attemptScorePct(attempt: Attempt): number | null {
  if (!attempt.rubricScores || attempt.rubricScores.length === 0) return null
  const sum = attempt.rubricScores.reduce<number>((a, b) => a + b, 0)
  return Math.round((sum / (attempt.rubricScores.length * MAX_LEVEL)) * 100)
}

export function computeLearnerStats(
  user: User,
  enrollments: Enrollment[],
  attempts: Attempt[],
): LearnerStats {
  const mine = enrollments.filter((e) => e.userId === user.id)
  const myAttempts = attempts
    .filter((a) => a.userId === user.id)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  const submitted = myAttempts.filter((a) => a.rubricScores !== null)

  const progressPct = mine.length
    ? Math.round(
        mine.reduce((sum, e) => sum + courseProgressPct(e, getCourse(e.courseId)), 0) / mine.length,
      )
    : 0

  let rubricPct: number[] | null = null
  if (submitted.length > 0) {
    const itemCount = submitted[0]!.rubricScores!.length
    rubricPct = Array.from({ length: itemCount }, (_, i) =>
      Math.round(
        (submitted.reduce((sum, a) => sum + (a.rubricScores![i] ?? 0), 0) /
          (submitted.length * MAX_LEVEL)) *
          100,
      ),
    )
  }

  const last = myAttempts.at(-1) ?? null
  const lastScore = last ? attemptScorePct(last) : null

  return {
    user,
    assignedCourses: mine.length,
    completedCourses: mine.filter((e) => e.status === 'completed').length,
    progressPct,
    attemptCount: myAttempts.length,
    submittedCount: submitted.length,
    rubricPct,
    rubricTrend: submitted.map((a) => ({
      label: `${a.attemptNo}차`,
      value: attemptScorePct(a) ?? 0,
    })),
    lastActiveAt: last?.endedAt ?? null,
    needsReview: Boolean(last && (lastScore === null || lastScore < 60)),
  }
}

/** 배정 인원 전체의 루브릭 항목별 평균. 비교 기준선으로만 쓴다. */
export function cohortRubricPct(all: LearnerStats[]): number[] | null {
  const withData = all.filter((s) => s.rubricPct)
  if (withData.length === 0) return null
  const itemCount = withData[0]!.rubricPct!.length
  return Array.from({ length: itemCount }, (_, i) =>
    Math.round(withData.reduce((sum, s) => sum + s.rubricPct![i]!, 0) / withData.length),
  )
}

export interface WeekBucket {
  label: string
  attempts: number
  minutes: number
}

/** 최근 N주 학습 활동. 저장된 시도에서만 집계한다. */
export function weeklyActivity(attempts: Attempt[], weeks = 5): WeekBucket[] {
  const buckets: WeekBucket[] = []
  for (let w = weeks - 1; w >= 0; w--) {
    const end = new Date(DEMO_NOW)
    end.setDate(end.getDate() - w * 7)
    const start = new Date(end)
    start.setDate(start.getDate() - 7)
    const inRange = attempts.filter((a) => {
      const t = new Date(a.startedAt).getTime()
      return t > start.getTime() && t <= end.getTime()
    })
    buckets.push({
      label: w === 0 ? '이번 주' : `${w}주 전`,
      attempts: inRange.length,
      minutes: Math.round(inRange.reduce((sum, a) => sum + a.durationSec, 0) / 60),
    })
  }
  return buckets
}

export function relativeDay(iso: string | null): string {
  if (!iso) return '기록 없음'
  const diff = Math.floor((DEMO_NOW.getTime() - new Date(iso).getTime()) / 86_400_000)
  if (diff <= 0) return '오늘'
  if (diff === 1) return '어제'
  if (diff < 7) return `${diff}일 전`
  return `${Math.floor(diff / 7)}주 전`
}

/** 시도별 연습 시간(분). 오래된 시도부터 정렬한다. */
export function practiceTimeTrend(attempts: Attempt[]): { label: string; minutes: number }[] {
  return [...attempts]
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((a) => ({ label: `${a.attemptNo}차`, minutes: Math.round(a.durationSec / 60) }))
}

/** 첫 기록 대비 마지막 기록의 변화량. 개선을 말로도 함께 보여주기 위해 쓴다. */
export function improvement(values: number[]): number | null {
  if (values.length < 2) return null
  return values.at(-1)! - values[0]!
}
