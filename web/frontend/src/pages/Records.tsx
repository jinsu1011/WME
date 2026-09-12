import { Link } from 'react-router-dom'
import { fetchCourse, listAttempts } from '@/api'
import { Badge, DataSourceBadge } from '@/components/Badge'
import { Card, EmptyState, PageHeader } from '@/components/ui'
import { scoreBand } from '@/charts/theme'
import { attemptScorePct, relativeDay } from '@/lib/stats'
import { useDemo } from '@/lib/demo'

export function Records() {
  const { currentUser } = useDemo()
  const attempts = listAttempts(currentUser.id)

  return (
    <>
      <PageHeader
        title="기록"
        description="연습할 때마다 새 기록이 쌓입니다. 이전 기록과 피드백은 지워지지 않습니다."
      />

      {attempts.length === 0 ? (
        <EmptyState title="아직 실습 기록이 없습니다" description="과정 상세에서 실습을 시작하면 기록이 남습니다." />
      ) : (
        <Card padded={false}>
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-slate-100 text-[11px] font-medium text-slate-400">
              <tr>
                <th className="px-5 py-3">시도</th>
                <th className="px-5 py-3">과정</th>
                <th className="px-5 py-3">데이터 출처</th>
                <th className="px-5 py-3">상태</th>
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
                    <td className="px-5 py-3.5 font-medium text-slate-700">{a.attemptNo}차</td>
                    <td className="px-5 py-3.5 text-slate-600">{fetchCourse(a.courseId)?.title}</td>
                    <td className="px-5 py-3.5">
                      <DataSourceBadge value={a.source} />
                    </td>
                    <td className="px-5 py-3.5">
                      {a.answer ? (
                        <Link
                          to={`/attempts/${a.id}/result`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          결과 보기
                        </Link>
                      ) : (
                        <span className="text-slate-400">미제출</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {band ? (
                        <Badge tone={band.tone}>
                          {pct}% · {band.label}
                        </Badge>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-400">
                      {relativeDay(a.endedAt)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  )
}
