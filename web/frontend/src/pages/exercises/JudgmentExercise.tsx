import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createAttempt, submitAnswer } from '@/api'
import type { Course } from '@/types'
import { Badge } from '@/components/Badge'
import { Card, CardHeader, PageHeader } from '@/components/ui'
import { initialOrder, isCompleteOrder, moveItem } from '@/lib/judgment'
import { useDemo } from '@/lib/demo'

/**
 * 상황 판단 실습(exerciseType: judgment).
 *
 * 조작 장치가 없다. 읽고 · 순서를 정하고 · 이유를 적는다.
 * **권장 순서와 그 근거는 제출 전에 화면 어디에도 나타나지 않는다.** 결과 화면에서만 보여준다.
 * 시나리오 문구는 전부 과정 데이터(`course.scenario`)에서 온다.
 */
export function JudgmentExercise({ course }: { course: Course }) {
  const scenario = course.scenario!
  const navigate = useNavigate()
  const { userId } = useDemo()

  // 시작 순서는 고정 규칙으로 섞는다. 과정에 적힌 순서가 권장 순서와 같을 수 있어,
  // 그대로 두면 아무것도 하지 않고 제출해도 만점이 되고 권장 순서가 노출된다.
  const [orderedIds, setOrderedIds] = useState<string[]>(() => initialOrder(scenario, course.id))
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const startedAtRef = useRef<string>(new Date().toISOString())
  // 소요 시간 기준점. 렌더 중에 시계를 읽지 않도록 화면이 뜬 뒤에 한 번만 잡는다.
  const startedMsRef = useRef<number>(0)
  useEffect(() => {
    startedMsRef.current = performance.now()
  }, [])

  const labelOf = useMemo(() => {
    const map = new Map(scenario.checkItems.map((item) => [item.id, item.label]))
    return (id: string) => map.get(id) ?? id
  }, [scenario.checkItems])

  function move(index: number, delta: number) {
    setOrderedIds((current) => moveItem(current, index, delta))
  }

  async function submit() {
    if (!isCompleteOrder(orderedIds, scenario)) {
      setFormError('확인 항목이 빠짐없이 한 번씩 들어가야 합니다.')
      return
    }
    if (reason.trim().length < 5) {
      setFormError('그 순서로 확인하려는 이유를 한 문장이라도 적어 주세요.')
      return
    }
    setSubmitting(true)
    setFormError(null)

    try {
      const created = await createAttempt({
        userId,
        courseId: course.id,
        inputDevice: 'keyboard',
        startedAt: startedAtRef.current,
        durationMs: Math.round(performance.now() - startedMsRef.current),
      })
      await submitAnswer(created.id, { orderedIds, reason: reason.trim() })
      navigate(`/attempts/${created.id}/result`)
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : '제출하지 못했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={course.title}
        title="상황 판단 실습"
        description="관측값을 읽고 무엇부터 확인할지 순서를 정한 뒤, 그 이유를 적어 제출합니다."
        actions={<Badge tone="muted">조작 장치 없음</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="상황" subtitle="검사에서 확인된 내용입니다" />
            <p className="text-[14px] leading-relaxed text-slate-700">{scenario.situation}</p>
          </Card>

          <Card padded={false}>
            <div className="px-5 pt-5">
              <CardHeader title="관측값" subtitle="지금까지 확인된 값만 적혀 있습니다" />
            </div>
            <table className="w-full text-left text-[13px]">
              <tbody className="divide-y divide-slate-100 border-t border-slate-100">
                {scenario.observations.map((row) => (
                  <tr key={row.label}>
                    <th className="w-40 px-5 py-3 font-medium text-slate-500">{row.label}</th>
                    <td className="px-5 py-3 text-slate-800">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="확인 순서 정하기"
              subtitle="먼저 확인할 것을 위로 올립니다. 다섯 개 모두 순서를 정합니다"
            />
            <ol className="space-y-2">
              {orderedIds.map((id, index) => (
                <li
                  key={id}
                  className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-[13px] leading-snug text-slate-800">
                    {labelOf(id)}
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={`${labelOf(id)} 위로`}
                      className="rounded-md border border-slate-200 px-2 py-1 text-[12px] text-slate-600 transition hover:bg-slate-50 disabled:text-slate-300"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === orderedIds.length - 1}
                      aria-label={`${labelOf(id)} 아래로`}
                      className="rounded-md border border-slate-200 px-2 py-1 text-[12px] text-slate-600 transition hover:bg-slate-50 disabled:text-slate-300"
                    >
                      ↓
                    </button>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              위아래 버튼으로 순서를 바꿉니다. 제출하기 전에는 권장 순서를 보여주지 않습니다.
            </p>
          </Card>

          <Card>
            <CardHeader
              title="그 순서로 확인하려는 이유"
              subtitle="관측값의 어느 부분을 보고 그렇게 판단했는지 적습니다"
            />
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="예: 가장자리만 흐리고 중심은 정상이라는 점이 면 전체에 걸친 조건을 가리킨다고 봤습니다."
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <div className="mt-1 text-right text-[11px] text-slate-400">
              {reason.trim().length}자
            </div>

            {formError && (
              <p className="mt-2 rounded-lg bg-alert-50 px-3 py-2 text-xs font-medium text-alert-500">
                {formError}
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="mt-3 w-full rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:bg-slate-300"
            >
              {submitting ? '제출 중…' : '제출하고 결과 보기'}
            </button>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
              제출하면 새 기록으로 저장됩니다. 이전 기록은 지워지지 않습니다.
            </p>
          </Card>

          <Link
            to={`/courses/${course.id}`}
            className="block text-center text-[12px] font-medium text-slate-500 hover:text-slate-800"
          >
            대기방으로 돌아가기
          </Link>
        </div>
      </div>
    </>
  )
}
