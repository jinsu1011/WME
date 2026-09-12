import { Link, useParams } from 'react-router-dom'
import { fetchCourse, listAttempts, listEnrollments } from '@/api'
import { tenant } from '@/data/tenant'
import { Card, CardHeader, EmptyState, PageHeader, ProgressBar } from '@/components/ui'
import { useDemo } from '@/lib/demo'
import { attemptScorePct, courseProgressPct, relativeDay } from '@/lib/stats'

/**
 * 대기방 — 연습을 시작하기 전에 진행 방법과 확인 기준을 먼저 읽는 화면.
 * '연습 시작'을 눌러야 실습 화면으로 들어간다.
 */
export function CourseDetail() {
  const { courseId } = useParams()
  const { currentUser } = useDemo()
  const course = courseId ? fetchCourse(courseId) : undefined

  if (!course) {
    return <EmptyState title="존재하지 않는 과정입니다" description="실습 목록에서 다시 선택해 주세요." />
  }

  const enrollment = listEnrollments(currentUser.id).find((e) => e.courseId === course.id)
  const attempts = listAttempts(currentUser.id).filter((a) => a.courseId === course.id)
  const pct = enrollment ? courseProgressPct(enrollment, course) : 0
  const isAvailable = course.availability === 'available'
  const lastScored = attempts.find((a) => a.rubricScores)
  const lastPct = lastScored ? attemptScorePct(lastScored) : null

  return (
    <>
      <PageHeader
        eyebrow="대기방"
        title={course.title}
        description={course.subtitle}
        actions={
          <Link to="/learn" className="text-[13px] font-medium text-slate-500 hover:text-slate-800">
            ← 실습 목록
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="어떤 연습인가요" />
            <p className="text-[13.5px] leading-relaxed text-slate-600">{course.description}</p>
          </Card>

          {course.steps.length > 0 && (
            <Card>
              <CardHeader title="이렇게 진행합니다" subtitle={`전체 약 ${course.estimatedMinutes}분`} />
              <ol className="space-y-3">
                {course.steps.map((step, i) => {
                  const done = enrollment?.stepsCompleted.includes(step.id)
                  return (
                    <li key={step.id} className="flex gap-3">
                      <span
                        className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                          done ? 'bg-ok-50 text-ok-500' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {done ? '✓' : i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-semibold text-slate-800">
                          {step.title}
                        </span>
                        <span className="mt-0.5 block text-[12.5px] leading-relaxed text-slate-500">
                          {step.summary}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ol>
            </Card>
          )}

          {course.rubric.length > 0 && (
            <Card>
              <CardHeader
                title="이런 점을 봅니다"
                subtitle="점수를 매겨 줄을 세우는 기준이 아니라, 다음 연습에서 무엇을 고칠지 찾기 위한 기준입니다"
              />
              <ul className="space-y-2">
                {course.rubric.map((r) => (
                  <li key={r.short} className="flex gap-3 rounded-lg bg-slate-50 px-3.5 py-2.5">
                    <span className="w-16 shrink-0 text-[12px] font-semibold text-brand-700">
                      {r.short}
                    </span>
                    <span className="text-[12.5px] leading-relaxed text-slate-600">{r.text}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {course.objectives.length > 0 && (
            <Card>
              <CardHeader title="마치면 할 수 있게 되는 것" />
              <ul className="space-y-2">
                {course.objectives.map((o) => (
                  <li key={o} className="flex gap-2.5 text-[13px] leading-relaxed text-slate-600">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-400" />
                    {o}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            {isAvailable ? (
              <>
                <div className="text-[13px] font-semibold text-slate-800">준비되면 시작하세요</div>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                  몇 번을 하든 이전 기록은 지워지지 않습니다. 편하게 다시 해도 됩니다.
                </p>
                <Link
                  to="/attempts/new"
                  className="mt-4 block rounded-lg bg-brand-600 py-3 text-center text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  {attempts.length > 0 ? '다시 연습 시작' : '연습 시작'}
                </Link>
              </>
            ) : (
              <>
                <div className="text-[13px] font-semibold text-slate-800">
                  {course.availability === 'preview' ? '소개만 열람할 수 있습니다' : '준비 중입니다'}
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                  이 과정의 실습 단계와 확인 기준은 아직 준비 중입니다.
                </p>
              </>
            )}
          </Card>

          <Card>
            <CardHeader title="내 기록" />
            {enrollment ? (
              <>
                <ProgressBar value={pct} />
                <dl className="mt-4 space-y-2.5 text-[13px]">
                  <Row
                    label="단계"
                    value={`${enrollment.stepsCompleted.length}/${course.steps.length || 1}`}
                  />
                  <Row label="연습 횟수" value={`${attempts.length}회`} />
                  <Row label="최근 정확도" value={lastPct !== null ? `${lastPct}%` : '기록 없음'} />
                  <Row label="최근 활동" value={relativeDay(attempts[0]?.endedAt ?? null)} />
                </dl>
                {attempts.length > 0 && (
                  <Link
                    to="/learn/records"
                    className="mt-3 block border-t border-slate-100 pt-2.5 text-[12px] font-medium text-brand-700 hover:underline"
                  >
                    지난 기록 보기
                  </Link>
                )}
              </>
            ) : (
              <EmptyState
                title="배정되지 않은 과정"
                description="교육 담당자가 배정하면 진행 상태가 기록됩니다."
              />
            )}
          </Card>

          {isAvailable && (
            <Card>
              <CardHeader title="준비물" subtitle="실습 장치는 교육센터에서 제공합니다" />
              <ul className="space-y-1.5 text-[13px] text-slate-600">
                <li>· {tenant.terms.mockup}을 올린 실습 판</li>
                <li>· 모션 센서가 부착된 측정 보드</li>
                <li>· USB 케이블과 노트북</li>
              </ul>
              <p className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] leading-relaxed text-slate-400">
                지금은 측정 장치가 연결되어 있지 않습니다. 연습 화면에서 현재 연결 상태를 그대로
                표시합니다.
              </p>
            </Card>
          )}

          {course.prerequisites.length > 0 && (
            <Card>
              <CardHeader title="먼저 보면 좋은 과정" />
              <ul className="space-y-1.5">
                {course.prerequisites.map((p) => {
                  const pre = fetchCourse(p)
                  return (
                    <li key={p} className="text-[13px]">
                      <Link to={`/courses/${p}`} className="text-slate-600 hover:text-brand-700">
                        · {pre?.title ?? p}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <div className="mt-4 lg:hidden">
        {isAvailable && (
          <Link
            to="/attempts/new"
            className="block rounded-lg bg-brand-600 py-3 text-center text-sm font-semibold text-white"
          >
            연습 시작
          </Link>
        )}
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-700">{value}</dd>
    </div>
  )
}
