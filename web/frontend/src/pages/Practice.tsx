import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createAttempt, fetchCourse, submitAnswer } from '@/api'
import { IMPLEMENTED_COURSE_ID } from '@/data/courses'
import type { AlignmentSettings, InputSource, PhaseMarker, Sample } from '@/types'
import { Badge, InputSourceBadge } from '@/components/Badge'
import { Card, CardHeader, EmptyState, PageHeader } from '@/components/ui'
import { AlignmentLegend, AlignmentView, ErrorReadout } from '@/components/AlignmentView'
import { countAdjustments, detectOvershoots, isWithinTolerance, positionError } from '@/lib/alignment'
import { KeyboardSource, TiltSource } from '@/input'
import { useDemo } from '@/lib/demo'

type Phase = 'ready' | 'aligning' | 'confirmed'

/** 기록 주기(ms). 초당 20개면 궤적 모양을 그리기에 충분하다. */
const SAMPLE_EVERY_MS = 50

export function Practice() {
  const course = fetchCourse(IMPLEMENTED_COURSE_ID)
  if (!course || !course.alignment) {
    return (
      <EmptyState
        title="실습 설정을 불러올 수 없습니다"
        description="과정 데이터에 정렬 실습 설정이 없습니다."
      />
    )
  }
  return <AlignmentPractice settings={course.alignment} courseId={course.id} />
}

function AlignmentPractice({
  settings,
  courseId,
}: {
  settings: AlignmentSettings
  courseId: string
}) {
  const navigate = useNavigate()
  const { currentUser } = useDemo()
  const course = fetchCourse(courseId)!

  const [inputKind, setInputKind] = useState<InputSource>('keyboard')
  const [phase, setPhase] = useState<Phase>('ready')
  const [error, setError] = useState({ dx: settings.startOffset.x, dy: settings.startOffset.y, dTheta: settings.startOffset.theta })
  const [elapsedMs, setElapsedMs] = useState(0)
  const [trail, setTrail] = useState<Sample[]>([])
  const [orderOptionId, setOrderOptionId] = useState('')
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // 화면을 다시 그리지 않아야 하는 값은 ref 에 둔다(매 프레임 바뀌므로).
  const posRef = useRef({ ...settings.startOffset })
  const samplesRef = useRef<Sample[]>([])
  const startedAtRef = useRef<string>(new Date().toISOString())
  const rafRef = useRef<number | null>(null)

  const keyboard = useMemo(() => new KeyboardSource(), [])
  const tilt = useMemo(() => new TiltSource(), [])
  const source = inputKind === 'keyboard' ? keyboard : tilt

  const within = isWithinTolerance(error.dx, error.dy, error.dTheta, settings)

  function reset() {
    posRef.current = { x: settings.startOffset.x, y: settings.startOffset.y, theta: settings.startOffset.theta }
    samplesRef.current = []
    setError({ dx: settings.startOffset.x, dy: settings.startOffset.y, dTheta: settings.startOffset.theta })
    setTrail([])
    setElapsedMs(0)
    setPhase('ready')
    setOrderOptionId('')
    setReason('')
    setFormError(null)
  }

  // 실습 루프 — 컨트롤러의 속도를 시간만큼 곱해 위치에 더한다.
  useEffect(() => {
    if (phase !== 'aligning') return
    if (!source.available) return

    source.start()
    startedAtRef.current = new Date().toISOString()
    const startTime = performance.now()
    let prev = startTime
    let lastSample = -Infinity
    samplesRef.current = []

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now
      const v = source.read()
      const p = posRef.current
      p.x += v.vx * dt
      p.y += v.vy * dt
      p.theta += v.vTheta * dt

      // 시야 밖으로 나가지 않게 막는다.
      const r = Math.hypot(p.x, p.y)
      if (r > settings.fieldRadius) {
        p.x = (p.x / r) * settings.fieldRadius
        p.y = (p.y / r) * settings.fieldRadius
      }
      p.theta = Math.max(-45, Math.min(45, p.theta))

      const tMs = now - startTime
      if (tMs - lastSample >= SAMPLE_EVERY_MS) {
        lastSample = tMs
        samplesRef.current.push({
          tMs: Math.round(tMs),
          roll: 0,
          pitch: 0,
          waferX: -p.x,
          waferY: -p.y,
          waferTheta: -p.theta,
          dx: Math.round(p.x * 10) / 10,
          dy: Math.round(p.y * 10) / 10,
          dTheta: Math.round(p.theta * 10) / 10,
        })
        setTrail([...samplesRef.current])
      }

      setError({
        dx: Math.round(p.x * 10) / 10,
        dy: Math.round(p.y * 10) / 10,
        dTheta: Math.round(p.theta * 10) / 10,
      })
      setElapsedMs(Math.round(tMs))
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      source.stop()
    }
  }, [phase, source, settings.fieldRadius])

  function confirmAlignment() {
    if (samplesRef.current.length < 2) {
      setFormError('아직 조작 기록이 없습니다. 마크를 움직인 뒤 확정해 주세요.')
      return
    }
    setFormError(null)
    setPhase('confirmed')
  }

  function submit() {
    if (!orderOptionId) {
      setFormError('어떤 순서로 조정했는지 골라 주세요.')
      return
    }
    if (reason.trim().length < 5) {
      setFormError('그 순서로 조정한 이유를 한 문장이라도 적어 주세요.')
      return
    }

    const samples = samplesRef.current
    const last = samples.at(-1)!
    const events = detectOvershoots(samples, settings)
    const phaseMarkers: PhaseMarker[] = [
      { phase: 'aligning', tMs: 0 },
      { phase: 'confirmed', tMs: last.tMs },
    ]

    const created = createAttempt({
      userId: currentUser.id,
      courseId,
      inputSource: inputKind,
      startedAt: startedAtRef.current,
      samples,
      events,
      phaseMarkers,
      summary: {
        finalDx: last.dx,
        finalDy: last.dy,
        finalDTheta: last.dTheta,
        durationMs: last.tMs,
        adjustmentCount: countAdjustments(samples),
        overshootCount: events.length,
        converged: isWithinTolerance(last.dx, last.dy, last.dTheta, settings),
      },
    })

    submitAnswer(created.id, {
      orderOptionId,
      reason: reason.trim(),
      submittedAt: new Date().toISOString(),
    })

    navigate(`/attempts/${created.id}/result`)
  }

  return (
    <>
      <PageHeader
        eyebrow={course.title}
        title="정렬 실습"
        description="두 마크를 허용 오차 안으로 겹친 뒤, 어떤 순서로 조정했는지와 이유를 적어 제출합니다."
        actions={<InputSourceBadge value={inputKind} />}
      />

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="정렬 마크"
              subtitle="고정된 마크에 조작하는 마크를 겹칩니다"
              aside={
                within ? <Badge tone="ok">허용 오차 안</Badge> : <Badge tone="muted">조정 중</Badge>
              }
            />
            <div className="mx-auto max-w-[380px]">
              <AlignmentView
                dx={error.dx}
                dy={error.dy}
                dTheta={error.dTheta}
                settings={settings}
                within={within}
                trail={phase === 'ready' ? undefined : trail}
              />
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <AlignmentLegend settings={settings} within={within} />
            </div>
          </Card>

          {phase === 'confirmed' && (
            <Card>
              <CardHeader
                title="조정 순서와 이유"
                subtitle="결과만으로는 판단 과정을 확인할 수 없습니다. 왜 그 순서였는지 적어 주세요"
              />
              <div className="space-y-2">
                {course.orderOptions.map((o) => (
                  <label
                    key={o.id}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3.5 py-2.5 transition ${
                      orderOptionId === o.id
                        ? 'border-brand-300 bg-brand-50/60'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="order"
                      className="mt-1"
                      checked={orderOptionId === o.id}
                      onChange={() => setOrderOptionId(o.id)}
                    />
                    <span>
                      <span className="block text-[13px] font-medium text-slate-800">{o.label}</span>
                      <span className="mt-0.5 block text-[11.5px] leading-relaxed text-slate-500">
                        {o.hint}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="mt-4">
                <div className="mb-1.5 text-[11px] font-medium text-slate-400">
                  그 순서로 조정한 이유
                </div>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="무엇을 보고 그렇게 판단했는지 적습니다. 예: 회전이 남아 있으면 위치를 맞춰도 다시 어긋나 보여서 회전을 먼저 세웠습니다."
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
                <div className="mt-1 text-right text-[11px] text-slate-400">{reason.trim().length}자</div>
              </div>

              {formError && (
                <p className="mt-2 rounded-lg bg-alert-50 px-3 py-2 text-xs font-medium text-alert-500">
                  {formError}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={submit}
                  className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  제출하고 결과 보기
                </button>
                <button
                  type="button"
                  onClick={() => setPhase('aligning')}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  다시 조정하기
                </button>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="남은 오차" subtitle="고정 마크 기준으로 계산한 값" />
            <ErrorReadout
              dx={error.dx}
              dy={error.dy}
              dTheta={error.dTheta}
              settings={settings}
              within={within}
            />
            <dl className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-[12.5px]">
              <Row label="경과 시간" value={`${(elapsedMs / 1000).toFixed(1)}초`} />
              <Row label="기록된 지점" value={`${trail.length}개`} />
              <Row
                label="위치 오차"
                value={`${positionError(error.dx, error.dy).toFixed(1)}px`}
              />
            </dl>
            <p className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] leading-relaxed text-slate-400">
              허용 오차는 교육 과정 설정값입니다. 실제 장비의 정렬 정밀도가 아닙니다.
            </p>
          </Card>

          <Card>
            <CardHeader title="진행" />
            {phase === 'ready' && (
              <button
                type="button"
                onClick={() => setPhase('aligning')}
                disabled={!source.available}
                className="w-full rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400"
              >
                정렬 시작
              </button>
            )}
            {phase === 'aligning' && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={confirmAlignment}
                  className="w-full rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  정렬 확정
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="w-full rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  처음부터 다시
                </button>
                {formError && (
                  <p className="rounded-lg bg-alert-50 px-3 py-2 text-xs font-medium text-alert-500">
                    {formError}
                  </p>
                )}
              </div>
            )}
            {phase === 'confirmed' && (
              <p className="text-[12.5px] leading-relaxed text-slate-500">
                정렬을 확정했습니다. 왼쪽 폼에 조정 순서와 이유를 적어 제출하면 새 기록으로
                저장됩니다. 이전 기록은 지워지지 않습니다.
              </p>
            )}
          </Card>

          <Card>
            <CardHeader title="조작 방법" subtitle="키를 누르고 있는 동안 계속 움직입니다" />
            <dl className="space-y-2 text-[12.5px]">
              {settings.controls.map((c) => (
                <div key={c.keys} className="flex items-center justify-between gap-3">
                  <dt className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-600">
                    {c.keys}
                  </dt>
                  <dd className="text-slate-600">{c.effect}</dd>
                </div>
              ))}
            </dl>
            {phase === 'aligning' && (
              <p className="mt-3 rounded-lg bg-brand-50/70 px-3 py-2 text-[11.5px] text-brand-700">
                이 화면을 클릭한 상태에서 키를 누르세요.
              </p>
            )}
          </Card>

          <Card>
            <CardHeader title="입력 출처" subtitle="무엇으로 조작하는지 항상 표시합니다" />
            <div className="space-y-2">
              {(
                [
                  { kind: 'keyboard' as const, src: keyboard, label: '키보드 조작' },
                  { kind: 'controller' as const, src: tilt, label: '모형 컨트롤러' },
                ]
              ).map(({ kind, src, label }) => (
                <button
                  key={kind}
                  type="button"
                  disabled={!src.available || phase !== 'ready'}
                  onClick={() => setInputKind(kind)}
                  className={`w-full rounded-lg border px-3.5 py-2.5 text-left transition disabled:cursor-not-allowed ${
                    inputKind === kind
                      ? 'border-brand-300 bg-brand-50/60'
                      : 'border-slate-200 disabled:bg-slate-50/60'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-slate-800">{label}</span>
                    {src.available ? (
                      <Badge tone={inputKind === kind ? 'brand' : 'muted'}>
                        {inputKind === kind ? '사용 중' : '사용 가능'}
                      </Badge>
                    ) : (
                      <Badge tone="muted">연결 안 됨</Badge>
                    )}
                  </span>
                  {!src.available && src.unavailableReason && (
                    <span className="mt-1 block text-[11px] leading-relaxed text-slate-400">
                      {src.unavailableReason}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] leading-relaxed text-slate-400">
              {settings.controllerNotice}
            </p>
          </Card>

          <Link
            to={`/courses/${courseId}`}
            className="block text-center text-[12px] font-medium text-slate-500 hover:text-slate-800"
          >
            대기방으로 돌아가기
          </Link>
        </div>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-medium tabular-nums text-slate-700">{value}</dd>
    </div>
  )
}
