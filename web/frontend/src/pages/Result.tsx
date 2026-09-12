import { Link, useParams } from 'react-router-dom'
import { fetchAttempt, fetchCourse, fetchUser, listAttempts } from '@/api'
import { Badge, DataSourceBadge } from '@/components/Badge'
import { Card, CardHeader, EmptyState, PageHeader, ProgressBar } from '@/components/ui'
import { scoreBand } from '@/charts/theme'
import { attemptScorePct, relativeDay } from '@/lib/stats'

const LEVEL_LABEL = ['미충족', '부분 충족', '충족']

export function Result() {
  const { attemptId } = useParams()
  const attempt = attemptId ? fetchAttempt(attemptId) : undefined

  if (!attempt) {
    return <EmptyState title="존재하지 않는 실습 기록입니다" description="실습 기록 목록에서 다시 선택해 주세요." />
  }

  const course = fetchCourse(attempt.courseId)!
  const user = fetchUser(attempt.userId)!
  const pct = attemptScorePct(attempt)
  const band = pct !== null ? scoreBand(pct) : null
  const siblings = listAttempts(attempt.userId).filter((a) => a.courseId === attempt.courseId)
  const checkItem = course.checkItems.find((c) => c.id === attempt.answer?.checkItemId)

  return (
    <>
      <PageHeader
        eyebrow={`${course.title} · ${attempt.attemptNo}차 시도`}
        title="학습 결과"
        description={`${user.displayName} · ${relativeDay(attempt.endedAt)} 제출`}
        actions={
          <div className="flex items-center gap-2">
            <DataSourceBadge value={attempt.source} />
            <Link
              to="/attempts/new"
              className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              재실습
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="제출한 답변"
              aside={band ? <Badge tone={band.tone}>{pct}% · {band.label}</Badge> : undefined}
            />
            {attempt.answer ? (
              <div className="space-y-3.5">
                <Field label="선택한 근거 구간">
                  <div className="flex flex-wrap gap-1.5">
                    {attempt.answer.evidenceIds.map((id) => (
                      <span
                        key={id}
                        className="rounded-md bg-brand-50 px-2 py-1 font-mono text-[11px] text-brand-700"
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                </Field>
                <Field label="먼저 확인할 항목">
                  <div className="text-[13px] font-medium text-slate-800">{checkItem?.label ?? '—'}</div>
                  {checkItem && (
                    <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">{checkItem.hint}</p>
                  )}
                </Field>
                <Field label="판단 이유">
                  <p className="rounded-lg bg-slate-50 px-3.5 py-3 text-[13px] leading-relaxed text-slate-700">
                    {attempt.answer.reason}
                  </p>
                </Field>
              </div>
            ) : (
              <EmptyState title="제출된 답변이 없습니다" description="측정만 하고 답변을 제출하지 않은 시도입니다." />
            )}
          </Card>

          <Card>
            <CardHeader
              title="학습 피드백"
              subtitle="과정 루브릭과 제출 답변만 근거로 생성합니다"
              aside={
                attempt.feedback?.generatedBy === 'mock' ? (
                  <Badge tone="warn">AI 미연결 · 샘플 피드백</Badge>
                ) : (
                  <Badge tone="ok">AI 생성</Badge>
                )
              }
            />
            {attempt.feedback ? (
              <div className="space-y-4">
                <FeedbackBlock title="잘 관찰한 부분" tone="ok" items={attempt.feedback.good} />
                <FeedbackBlock title="보완할 부분" tone="warn" items={attempt.feedback.improve} />
                <FeedbackBlock title="다음 학습 제안" tone="brand" items={[attempt.feedback.nextStep]} />
                <FeedbackBlock
                  title="이 데이터로 판단할 수 없는 것"
                  tone="muted"
                  items={attempt.feedback.cannotJudge}
                />
              </div>
            ) : (
              <EmptyState
                title="피드백이 아직 없습니다"
                description="답변을 제출하면 피드백을 생성합니다. 생성에 실패해도 제출한 답변은 보존됩니다."
              />
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="관측 요약" subtitle="측정 기록에서 계산한 값" />
            {attempt.summary ? (
              <dl className="space-y-2.5 text-[13px]">
                <Row label="측정 길이" value={`${(attempt.summary.durationMs / 1000).toFixed(1)}초`} />
                <Row label="안정화 구간" value={`${(attempt.summary.settlingDurationMs / 1000).toFixed(1)}초`} />
                <Row label="기준 대비 최대 기울기" value={`${attempt.summary.maxTiltDeltaDeg.toFixed(1)}°`} />
                <Row label="최대 각속도" value={`${attempt.summary.peakGyroMag.toFixed(1)}°/s`} />
                <Row label="이상 후보 구간" value={`${attempt.summary.anomalyWindowCount}개`} />
              </dl>
            ) : (
              <EmptyState title="측정 요약이 없습니다" description="측정 데이터가 부족한 시도입니다." />
            )}
            <p className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] leading-relaxed text-slate-400">
              이상 후보는 정상 기준과 다른 구간을 표시한 것이며 고장 확률이 아닙니다.
            </p>
          </Card>

          {attempt.rubricScores && (
            <Card>
              <CardHeader title="기준별 확인 결과" />
              <div className="space-y-3">
                {course.rubric.map((r, i) => {
                  const level = attempt.rubricScores![i] ?? 0
                  return (
                    <div key={r.short}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-[12px] font-medium text-slate-700">{r.short}</span>
                        <span className="text-[11px] text-slate-400">{LEVEL_LABEL[level]}</span>
                      </div>
                      <ProgressBar value={level * 50} showLabel={false} />
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="이 과정의 시도" />
            <ul className="space-y-1.5">
              {siblings.map((s) => (
                <li key={s.id}>
                  <Link
                    to={`/attempts/${s.id}/result`}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-[13px] transition ${
                      s.id === attempt.id ? 'bg-brand-50 text-brand-700' : 'hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span>{s.attemptNo}차 시도</span>
                    <span className="text-[11px] text-slate-400">{relativeDay(s.endedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="기록된 버전" subtitle="과거 피드백을 현재 기준으로 조용히 바꾸지 않기 위해 저장합니다" />
            <dl className="space-y-2.5 text-[12px]">
              <Row label="과정 버전" value={attempt.courseVersion} />
              <Row label="판정 기준" value={attempt.modelVersion} />
              <Row label="설정" value={attempt.settingsVersion} />
            </dl>
          </Card>
        </div>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-medium text-slate-400">{label}</div>
      {children}
    </div>
  )
}

const BLOCK_TONE = {
  ok: 'border-ok-500/30 bg-ok-50/60',
  warn: 'border-warn-500/30 bg-warn-50/60',
  brand: 'border-brand-600/20 bg-brand-50/60',
  muted: 'border-slate-200 bg-slate-50',
} as const

function FeedbackBlock({
  title,
  tone,
  items,
}: {
  title: string
  tone: keyof typeof BLOCK_TONE
  items: string[]
}) {
  if (items.length === 0) return null
  return (
    <div className={`rounded-lg border px-3.5 py-3 ${BLOCK_TONE[tone]}`}>
      <div className="mb-1.5 text-[12px] font-semibold text-slate-700">{title}</div>
      <ul className="space-y-1">
        {items.map((t) => (
          <li key={t} className="text-[12.5px] leading-relaxed text-slate-600">
            {t}
          </li>
        ))}
      </ul>
    </div>
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
