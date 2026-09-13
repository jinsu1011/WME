import { allLearnerStats, fetchCourse, listAttempts, statsFor } from '@/api'
import { IMPLEMENTED_COURSE_ID } from '@/data/courses'
import { AchievementPanels } from '@/components/Achievement'
import { ActivityBars, MinutesTrend } from '@/charts/Charts'
import { Card, CardHeader, DemoDataNote, EmptyState, PageHeader, StatTile } from '@/components/ui'
import type { Attempt, Course, LearnerStats } from '@/types'
import { ApiModeBadge, Loaded } from '@/components/LoadState'
import { useApi } from '@/lib/useApi'
import { useDemo } from '@/lib/demo'
import {
  attemptScorePct,
  cohortRubricPct,
  improvement,
  practiceTimeTrend,
  relativeDay,
  weeklyActivity,
} from '@/lib/stats'

/**
 * 현재 상황 — 얼마나 연습했고(진도·시간), 기준을 얼마나 충족했는지(정확도)를 나눠서 보여준다.
 * 두 값을 한 숫자로 합치지 않는다.
 */
interface StatusData {
  stats: LearnerStats
  attempts: Attempt[]
  course: Course
  cohort: number[] | null
}

export function Status() {
  const { userId } = useDemo()
  const state = useApi<StatusData>(async () => {
    const [stats, attempts, course, all] = await Promise.all([
      statsFor(userId),
      listAttempts(userId),
      fetchCourse(IMPLEMENTED_COURSE_ID),
      allLearnerStats(),
    ])
    if (!stats || !course) throw new Error('학습 기록을 불러오지 못했습니다.')
    return { stats, attempts, course, cohort: cohortRubricPct(all) }
  }, [userId])

  return (
    <>
      <PageHeader
        title="현재 상황"
        description="저장된 연습 기록에서 바로 계산한 값입니다. 점수를 매기기 위한 화면이 아니라 변화를 보기 위한 화면입니다."
        actions={<ApiModeBadge />}
      />
      <Loaded state={state} label="학습 기록을 불러오는 중입니다">
        {(data) => <StatusView data={data} />}
      </Loaded>
    </>
  )
}

function StatusView({ data }: { data: StatusData }) {
  const { stats, attempts, course, cohort } = data
  const activity = weeklyActivity(attempts)
  const minutes = practiceTimeTrend(attempts)

  const latest = attempts.find((a) => a.rubricScores)
  const latestPct = latest ? attemptScorePct(latest) : null
  const scoreDelta = improvement(stats.rubricTrend.map((t) => t.value))
  const totalMinutes = minutes.reduce((sum, m) => sum + m.minutes, 0)

  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="누적 연습" value={stats.attemptCount} unit="회" sub={`제출 ${stats.submittedCount}건`} />
        <StatTile label="누적 연습 시간" value={totalMinutes} unit="분" sub={relativeDay(stats.lastActiveAt)} />
        <StatTile label="전체 진도" value={stats.progressPct} unit="%" sub={`배정 과정 ${stats.assignedCourses}개`} />
        <StatTile
          label="최근 정확도"
          value={latestPct ?? '—'}
          unit={latestPct !== null ? '%' : undefined}
          sub={
            scoreDelta === null
              ? '두 번째 연습부터 변화가 보입니다'
              : scoreDelta > 0
                ? `첫 연습 대비 +${scoreDelta}%p`
                : scoreDelta === 0
                  ? '첫 연습과 같음'
                  : `첫 연습 대비 ${scoreDelta}%p`
          }
        />
      </div>

      <div className="mb-4">
        <AchievementPanels stats={stats} course={course} cohort={cohort} attempts={attempts} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="연습마다 걸린 시간" subtitle="같은 실습을 반복하면서 걸린 시간의 변화" />
          {minutes.length > 0 ? (
            <>
              <MinutesTrend data={minutes} />
              <DemoDataNote>
                시간이 줄었다고 해서 더 잘했다는 뜻은 아닙니다. 정확도 추이와 함께 봅니다.
              </DemoDataNote>
            </>
          ) : (
            <EmptyState title="연습 기록이 없습니다" description="첫 연습을 마치면 여기에 기록이 쌓입니다." />
          )}
        </Card>

        <Card>
          <CardHeader title="주차별 연습 횟수" subtitle="꾸준히 하고 있는지 보는 값입니다" />
          <ActivityBars data={activity} />
          <DemoDataNote>막대에 마우스를 올리면 그 주의 연습 횟수와 총 시간이 표시됩니다.</DemoDataNote>
        </Card>
      </div>
    </>
  )
}
