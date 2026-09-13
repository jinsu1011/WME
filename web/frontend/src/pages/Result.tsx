import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchAttempt, fetchCourse, fetchUser, listAttempts, requestFeedback } from '@/api'
import type { Attempt, Course, User } from '@/types'
import { Badge, InputDeviceBadge } from '@/components/Badge'
import { Loaded } from '@/components/LoadState'
import { Card, CardHeader, EmptyState, PageHeader, ProgressBar } from '@/components/ui'
import { useApi } from '@/lib/useApi'
import { AlignmentView } from '@/components/AlignmentView'
import { ErrorTrend } from '@/charts/Charts'
import { scoreBand } from '@/charts/theme'
import { positionError, toMicrometer } from '@/lib/alignment'
import { attemptScorePct, relativeDay } from '@/lib/stats'
import { ORDER_LABEL } from '@/lib/scoring'

const LEVEL_LABEL = ['미충족', '부분 충족', '충족']

interface ResultData {
  attempt: Attempt
  course: Course
  user: User
  siblings: Attempt[]
}

export function Result() {
  const { attemptId } = useParams()
  const state = useApi<ResultData | null>(async () => {
    if (!attemptId) return null
    const attempt = await fetchAttempt(attemptId, true)
    if (!attempt) return null
    const [course, user, mine] = await Promise.all([
      fetchCourse(attempt.courseId),
      fetchUser(attempt.userId),
      listAttempts(attempt.userId),
    ])
    if (!course || !user) return null
    return {
      attempt,
      course,
      user,
      siblings: mine.filter((a) => a.courseId === attempt.courseId),
    }
  }, [attemptId])

  return (
    <Loaded state={state} label="연습 결과를 불러오는 중입니다">
      {(data) =>
        data ? (
          <ResultView data={data} onChanged={state.reload} />
        ) : (
          <EmptyState
            title="존재하지 않는 실습 기록입니다"
            description="기록 목록에서 다시 선택해 주세요."
          />
        )
      }
    </Loaded>
  )
}

function ResultView({ data, onChanged }: { data: ResultData; onChanged: () => void }) {
  const { attempt, course, user, siblings } = data
  const settings = course.alignment
  const summary = attempt.summary
  const pct = attemptScorePct(attempt)
  const band = pct !== null ? scoreBand(pct) : null
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
            <InputDeviceBadge value={attempt.inputDevice} />
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

          <FeedbackCard attempt={attempt} onChanged={onChanged} />
        </div>

        <div className="space-y-4">
          {!attempt.rubricScores && attempt.answer && (
            <Card className="border-dashed">
              <CardHeader
                title="기준별 확인 결과"
                subtitle="과정에 등록된 4개 기준"
                aside={<Badge tone="warn">채점 전</Badge>}
              />
              <p className="text-[12.5px] leading-relaxed text-slate-500">
                이 연습은 아직 기준별로 채점되지 않았습니다. 채점은 학습 피드백을 만들 때 함께
                이루어집니다. 제출한 답변과 연습 기록은 그대로 저장되어 있습니다.
              </p>
              <ul className="mt-3 space-y-1.5">
                {course.rubric.map((r) => (
                  <li key={r.short} className="flex gap-2.5 text-[11.5px] leading-relaxed text-slate-500">
                    <span className="w-16 shrink-0 font-semibold text-slate-600">{r.short}</span>
                    <span>{r.text}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {attempt.rubricScores && (
            <Card>
              <CardHeader title="기준별 확인 결과" subtitle="과정에 등록된 4개 기준" />
              {/* 누가 채점했는지 한 줄로 분명히 밝힌다 */}
              <div className="-mt-2 mb-3.5">
                {attempt.rubricSource === 'llm' ? (
                  <Badge tone="ok">AI 채점</Badge>
                ) : (
                  <Badge tone="warn">규칙 기반 임시 채점 · AI 미연결</Badge>
                )}
              </div>
              <div className="space-y-3">
                {course.rubric.map((r, i) => {
                  const level = attempt.rubricScores![i] ?? 0
                  const why = attempt.rubricReasons?.[i]
                  return (
                    <div key={r.short}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-[12px] font-medium text-slate-700">{r.short}</span>
                        <span className="text-[11px] text-slate-400">{LEVEL_LABEL[level]}</span>
                      </div>
                      <ProgressBar value={level * 50} showLabel={false} />
                      {/* 규칙 채점일 때는 서버가 준 판단 근거를, 없으면 기준 문장을 보여준다 */}
                      <p className="mt-1 text-[10.5px] leading-relaxed text-slate-500">
                        {why ?? r.text}
                      </p>
                    </div>
                  )
                })}
              </div>
              {attempt.rubricSource !== 'llm' && (
                <p className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] leading-relaxed text-slate-400">
                  이 점수는 기록에서 계산한 규칙 기반 임시 채점입니다. 모델이 연결되면 같은 기준으로
                  다시 채점하며, 그때 이 표시가 'AI 채점'으로 바뀝니다.
                </p>
              )}
            </Card>
          )}

          {attempt.events.length > 0 && (
            <Card>
              <CardHeader
                title="과잉 보정 구간"
                subtitle={`규칙으로 계산한 구간 ${attempt.events.length}개 중 긴 순서로 ${Math.min(
                  8,
                  attempt.events.length,
                )}개`}
              />
              <ul className="space-y-1.5">
                {[...attempt.events]
                  .sort((a, b) => b.endMs - b.startMs - (a.endMs - a.startMs))
                  .slice(0, 8)
                  .map((e) => (
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
              {attempt.events.length > 8 && (
                <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-400">
                  나머지 {attempt.events.length - 8}개는 화면에 싣지 않았습니다. 전체 횟수는 위
                  '정렬 결과'의 과잉 보정 값과 같습니다.
                </p>
              )}
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

/**
 * 학습 피드백 카드.
 * 생성에 실패해도 **학습자가 제출한 답변은 서버에 그대로 남아 있다**는 것을 화면에 알린다.
 */
/** 서버가 실패 사유를 JSON 문자열로 담아 줄 때가 있다. 사람이 읽을 문장만 꺼낸다. */
function readableError(raw: string | null): string | null {
  if (!raw) return null
  const text = raw.trim()
  if (!text.startsWith('{')) return text
  try {
    const parsed = JSON.parse(text) as { message?: string }
    return parsed.message ?? text
  } catch {
    return text
  }
}

function FeedbackCard({ attempt, onChanged }: { attempt: Attempt; onChanged: () => void }) {
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  const status = attempt.feedbackStatus
  const failed = status === 'failed' || (status !== 'ready' && Boolean(attempt.feedbackError))

  async function retry() {
    setRetrying(true)
    setRetryError(null)
    try {
      await requestFeedback(attempt.id)
      onChanged()
    } catch (e: unknown) {
      setRetryError(e instanceof Error ? e.message : '피드백을 만들지 못했습니다.')
    } finally {
      setRetrying(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="학습 피드백"
        subtitle="기록된 궤적과 제출 답변만 근거로 만듭니다"
        aside={
          attempt.feedback ? (
            attempt.feedback.generatedBy === 'mock' ? (
              <Badge tone="warn">AI 미연결 · 규칙 기반 샘플</Badge>
            ) : (
              <Badge tone="ok">AI 생성</Badge>
            )
          ) : failed ? (
            <Badge tone="alert">생성 실패</Badge>
          ) : status === 'pending' ? (
            <Badge tone="brand">생성 중</Badge>
          ) : (
            <Badge tone="muted">아직 없음</Badge>
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
      ) : failed ? (
        <div className="rounded-lg border border-alert-500/30 bg-alert-50/50 px-3.5 py-3">
          <div className="text-[13px] font-semibold text-slate-800">
            피드백을 만들지 못했습니다
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
            {retryError ?? readableError(attempt.feedbackError) ?? '생성 중 문제가 발생했습니다.'}
          </p>
          <p className="mt-1.5 text-[12px] font-medium text-slate-700">
            제출한 답변과 연습 기록은 그대로 저장되어 있습니다. 다시 만들어도 답변은 바뀌지 않습니다.
          </p>
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            className="mt-3 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:bg-slate-300"
          >
            {retrying ? '다시 시도 중…' : '다시 시도'}
          </button>
        </div>
      ) : status === 'pending' ? (
        <EmptyState title="피드백을 만들고 있습니다" description="잠시 뒤 이 화면을 새로 고쳐 주세요." />
      ) : (
        <div>
          <EmptyState
            title="피드백이 아직 없습니다"
            description="피드백을 만들어도 제출한 답변은 바뀌지 않습니다. 실패해도 답변은 보존됩니다."
          />
          {attempt.answer && (
            <button
              type="button"
              onClick={retry}
              disabled={retrying}
              className="mt-3 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:bg-slate-300"
            >
              {retrying ? '만드는 중…' : '피드백 만들기'}
            </button>
          )}
          {retryError && (
            <p className="mt-2 rounded-lg bg-alert-50 px-3 py-2 text-[12px] leading-relaxed text-alert-500">
              {retryError} — 제출한 답변은 그대로 남아 있습니다.
            </p>
          )}
        </div>
      )}
    </Card>
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
