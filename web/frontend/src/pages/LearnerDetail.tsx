import { Link, useParams } from 'react-router-dom'
import {
  allLearnerStats,
  fetchCourse,
  fetchUser,
  listAttempts,
  listEnrollments,
  statsFor,
} from '@/api'
import { AchievementPanels } from '@/components/Achievement'
import { LearnerProgressBars } from '@/charts/Charts'
import { Badge, DataSourceBadge } from '@/components/Badge'
import { Card, CardHeader, DemoDataNote, EmptyState, PageHeader, ProgressBar, StatTile } from '@/components/ui'
import { scoreBand } from '@/charts/theme'
import { attemptScorePct, cohortRubricPct, courseProgressPct, relativeDay } from '@/lib/stats'

export function LearnerDetail() {
  const { learnerId } = useParams()
  const user = learnerId ? fetchUser(learnerId) : undefined
  const stats = learnerId ? statsFor(learnerId) : null

  if (!user || !stats) {
    return <EmptyState title="존재하지 않는 학습자입니다" description="학습자 목록에서 다시 선택해 주세요." />
  }

  const course = fetchCourse('stage-anomaly')!
  const attempts = listAttempts(user.id)
  const enrollments = listEnrollments(user.id)
  const all = allLearnerStats()
  const cohort = cohortRubricPct(all)
  const ranking = [...all]
    .sort((a, b) => b.progressPct - a.progressPct)
    .map((s) => ({ id: s.user.id, name: s.user.displayName, value: s.progressPct }))

  return (
    <>
      <PageHeader
        eyebrow="학습자 상세" 
        title={user.displayName}
        description={`${user.department} · 최근 활동 ${relativeDay(stats.lastActiveAt)}`}
        actions={stats.needsReview ? <Badge tone="warn">검토 필요</Badge> : <Badge tone="ok">기준 충족</Badge>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="전체 진도" value={stats.progressPct} unit="%" sub={`배정 과정 ${stats.assignedCourses}개`} />
        <StatTile label="이수 과정" value={`${stats.completedCourses}/${stats.assignedCourses}`} />
        <StatTile label="실습 시도" value={stats.attemptCount} unit="회" sub={`제출 ${stats.submittedCount}건`} />
        <StatTile
          label="최근 달성도"
          value={stats.rubricTrend.at(-1)?.value ?? '—'}
          unit={stats.rubricTrend.length ? '%' : undefined}
        />
      </div>

      <div className="mb-4">
        <AchievementPanels stats={stats} course={course} cohort={cohort} attempts={attempts} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title="제출 기록" subtitle="시도별 답변과 피드백을 열어볼 수 있습니다" />
          </div>
          {attempts.length === 0 ? (
            <div className="px-5 pb-5">
              <EmptyState title="실습 기록이 없습니다" description="아직 실습을 시작하지 않은 학습자입니다." />
            </div>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead className="border-y border-slate-100 text-[11px] font-medium text-slate-400">
                <tr>
                  <th className="px-5 py-3">시도</th>
                  <th className="px-5 py-3">출처</th>
                  <th className="px-5 py-3">제출</th>
                  <th className="px-5 py-3 text-right">달성도</th>
                  <th className="px-5 py-3 text-right">일시</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attempts.map((a) => {
                  const pct = attemptScorePct(a)
                  const band = pct !== null ? scoreBand(pct) : null
                  return (
                    <tr key={a.id} className="transition hover:bg-slate-50/70">
                      <td className="px-5 py-3.5">
                        <Link
                          to={`/attempts/${a.id}/result`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {a.attemptNo}차
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <DataSourceBadge value={a.source} />
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">{a.answer ? '제출' : '미제출'}</td>
                      <td className="px-5 py-3.5 text-right">
                        {band ? <Badge tone={band.tone}>{pct}%</Badge> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right text-slate-400">{relativeDay(a.endedAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="과정별 진도" />
            <div className="space-y-3.5">
              {enrollments.map((e) => {
                const c = fetchCourse(e.courseId)
                if (!c) return null
                return (
                  <div key={e.id}>
                    <div className="mb-1.5 truncate text-[12.5px] font-medium text-slate-700">{c.title}</div>
                    <ProgressBar value={courseProgressPct(e, c)} />
                  </div>
                )
              })}
            </div>
          </Card>

          <Card>
            <CardHeader title="반 내 위치" subtitle="진도 기준. 이 학습자는 주황색입니다" />
            <LearnerProgressBars data={ranking} highlightId={user.id} />
            <DemoDataNote>
              순위는 진도 비교용이며 숙련도 서열이 아닙니다. 달성도와 진도는 다른 지표입니다.
            </DemoDataNote>
          </Card>
        </div>
      </div>
    </>
  )
}
