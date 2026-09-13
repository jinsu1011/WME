import { Link } from 'react-router-dom'
import { listCourses, listEnrollments } from '@/api'
import type { Course, Enrollment } from '@/types'
import { tenant } from '@/data/tenant'
import { AvailabilityBadge } from '@/components/Badge'
import { ApiModeBadge, Loaded } from '@/components/LoadState'
import { Card, PageHeader, ProgressBar } from '@/components/ui'
import { courseProgressPct } from '@/lib/stats'
import { useApi } from '@/lib/useApi'
import { useDemo } from '@/lib/demo'

export function Catalog() {
  const { userId } = useDemo()
  const state = useApi(
    () => Promise.all([listCourses(), listEnrollments(userId)]),
    [userId],
  )

  return (
    <>
      <PageHeader
        eyebrow={`${tenant.companyName} · ${tenant.programTitle}`}
        title="과정"
        description="배정된 과정과 앞으로 열릴 과정입니다. 과정을 누르면 대기방으로 들어갑니다."
        actions={<ApiModeBadge />}
      />
      <Loaded state={state} label="과정 목록을 불러오는 중입니다">
        {([courses, enrollments]) => <CatalogList courses={courses} enrollments={enrollments} />}
      </Loaded>
    </>
  )
}

function CatalogList({ courses, enrollments }: { courses: Course[]; enrollments: Enrollment[] }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {courses.map((course) => {
          const enrollment = enrollments.find((e) => e.courseId === course.id)
          const pct = enrollment ? courseProgressPct(enrollment, course) : null
          const locked = course.availability === 'coming_soon'

          return (
            <Card key={course.id} className="flex flex-col">
              <div className="mb-2 flex items-start justify-between gap-3">
                <h2 className="text-[15px] font-semibold leading-snug text-slate-900">
                  {course.title}
                </h2>
                <AvailabilityBadge value={course.availability} />
              </div>
              <p className="mb-4 text-[13px] leading-relaxed text-slate-500">{course.subtitle}</p>

              {pct !== null && !locked && (
                <div className="mb-4">
                  <ProgressBar value={pct} />
                </div>
              )}

              <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-[11px] text-slate-400">
                  약 {course.estimatedMinutes}분
                  {enrollment ? ' · 배정됨' : ''}
                </span>
                {locked ? (
                  <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-400">
                    준비 중
                  </span>
                ) : (
                  <Link
                    to={`/courses/${course.id}`}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700"
                  >
                    {course.availability === 'available' ? '대기방 열기' : '소개 보기'}
                  </Link>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </>
  )
}
