import { Link } from 'react-router-dom'
import { listAttempts, listCourses, listEnrollments, statsFor } from '@/api'
import type { Attempt, Course, Enrollment, LearnerStats } from '@/types'
import { tenant } from '@/data/tenant'
import { Badge } from '@/components/Badge'
import { ApiModeBadge, Loaded } from '@/components/LoadState'
import { Card, EmptyState, PageHeader, ProgressBar } from '@/components/ui'
import { useDemo } from '@/lib/demo'
import { useApi } from '@/lib/useApi'
import { attemptScorePct, courseProgressPct, relativeDay } from '@/lib/stats'

interface Item {
  course: Course
  enrollment: Enrollment
  attempts: Attempt[]
  progressPct: number
  done: boolean
}

interface HomeData {
  courses: Course[]
  enrollments: Enrollment[]
  attempts: Attempt[]
  stats: LearnerStats
}

/** 로그인 후 첫 화면. 해야 할 실습을 위에, 끝낸 실습을 아래에 둔다. */
export function PracticeList() {
  const { userId, currentUser } = useDemo()
  const state = useApi<HomeData>(async () => {
    const [courses, enrollments, attempts, stats] = await Promise.all([
      listCourses(),
      listEnrollments(userId),
      listAttempts(userId),
      statsFor(userId),
    ])
    if (!stats) throw new Error('학습 기록을 불러오지 못했습니다.')
    return { courses, enrollments, attempts, stats }
  }, [userId])

  return (
    <>
      <PageHeader
        eyebrow={`${tenant.companyName} · ${tenant.programTitle}`}
        title={currentUser ? `${currentUser.displayName}님, 오늘도 한 번 연습해 볼까요?` : '오늘도 한 번 연습해 볼까요?'}
        description="평가가 아니라 연습입니다. 여러 번 할수록 기록이 쌓이고 변화가 보입니다."
        actions={<ApiModeBadge />}
      />
      <Loaded state={state} label="실습 목록을 불러오는 중입니다">
        {(data) => <PracticeListView data={data} />}
      </Loaded>
    </>
  )
}

function PracticeListView({ data }: { data: HomeData }) {
  const { stats } = data
  const allAttempts = data.attempts

  const items: Item[] = data.enrollments
    .map((enrollment) => {
      const course = data.courses.find((c) => c.id === enrollment.courseId)
      if (!course) return null
      return {
        course,
        enrollment,
        attempts: allAttempts.filter((a) => a.courseId === course.id),
        progressPct: courseProgressPct(enrollment, course),
        done: enrollment.status === 'completed',
      }
    })
    .filter((i): i is Item => i !== null)

  const todo = items.filter((i) => !i.done)
  const done = items.filter((i) => i.done)
  const latestScore = allAttempts.find((a) => a.rubricScores)
  const latestPct = latestScore ? attemptScorePct(latestScore) : null

  return (
    <>
      <div className="mb-7 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-slate-200/80 bg-white px-5 py-3.5 text-[13px]">
        <Summary label="해야 할 실습" value={`${todo.length}개`} />
        <Summary label="누적 연습" value={`${stats.attemptCount}회`} />
        <Summary
          label="최근 정확도"
          value={latestPct !== null ? `${latestPct}%` : '—'}
          sub={relativeDay(stats.lastActiveAt)}
        />
        <Link
          to="/learn/status"
          className="ml-auto text-[12px] font-medium text-brand-700 hover:underline"
        >
          변화 그래프 보기 →
        </Link>
      </div>

      <SectionTitle title="해야 할 실습" count={todo.length} />
      {todo.length === 0 ? (
        <EmptyState
          title="지금 해야 할 실습이 없습니다"
          description={
            items.length === 0
              ? '아직 배정된 과정이 없습니다. 교육 담당자가 과정을 배정하면 여기에 표시됩니다.'
              : '배정된 과정을 모두 마쳤습니다. 아래에서 지난 실습을 다시 연습할 수 있습니다.'
          }
        />
      ) : (
        <div className="space-y-3">
          {todo.map((item) => (
            <ItemCard key={item.course.id} item={item} />
          ))}
        </div>
      )}

      <div className="mt-9">
        <SectionTitle title="완료한 실습" count={done.length} />
        {done.length === 0 ? (
          <EmptyState
            title="아직 완료한 실습이 없습니다"
            description="한 과정의 단계를 모두 마치면 여기로 내려옵니다."
          />
        ) : (
          <div className="space-y-3">
            {done.map((item) => (
              <ItemCard key={item.course.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function Summary({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <span className="text-slate-400">{label}</span>
      <span className="ml-2 font-semibold text-slate-900">{value}</span>
      {sub && <span className="ml-1.5 text-[11px] text-slate-400">{sub}</span>}
    </div>
  )
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="text-[15px] font-bold text-slate-900">{title}</h2>
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
        {count}
      </span>
    </div>
  )
}

function ItemCard({ item }: { item: Item }) {
  const { course, attempts, progressPct, done } = item
  const practicable = course.availability === 'available'
  const hasAttempt = attempts.length > 0

  const actionLabel = !practicable
    ? '내용 보기'
    : done
      ? '다시 연습하기'
      : hasAttempt
        ? '이어서 연습하기'
        : '연습 시작하기'

  return (
    <Card className={done ? 'bg-slate-50/60' : ''}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold text-slate-900">{course.title}</h3>
            {done ? (
              <Badge tone="ok">완료</Badge>
            ) : hasAttempt ? (
              <Badge tone="brand">진행 중</Badge>
            ) : (
              <Badge tone="muted">시작 전</Badge>
            )}
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{course.subtitle}</p>

          <div className="mt-3.5 max-w-sm">
            <ProgressBar value={progressPct} />
          </div>
          <div className="mt-1.5 text-[11px] text-slate-400">
            {course.steps.length > 0
              ? `${item.enrollment.stepsCompleted.length}/${course.steps.length}단계`
              : done
                ? '열람 완료'
                : '미열람'}
            {' · '}약 {course.estimatedMinutes}분
            {hasAttempt && ` · 연습 ${attempts.length}회 · 최근 ${relativeDay(attempts[0]!.endedAt)}`}
          </div>
        </div>

        <Link
          to={`/courses/${course.id}`}
          className={`shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
            done
              ? 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              : 'bg-brand-600 text-white hover:bg-brand-700'
          }`}
        >
          {actionLabel}
        </Link>
      </div>
    </Card>
  )
}
