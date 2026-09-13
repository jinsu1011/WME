import { Link } from 'react-router-dom'
import { listAttempts, listCourses } from '@/api'
import type { Attempt, Course } from '@/types'
import { Badge, InputDeviceBadge } from '@/components/Badge'
import { ApiModeBadge, Loaded } from '@/components/LoadState'
import { Card, EmptyState, PageHeader } from '@/components/ui'
import { scoreBand } from '@/charts/theme'
import { attemptScorePct, relativeDay } from '@/lib/stats'
import { useApi } from '@/lib/useApi'
import { useDemo } from '@/lib/demo'

export function Records() {
  const { userId } = useDemo()
  const state = useApi(
    () => Promise.all([listAttempts(userId), listCourses()]),
    [userId],
  )

  return (
    <>
      <PageHeader
        title="기록"
        description="연습할 때마다 새 기록이 쌓입니다. 이전 기록과 피드백은 지워지지 않습니다."
        actions={<ApiModeBadge />}
      />
      <Loaded state={state} label="연습 기록을 불러오는 중입니다">
        {([attempts, courses]) => <RecordTable attempts={attempts} courses={courses} />}
      </Loaded>
    </>
  )
}

function RecordTable({ attempts, courses }: { attempts: Attempt[]; courses: Course[] }) {
  const courseTitle = (id: string) => courses.find((c) => c.id === id)?.title ?? id

  return (
    <>

      {attempts.length === 0 ? (
        <EmptyState title="아직 실습 기록이 없습니다" description="과정 상세에서 실습을 시작하면 기록이 남습니다." />
      ) : (
        <Card padded={false}>
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-slate-100 text-[11px] font-medium text-slate-400">
              <tr>
                <th className="px-5 py-3">시도</th>
                <th className="px-5 py-3">과정</th>
                <th className="px-5 py-3">입력 출처</th>
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
                    <td className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-700">{a.attemptNo}차</td>
                    <td className="max-w-[230px] truncate px-5 py-3.5 text-slate-600">{courseTitle(a.courseId)}</td>
                    <td className="px-5 py-3.5">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <InputDeviceBadge value={a.inputDevice} />
                        {a.source === 'mock' && <Badge tone="warn">예시 데이터</Badge>}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {a.answer ? (
                        <Link
                          to={`/attempts/${a.id}/result`}
                          className="whitespace-nowrap font-medium text-brand-700 hover:underline"
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
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-slate-400">
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
