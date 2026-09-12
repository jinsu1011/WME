import { Link } from 'react-router-dom'
import { allAttempts, allLearnerStats, fetchCourse, instructorOverview } from '@/api'
import { tenant } from '@/data/tenant'
import { ActivityBars, LearnerProgressBars } from '@/charts/Charts'
import { Badge } from '@/components/Badge'
import { Card, CardHeader, DemoDataNote, EmptyState, PageHeader, StatTile } from '@/components/ui'
import { relativeDay, weeklyActivity } from '@/lib/stats'

export function Instructor() {
  const rows = instructorOverview()
  const stats = allLearnerStats()
  const course = fetchCourse('stage-anomaly')!
  const activity = weeklyActivity(allAttempts())

  const completed = rows.filter((r) => r.enrollment.status === 'completed').length
  const notStarted = rows.filter((r) => r.enrollment.status === 'not_started').length
  const review = rows.filter((r) => r.needsReview)
  const progressData = [...stats]
    .sort((a, b) => b.progressPct - a.progressPct)
    .map((s) => ({ id: s.user.id, name: s.user.displayName, value: s.progressPct }))

  return (
    <>
      <PageHeader
        eyebrow={`${tenant.companyName} ${tenant.terms.trainingCenter}`}
        title="교육 현황"
        description={`${course.title} · 배정 ${rows.length}명. 저장된 학습 기록에서 계산한 값만 표시합니다.`}
        actions={
          <Link
            to="/instructor/learners"
            className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            학습자 전체 보기
          </Link>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="배정 인원" value={rows.length} unit="명" sub={course.title} />
        <StatTile label="이수" value={completed} unit="명" sub={`전체 ${rows.length}명 중`} />
        <StatTile label="미착수" value={notStarted} unit="명" sub="단계 기록 없음" />
        <StatTile
          label="검토 필요"
          value={review.length}
          unit="명"
          sub="미제출 또는 달성도 60% 미만"
          tone={review.length > 0 ? 'alert' : 'default'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title="학습자별 진도" subtitle="배정된 과정 전체의 단계 완료 비율(평균)" />
          <LearnerProgressBars data={progressData} />
          <DemoDataNote>
            진도는 서버에 저장된 단계 완료 기록으로만 계산합니다. 페이지 방문이나 경과 시간으로
            올라가지 않습니다.
          </DemoDataNote>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="주차별 실습 활동" subtitle="반 전체 실습 시도" />
            <ActivityBars data={activity} />
          </Card>

          <Card>
            <CardHeader title="검토 필요" subtitle="답변 미제출이거나 기준 달성도가 낮은 기록" />
            {review.length === 0 ? (
              <EmptyState title="검토할 기록이 없습니다" description="모든 학습자가 기준을 충족했습니다." />
            ) : (
              <ul className="space-y-1.5">
                {review.map((r) => (
                  <li key={r.user.id}>
                    <Link
                      to={`/instructor/learners/${r.user.id}`}
                      className="flex items-center justify-between rounded-lg px-3 py-2.5 transition hover:bg-slate-50"
                    >
                      <span>
                        <span className="block text-[13px] font-medium text-slate-800">
                          {r.user.displayName}
                        </span>
                        <span className="block text-[11px] text-slate-400">{r.user.department}</span>
                      </span>
                      <Badge tone={r.latestAttempt?.answer ? 'warn' : 'alert'}>
                        {r.latestAttempt?.answer ? '달성도 낮음' : '미제출'}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card className="mt-4" padded={false}>
        <div className="px-5 pt-5">
          <CardHeader title="학습자 기록" subtitle="이름을 누르면 개인별 성취도와 제출 답변을 볼 수 있습니다" />
        </div>
        <LearnerTable rows={rows} />
      </Card>
    </>
  )
}

export function LearnerTable({ rows }: { rows: ReturnType<typeof instructorOverview> }) {
  return (
    <table className="w-full text-left text-[13px]">
      <thead className="border-y border-slate-100 text-[11px] font-medium text-slate-400">
        <tr>
          <th className="px-5 py-3">학습자</th>
          <th className="px-5 py-3">소속</th>
          <th className="px-5 py-3">단계</th>
          <th className="px-5 py-3 text-right">시도</th>
          <th className="px-5 py-3">최근 제출</th>
          <th className="px-5 py-3 text-right">상태</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((r) => (
          <tr key={r.user.id} className="transition hover:bg-slate-50/70">
            <td className="px-5 py-3.5">
              <Link
                to={`/instructor/learners/${r.user.id}`}
                className="font-medium text-slate-800 hover:text-brand-700"
              >
                {r.user.displayName}
              </Link>
            </td>
            <td className="px-5 py-3.5 text-slate-500">{r.user.department}</td>
            <td className="px-5 py-3.5 text-slate-600">
              {r.enrollment.stepsCompleted.length}/{r.course.steps.length}
            </td>
            <td className="px-5 py-3.5 text-right tabular-nums text-slate-600">{r.attemptCount}</td>
            <td className="px-5 py-3.5 text-slate-500">
              {r.latestAttempt?.answer ? relativeDay(r.latestAttempt.answer.submittedAt) : '—'}
            </td>
            <td className="px-5 py-3.5 text-right">
              {r.enrollment.status === 'completed' ? (
                <Badge tone="ok">이수</Badge>
              ) : r.enrollment.status === 'in_progress' ? (
                <Badge tone="brand">진행 중</Badge>
              ) : (
                <Badge tone="muted">미착수</Badge>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
