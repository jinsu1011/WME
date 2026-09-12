import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchAttempt, fetchCourse, fetchUser, listAttempts } from '@/api'
import { Badge, InputSourceBadge } from '@/components/Badge'
import { Card, CardHeader, EmptyState, PageHeader, ProgressBar } from '@/components/ui'
import { AlignmentView } from '@/components/AlignmentView'
import { ErrorTrend } from '@/charts/Charts'
import { scoreBand } from '@/charts/theme'
import { positionError, toMicrometer } from '@/lib/alignment'
import { attemptScorePct, relativeDay } from '@/lib/stats'
import { ORDER_LABEL } from '@/lib/scoring'

const LEVEL_LABEL = ['미충족', '부분 충족', '충족']

export function Result() {
  const { attemptId } = useParams()
  const attempt = attemptId ? fetchAttempt(attemptId) : undefined

  if (!attempt) {
    return <EmptyState title="존재하지 않는 실습 기록입니다" description="기록 목록에서 다시 선택해 주세요." />
  }

  const course = fetchCourse(attempt.courseId)!
  const user = fetchUser(attempt.userId)!
  const settings = course.alignment
  const summary = attempt.summary
  const pct = attemptScorePct(attempt)
  const band = pct !== null ? scoreBand(pct) : null
  const siblings = listAttempts(attempt.userId).filter((a) => a.courseId === attempt.courseId)
  const chosenOrder = course.orderOptions.find((o) => o.id === attempt.answer?.orderOptionId)

  const trend = attempt.samples.map((s) => ({
    sec: s.tMs / 1000,
    errorPx: Math.round(positionError(s.dx, s.dy) * 10) / 10,
  }))

  return (
    <>
      <PageHeader
        eyebrow={`${course.title} · ${attempt.attemptNo}차 연습`}
        title="연습 결과"
        description={`${user.displayName} · ${relativeDay(attempt.endedAt)} 제출`}
        actions={
          <div className="flex items-center gap-2">
            {attempt.source === 'mock' && <Badge tone="warn">예시 데이터</Badge>}
            <InputSourceBadge value={attempt.inputSource} />
            <Link
              to="/attempts/new"
              className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              다시 연습
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="정렬 결과"
              subtitle="기록에서 계산한 값입니다"
              aside={
                summary ? (
                  <Badge tone={summary.converged ? 'ok' : 'warn'}>
                    {summary.converged ? '허용 오차 통과' : '허용 오차 미통과'}
                  </Badge>
                ) : undefined
              }
            />
            {summary && settings ? (
              <>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  <Metric
                    label="최종 위치 오차"
                    value={positionError(summary.finalDx, summary.finalDy).toFixed(1)}
                    unit="px"
                    sub={`X ${summary.finalDx.toFixed(1)} · Y ${summary.finalDy.toFixed(1)}`}
                  />
                  <Metric
                    label="최종 회전 오차"
                    value={Math.abs(summary.finalDTheta).toFixed(1)}
                    unit="°"
                    sub={`허용 ±${settings.toleranceDeg}°`}
                  />
                  <Metric
                    label="소요 시간"
                    value={(summary.durationMs / 1000).toFixed(1)}
                    unit="초"
                    sub="정렬 시작부터 확정까지"
                  />
                  <Metric label="보정 횟수" value={summary.adjustmentCount} unit="회" sub="조작을 멈췄다 다시 한 횟수" />
                  <Metric
                    label="과잉 보정"
                    value={summary.overshootCount}
                    unit="회"
                    sub="목표를 지나쳤다 되돌아온 횟수"
                  />
                  <Metric
                    label="허용 범위"
                    value={`±${settings.tolerancePx}`}
                    unit="px"
                    sub="과정 설정값"
                  />
                </div>
                <p className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] leading-relaxed text-slate-400">
                  화면 단위 px 을 교육용으로 환산하면 약{' '}
                  {toMicrometer(positionError(summary.finalDx, summary.finalDy), settings)}µm 에
                  해당합니다. 허용 오차와 환산값은 모두 교육 과정 설정값이며 실제 장비의 정렬
                  정밀도가 아닙니다.
                </p>
              </>
            ) : (
              <EmptyState title="결과 요약이 없습니다" description="기록이 부족한 연습입니다." />
            )}
          </Card>

          {settings && attempt.samples.length > 1 && (
            <Card>
              <CardHeader
                title="보정 궤적"
                subtitle="어떤 경로로 오차를 줄였는지 그대로 그린 것입니다"
              />
              <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
                <div>
                  <AlignmentView
                    dx={summary?.finalDx ?? 0}
                    dy={summary?.finalDy ?? 0}
                    dTheta={summary?.finalDTheta ?? 0}
                    settings={settings}
                    within={summary?.converged ?? false}
                    trail={attempt.samples}
                  />
                  <p className="mt-1 text-center text-[10.5px] text-slate-400">지나온 경로와 최종 위치</p>
                </div>
                <div>
                  <ErrorTrend data={trend} tolerancePx={settings.tolerancePx} />
                  <p className="mt-1 text-[10.5px] leading-relaxed text-slate-400">
                    선이 아래로 내려갈수록 오차가 줄어든 것입니다. 중간에 올라간 구간은 목표를
                    지나쳤다가 되돌아온 것입니다.
                  </p>
                </div>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader
              title="제출한 답변"
              aside={band ? <Badge tone={band.tone}>{pct}% · {band.label}</Badge> : undefined}
            />
            {attempt.answer ? (
              <div className="space-y-3.5">
                <Field label="적어 낸 조정 순서">
                  <div className="text-[13px] font-medium text-slate-800">
                    {chosenOrder?.label ?? ORDER_LABEL[attempt.answer.orderOptionId] ?? '—'}
                  </div>
                  {chosenOrder && (
                    <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">{chosenOrder.hint}</p>
                  )}
                </Field>
                <Field label="그 순서로 조정한 이유">
                  <p className="rounded-lg bg-slate-50 px-3.5 py-3 text-[13px] leading-relaxed text-slate-700">
                    {attempt.answer.reason}
                  </p>
                </Field>
              </div>
            ) : (
              <EmptyState
                title="제출된 답변이 없습니다"
                description="정렬만 하고 답변을 제출하지 않은 기록입니다."
              />
            )}
          </Card>

          <Card>
            <CardHeader
              title="학습 피드백"
              subtitle="기록된 궤적과 제출 답변만 근거로 만듭니다"
              aside={
                attempt.feedback?.generatedBy === 'mock' ? (
                  <Badge tone="warn">AI 미연결 · 규칙 기반 샘플</Badge>
                ) : (
                  <Badge tone="ok">AI 생성</Badge>
                )
              }
            />
            {attempt.feedback ? (
              <div className="space-y-4">
                <FeedbackBlock title="잘 한 부분" tone="ok" items={attempt.feedback.good} />
                <FeedbackBlock title="보완할 부분" tone="warn" items={attempt.feedback.improve} />
                <FeedbackBlock title="다음 연습 제안" tone="brand" items={[attempt.feedback.nextStep]} />
                <FeedbackBlock
                  title="이 기록으로 판단할 수 없는 것"
                  tone="muted"
                  items={attempt.feedback.cannotJudge}
                />
              </div>
            ) : (
              <EmptyState
                title="피드백이 아직 없습니다"
                description="답변을 제출하면 피드백을 만듭니다. 만들기에 실패해도 제출한 답변은 보존됩니다."
              />
            )}
          </Card>
        </div>

        <div className="space-y-4">
          {attempt.rubricScores && (
            <Card>
              <CardHeader title="기준별 확인 결과" subtitle="과정에 등록된 4개 기준" />
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
                      <p className="mt-1 text-[10.5px] leading-relaxed text-slate-400">{r.text}</p>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {attempt.events.length > 0 && (
            <Card>
              <CardHeader title="과잉 보정 구간" subtitle="규칙으로 계산한 구간입니다" />
              <ul className="space-y-1.5">
                {attempt.events.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[12px]"
                  >
                    <span className="text-slate-600">
                      {(e.startMs / 1000).toFixed(1)}~{(e.endMs / 1000).toFixed(1)}초
                    </span>
                    <span className="font-medium text-slate-700">
                      {e.axis === 'xy' ? '위치' : '회전'}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader title="이 과정의 연습" />
            <ul className="space-y-1.5">
              {siblings.map((s) => (
                <li key={s.id}>
                  <Link
                    to={`/attempts/${s.id}/result`}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-[13px] transition ${
                      s.id === attempt.id ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{s.attemptNo}차 연습</span>
                    <span className="text-[11px] text-slate-400">{relativeDay(s.endedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader
              title="기록된 버전"
              subtitle="과거 피드백을 현재 기준으로 조용히 바꾸지 않기 위해 저장합니다"
            />
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

function Metric({
  label,
  value,
  unit,
  sub,
}: {
  label: string
  value: string | number
  unit?: string
  sub?: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2.5">
      <div className="text-[10.5px] text-slate-400">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-0.5">
        <span className="text-[19px] font-bold tabular-nums text-slate-900">{value}</span>
        {unit && <span className="text-[11px] text-slate-400">{unit}</span>}
      </div>
      {sub && <div className="mt-0.5 text-[10px] leading-tight text-slate-400">{sub}</div>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
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
