import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchAttempt, fetchCourse, fetchUser, listAttempts, requestFeedback } from '@/api'
import type { Attempt, Course, User } from '@/types'
import { Badge, InputDeviceBadge } from '@/components/Badge'
import { Loaded } from '@/components/LoadState'
import { Card, CardHeader, EmptyState, PageHeader, ProgressBar } from '@/components/ui'
import { isAlignmentSummary } from '@/types'
import type { JudgmentScenario, JudgmentSummary } from '@/types'
import { useApi } from '@/lib/useApi'
import { RESULT_HEADLINE, fillTemplate } from '@/data/copy'
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

/**
 * 결과를 한 문장으로 말한다. 숫자를 못 읽어도 통과 여부와 가장 약한 기준을 바로 알게 한다.
 * 문장 조각은 전부 데이터에서 온다 — 기준 이름은 과정 루브릭, 판정 이유는 채점 결과.
 */
function headlineFor(attempt: Attempt, course: Course): string {
  if (!attempt.answer) return RESULT_HEADLINE.noAnswer
  if (!attempt.rubricScores) return RESULT_HEADLINE.notScored

  const scores = attempt.rubricScores
  // 통과 판정은 유형마다 다른 값에서 읽는다.
  const passed = isAlignmentSummary(attempt.summary)
    ? attempt.summary.converged
    : (attempt.summary?.passed ?? false)
  const judgment = course.exerciseType === 'judgment'
  const lead = judgment
    ? passed
      ? RESULT_HEADLINE.passedJudgment
      : RESULT_HEADLINE.failedJudgment
    : passed
      ? RESULT_HEADLINE.passed
      : RESULT_HEADLINE.failed

  // 가장 약한 기준 하나를 고른다. 같은 점수면 앞선 기준을 쓴다.
  let weakIndex = 0
  scores.forEach((level, i) => {
    if (level < scores[weakIndex]!) weakIndex = i
  })
  if ((scores[weakIndex] ?? 0) >= 2) return `${lead} ${RESULT_HEADLINE.allGood}`

  const short = course.rubric[weakIndex]?.short ?? ''
  // 판정 이유는 채점 결과에서만 가져온다. 없으면 기준 문장(질문형)을 억지로 붙이지 않는다.
  const reason = attempt.rubricReasons?.[weakIndex]
  const tail = reason
    ? fillTemplate(RESULT_HEADLINE.weakest, { short, reason })
    : fillTemplate(RESULT_HEADLINE.weakestNoReason, { short })
  return `${lead} ${passed ? RESULT_HEADLINE.butPrefix : ''}${tail}`
}

function ResultView({ data, onChanged }: { data: ResultData; onChanged: () => void }) {
  const { attempt, course, user, siblings } = data
  const settings = course.alignment
  // 아래 카드들은 정렬 실습의 지표를 쓴다. 다른 유형이면 null 이 되어 그리지 않는다.
  const summary = isAlignmentSummary(attempt.summary) ? attempt.summary : null
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
            {/* 조작 장치가 없는 실습에는 입력 출처 배지를 달지 않는다 */}
            {course.exerciseType === 'judgment' ? (
              <Badge tone="muted">조작 장치 없음</Badge>
            ) : (
              <InputDeviceBadge value={attempt.inputDevice} />
            )}
            <Link
              to={`/attempts/new?courseId=${course.id}`}
              className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              다시 연습
            </Link>
          </div>
        }
      />

      <Card className="mb-4">
        <p className="text-[15px] font-semibold leading-relaxed text-slate-900">
          {headlineFor(attempt, course)}
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          {course.exerciseType === 'judgment' && course.scenario && attempt.answer?.orderedIds && (
            <JudgmentResult
              scenario={course.scenario}
              orderedIds={attempt.answer.orderedIds}
              summary={isAlignmentSummary(attempt.summary) ? null : attempt.summary}
            />
          )}

          {summary && (
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
          )}

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
                {course.exerciseType === 'judgment' ? null : (
                <Field label="적어 낸 조정 순서">
                  <div className="text-[13px] font-medium text-slate-800">
                    {chosenOrder?.label ?? (attempt.answer.orderOptionId ? ORDER_LABEL[attempt.answer.orderOptionId] : undefined) ?? '—'}
                  </div>
                  {chosenOrder && (
                    <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">{chosenOrder.hint}</p>
                  )}
                </Field>
                )}
                <Field label={course.exerciseType === 'judgment' ? '그 순서로 확인하려는 이유' : '그 순서로 조정한 이유'}>
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

          <FeedbackCard
            attempt={attempt}
            onChanged={onChanged}
            basis={
              course.exerciseType === 'judgment'
                ? '제출한 순서와 이유만 근거로 만듭니다'
                : '기록된 궤적과 제출 답변만 근거로 만듭니다'
            }
          />
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

function FeedbackCard({
  attempt,
  onChanged,
  basis,
}: {
  attempt: Attempt
  onChanged: () => void
  basis: string
}) {
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
        subtitle={basis}
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

/**
 * judgment 실습 결과 — 내가 정한 순서와 이 과정이 권장하는 순서를 나란히 둔다.
 * 권장 순서는 **정답이 아니라 이 교육 과정이 정한 기준**이며, 그 사실을 항상 함께 표시한다.
 */
function JudgmentResult({
  scenario,
  orderedIds,
  summary,
}: {
  scenario: JudgmentScenario
  orderedIds: string[]
  summary: JudgmentSummary | null
}) {
  const labelOf = (id: string) => scenario.checkItems.find((c) => c.id === id)?.label ?? id
  const rows = Math.max(orderedIds.length, scenario.recommendedOrder.length)

  return (
    <>
      <Card>
        <CardHeader
          title="확인 순서"
          subtitle="내가 정한 순서와 이 과정이 권장하는 순서입니다"
          aside={
            summary ? (
              <Badge tone={summary.passed ? 'ok' : 'warn'}>
                {summary.passed ? '권장 순서와 가까움' : '권장 순서와 차이 있음'}
              </Badge>
            ) : undefined
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-[11px] font-medium text-slate-400">
              <tr>
                <th className="w-8 py-2">#</th>
                <th className="py-2">내가 정한 순서</th>
                <th className="py-2">이 과정의 권장 순서</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 border-t border-slate-100">
              {Array.from({ length: rows }, (_, i) => {
                const mine = orderedIds[i]
                const recommended = scenario.recommendedOrder[i]
                const same = mine !== undefined && mine === recommended
                return (
                  <tr key={i}>
                    <td className="py-2.5 text-slate-400">{i + 1}</td>
                    <td className={`py-2.5 pr-3 ${same ? 'font-medium text-ok-500' : 'text-slate-800'}`}>
                      {mine ? labelOf(mine) : '—'}
                      {same && <span className="ml-1.5 text-[10px] text-ok-500">같음</span>}
                    </td>
                    <td className="py-2.5 text-slate-600">
                      {recommended ? labelOf(recommended) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {summary && (
          <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
            <Metric label="첫 항목 순위" value={summary.firstPickRank} unit="번째" sub="권장 순서 기준" />
            <Metric label="순서 차이 합" value={summary.orderDistance} sub="0이면 완전 일치" />
            <Metric label="상위 3개 일치" value={`${summary.top3Overlap}/3`} sub="권장 상위 항목과" />
          </dl>
        )}
        <p className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] leading-relaxed text-slate-400">
          {scenario.orderNote}
        </p>
      </Card>

      <Card>
        <CardHeader title="왜 그 순서인가" subtitle="이 과정이 권장 순서를 정한 근거입니다" />
        <p className="text-[13px] leading-relaxed text-slate-700">{scenario.rationale}</p>
        <p className="mt-2.5 rounded-lg bg-slate-50 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-slate-500">
          {scenario.orderNote}
        </p>
      </Card>
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
