import type { Attempt, Course, LearnerStats } from '@/types'
import { Card, CardHeader, DemoDataNote, EmptyState } from './ui'
import { Badge } from './Badge'
import { RubricBars, ScoreTrend } from '@/charts/Charts'
import { scoreBand } from '@/charts/theme'
import { attemptScorePct, relativeDay } from '@/lib/stats'

/**
 * 개인 성취도 묶음. 교육생 대시보드와 담당자 드릴다운에서 같은 컴포넌트를 쓴다.
 * 모든 값은 저장된 시도 기록에서 계산한다.
 */
export function AchievementPanels({
  stats,
  course,
  cohort,
  attempts,
}: {
  stats: LearnerStats
  course: Course
  cohort: number[] | null
  attempts: Attempt[]
}) {
  const submitted = attempts.filter((a) => a.rubricScores)
  const latest = submitted.at(0) ?? null
  const latestPct = latest ? attemptScorePct(latest) : null

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="평가 기준별 달성도"
          subtitle="제출한 실습 답변을 과정 루브릭 4개 기준으로 집계했습니다"
          aside={
            latestPct !== null ? (
              <Badge tone={scoreBand(latestPct).tone}>최근 {scoreBand(latestPct).label}</Badge>
            ) : undefined
          }
        />
        {stats.rubricPct ? (
          <>
            <RubricBars
              labels={course.rubric.map((r) => r.short)}
              mine={stats.rubricPct}
              cohort={cohort}
            />
            <DemoDataNote>
              달성도는 제출 답변 {stats.submittedCount}건의 평균입니다. 손재주 점수가 아니라
              과정에 등록된 {course.rubric.length}개 기준에 대한 확인 결과입니다.
            </DemoDataNote>
          </>
        ) : (
          <EmptyState
            title="아직 제출한 답변이 없습니다"
            description="실습을 마치고 근거와 판단을 제출하면 기준별 달성도가 집계됩니다."
          />
        )}
      </Card>

      <Card>
        <CardHeader
          title="시도별 달성도 추이"
          subtitle="재실습은 새 기록으로 쌓이고 이전 기록을 덮어쓰지 않습니다"
          aside={<span className="text-xs text-slate-400">{relativeDay(stats.lastActiveAt)}</span>}
        />
        {stats.rubricTrend.length > 0 ? (
          <>
            <ScoreTrend data={stats.rubricTrend} />
            <DemoDataNote>
              충족 기준 75%는 과정에 등록된 교육 기준값입니다. 현장 숙련도나 자격을 뜻하지 않습니다.
            </DemoDataNote>
          </>
        ) : (
          <EmptyState
            title="추이를 그릴 기록이 없습니다"
            description="두 번째 실습부터 변화가 보입니다. 첫 제출 후 이 영역이 채워집니다."
          />
        )}
      </Card>
    </div>
  )
}
