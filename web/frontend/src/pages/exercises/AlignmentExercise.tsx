import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  API_MODE,
  createAttempt,
  markPhase,
  openAlignmentChannel,
  submitAnswer,
} from '@/api'
import type { AlignmentChannel } from '@/api'
import type { Course, InputDevice, Sample } from '@/types'
import { Badge, InputDeviceBadge } from '@/components/Badge'
import { Card, CardHeader, PageHeader } from '@/components/ui'
import { AlignmentLegend, AlignmentView, ErrorReadout } from '@/components/AlignmentView'
import {
  countAdjustments,
  detectOvershoots,
  isWithinTolerance,
  positionError,
  thinForDraw,
} from '@/lib/alignment'
import { KeyboardSource, TiltSource, ZERO_VELOCITY, mappingFromControl, speedFromControl } from '@/input'
import type { TiltAttitude, TiltSource as TiltSourceType } from '@/input'
import { ControllerPanel } from '@/components/ControllerPanel'
import { AlignmentStage3D } from '@/components/AlignmentStage3D'
import type { ExposureStage, StagePose } from '@/three/alignmentScene'
import { CLEAR_EXPOSURE_EVENT, PLAY_EXPOSURE_EVENT } from '@/three/alignmentScene'
import {
  CONTROLLER_TEXT,
  EXPOSURE_TEXT,
  LEVEL_TOLERANCE_DEG,
} from '@/data/controllerSettings'
import { useDemo } from '@/lib/demo'

type Phase = 'ready' | 'starting' | 'aligning' | 'confirmed'

/** 서버에 표본을 보내는 주기(ms). 초당 25회. 매 프레임(60fps) 보내면 과하다. */
const SEND_EVERY_MS = 40

/**
 * 정렬 실습(exerciseType: alignment).
 * 이전 `pages/Practice.tsx` 의 내용을 그대로 옮긴 것이다 — 동작과 화면은 바뀌지 않았다.
 */
export function AlignmentExercise({ course }: { course: Course }) {
  const settings = course.alignment!
  const navigate = useNavigate()
  const { userId } = useDemo()

  const [inputDevice, setInputDevice] = useState<InputDevice>('keyboard')
  const [phase, setPhase] = useState<Phase>('ready')
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [error, setError] = useState({
    dx: settings.startOffset.x,
    dy: settings.startOffset.y,
    dTheta: settings.startOffset.theta,
  })
  const [elapsedMs, setElapsedMs] = useState(0)
  const [trail, setTrail] = useState<Sample[]>([])
  const [orderOptionId, setOrderOptionId] = useState('')
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [channelKind, setChannelKind] = useState<'websocket' | 'local' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // 센서 모드 표시용 상태. 컨트롤러가 값을 보내면 여기서 화면을 갱신한다.
  const [attitude, setAttitude] = useState<TiltAttitude>({
    roll: 0,
    pitch: 0,
    yaw: 0,
    hasData: false,
    lastAt: 0,
  })

  // 매 프레임 바뀌는 값은 다시 그리지 않아도 되므로 ref 에 둔다.
  const posRef = useRef({ ...settings.startOffset })
  /**
   * 키보드로 만든 기울기(도). 센서가 없을 때 수평 맞추기를 연습할 수 있게 한다.
   * **저장되는 값에는 넣지 않는다.** 화면 표시와 수평 판정에만 쓴다.
   */
  const keyTiltRef = useRef({ roll: 0, pitch: 0 })
  const [keyTilt, setKeyTilt] = useState({ roll: 0, pitch: 0 })
  /** 노광·현상 연출 단계. 정렬을 확정한 뒤에만 진행한다. */
  const [exposureStage, setExposureStage] = useState<ExposureStage>(null)
  const stageHostRef = useRef<HTMLDivElement | null>(null)
  const samplesRef = useRef<Sample[]>([])
  const startedAtRef = useRef<string>(new Date().toISOString())
  const rafRef = useRef<number | null>(null)
  const channelRef = useRef<AlignmentChannel | null>(null)

  // 조작 계수는 과정 설정값(서버 응답)에서 읽는다. 화면에 숫자를 적어두지 않는다.
  const keyboard = useMemo(
    () => new KeyboardSource(course.control ? speedFromControl(course.control.keyboard) : {}),
    [course.control],
  )
  const tilt = useMemo(
    () => new TiltSource(course.control ? mappingFromControl(course.control) : {}),
    [course.control],
  )
  /** 컨트롤러 상태는 클래스 안에서 바뀌므로, 화면이 다시 그려지도록 상태로 복사해 둔다. */
  const [tiltState, setTiltState] = useState(() => ({
    status: tilt.status,
    available: tilt.available,
    zeroed: tilt.zeroed,
    reason: tilt.unavailableReason,
    error: tilt.lastError,
  }))

  const sensorMode = inputDevice === 'model_controller'
  // 수평(평행) 허용 범위. ⚠️ 서버 과정 설정에 아직 없어 상수를 쓴다(data/controllerSettings.ts).
  const levelTolerance = LEVEL_TOLERANCE_DEG
  const level = sensorMode
    ? tilt.isLevel(levelTolerance)
    : Math.abs(keyTilt.roll) <= levelTolerance && Math.abs(keyTilt.pitch) <= levelTolerance
  const ready = sensorMode ? tiltState.available : keyboard.available

  const within = isWithinTolerance(error.dx, error.dy, error.dTheta, settings)

  // 매 프레임 바뀌는 자세를 화면에는 초당 10회만 반영한다(읽기에 충분하다).
  useEffect(() => {
    if (!sensorMode) return
    const sync = () =>
      setTiltState({
        status: tilt.status,
        available: tilt.available,
        zeroed: tilt.zeroed,
        reason: tilt.unavailableReason,
        error: tilt.lastError,
      })
    const unsubscribe = tilt.subscribe(sync)
    sync()
    const timer = window.setInterval(() => setAttitude(tilt.attitude()), 100)
    return () => {
      unsubscribe()
      window.clearInterval(timer)
    }
  }, [sensorMode, tilt])

  // 개발 확인용 — 센서가 없을 때 콘솔에서 자세를 밀어 넣어 화면 동작을 본다.
  // 실제 화면 어디에서도 쓰지 않고, 개발 서버에서만 붙는다.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    ;(window as unknown as { __wmeTilt?: TiltSourceType }).__wmeTilt = tilt
  }, [tilt])

  /**
   * 3D 뷰가 매 프레임 직접 읽는 자세.
   * 리액트 상태(`error`)는 채널 응답을 기다리므로, 즉시 반응이 필요한 3D 는 로컬 위치를 본다.
   */
  function readPose(): StagePose {
    const p = posRef.current
    const a = sensorMode ? tilt.attitude() : null
    const roll = sensorMode ? (a?.hasData ? a.roll : 0) : keyTiltRef.current.roll
    const pitch = sensorMode ? (a?.hasData ? a.pitch : 0) : keyTiltRef.current.pitch
    return {
      x: p.x,
      y: p.y,
      theta: p.theta,
      roll,
      pitch,
      level: Math.abs(roll) <= levelTolerance && Math.abs(pitch) <= levelTolerance,
    }
  }

  /** 3D 장비 뷰에 연출 재생/해제를 요청한다. */
  function sendToStage(eventName: string, detail?: unknown) {
    stageHostRef.current
      ?.querySelector('[aria-label^="교육용 장비 3D"]')
      ?.dispatchEvent(new CustomEvent(eventName, { detail }))
  }

  /** 회전 미세조정 버튼 — 센서 yaw 의 드리프트가 확인되기 전까지 남겨 두는 백업 입력이다. */
  function nudgeTheta(delta: number) {
    if (phase !== 'aligning') return
    posRef.current.theta = Math.max(-45, Math.min(45, posRef.current.theta + delta))
  }

  function reset() {
    sendToStage(CLEAR_EXPOSURE_EVENT)
    setExposureStage(null)
    channelRef.current?.close()
    channelRef.current = null
    posRef.current = { ...settings.startOffset }
    keyTiltRef.current = { roll: 0, pitch: 0 }
    setKeyTilt({ roll: 0, pitch: 0 })
    samplesRef.current = []
    setAttemptId(null)
    setChannelKind(null)
    setError({ dx: settings.startOffset.x, dy: settings.startOffset.y, dTheta: settings.startOffset.theta })
    setTrail([])
    setElapsedMs(0)
    setPhase('ready')
    setOrderOptionId('')
    setReason('')
    setFormError(null)
  }

  /**
   * 정렬 시작.
   * server 모드: 먼저 서버에 시도를 만들고 그 id 로 WebSocket 을 연다.
   * mock 모드: 서버가 없으므로 기록은 브라우저가 모았다가 제출할 때 한 번에 저장한다.
   *            (여기서 만들면 제출 때 또 만들어져 빈 기록이 하나 더 남는다)
   */
  async function start() {
    if (!ready) return
    setFormError(null)
    if (API_MODE === 'mock') {
      startedAtRef.current = new Date().toISOString()
      setAttemptId(`mock:${course.id}`)
      setPhase('aligning')
      return
    }
    setPhase('starting')
    try {
      const created = await createAttempt({
        userId: userId,
        courseId: course.id,
        inputDevice,
        startedAt: new Date().toISOString(),
      })
      setAttemptId(created.id)
      startedAtRef.current = created.startedAt
      setPhase('aligning')
    } catch (e: unknown) {
      setPhase('ready')
      setFormError(e instanceof Error ? e.message : '실습을 시작하지 못했습니다.')
    }
  }

  // 실습 루프 — 컨트롤러 속도를 시간만큼 곱해 위치에 더하고, 표본을 채널로 보낸다.
  useEffect(() => {
    if (phase !== 'aligning' || !attemptId) return

    // X/Y 는 어느 모드에서도 키보드가 담당한다.
    keyboard.start()
    // mock 채널은 onReady 를 즉시 부르므로, 여기서 channel 변수를 참조하면 안 된다
    // (아직 만들어지기 전이다). 연결 종류는 채널을 만든 뒤에 따로 표시한다.
    const channel = openAlignmentChannel(attemptId, {
      // 오차는 서버(또는 mock 계산)가 돌려준 값을 그대로 표시한다.
      onState: (s) => {
        setError({ dx: s.dx, dy: s.dy, dTheta: s.dTheta })
        samplesRef.current.push({
          tMs: s.tMs,
          roll: 0,
          pitch: 0,
          waferX: s.dx,
          waferY: s.dy,
          waferTheta: s.dTheta,
          dx: s.dx,
          dy: s.dy,
          dTheta: s.dTheta,
        })
        // 그림은 솎아서 그린다. 기록(samplesRef)은 원본 그대로 둔다.
        if (samplesRef.current.length % 5 === 0) setTrail(thinForDraw(samplesRef.current))
      },
      onError: (message) => setFormError(message),
    })
    channelRef.current = channel
    setChannelKind(channel.kind)

    const startTime = performance.now()
    let prev = startTime
    let lastSend = -Infinity
    samplesRef.current = []

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now
      // 키보드 기울기(센서가 없을 때). 누르고 있는 동안 점점 기울고 놓으면 그대로 남는다.
      if (!sensorMode) {
        const kt = keyboard.readTilt()
        if (kt.vRoll !== 0 || kt.vPitch !== 0) {
          const next = keyTiltRef.current
          next.roll = Math.max(-25, Math.min(25, next.roll + kt.vRoll * dt))
          next.pitch = Math.max(-25, Math.min(25, next.pitch + kt.vPitch * dt))
        }
      }

      // 수평이 확보된 동안에만 회전 입력이 반영된다. 센서·키보드 모두 같은 규칙이다.
      const levelNow = sensorMode
        ? tilt.isLevel(levelTolerance)
        : Math.abs(keyTiltRef.current.roll) <= levelTolerance &&
          Math.abs(keyTiltRef.current.pitch) <= levelTolerance
      const k = keyboard.read()
      const t = sensorMode && levelNow ? tilt.read() : ZERO_VELOCITY
      const v = {
        vx: k.vx,
        vy: k.vy,
        vTheta: (levelNow ? k.vTheta : 0) + t.vTheta,
      }
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
      if (tMs - lastSend >= SEND_EVERY_MS) {
        lastSend = tMs
        // 고정 마크가 원점이므로 움직이는 마크의 위치를 그대로 보낸다.
        channel.send({
          tMs: Math.round(tMs),
          roll: 0,
          pitch: 0,
          waferX: Math.round(p.x * 100) / 100,
          waferY: Math.round(p.y * 100) / 100,
          waferTheta: Math.round(p.theta * 100) / 100,
        })
      }

      setElapsedMs(Math.round(tMs))
      if (!sensorMode && Math.round(tMs / 100) !== Math.round((tMs - 16) / 100)) {
        setKeyTilt({ ...keyTiltRef.current })
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      keyboard.stop()
      channel.close()
    }
  }, [phase, attemptId, keyboard, tilt, sensorMode, levelTolerance, settings.fieldRadius])

  /** 정렬 확정 — 서버가 summary 와 보정 구간을 계산한다. */
  async function confirmAlignment() {
    if (samplesRef.current.length < 2) {
      setFormError('아직 조작 기록이 없습니다. 마크를 움직인 뒤 확정해 주세요.')
      return
    }
    if (!attemptId) return
    setFormError(null)
    const last = samplesRef.current.at(-1)!
    channelRef.current?.close()
    try {
      await markPhase(attemptId, 'confirmed', last.tMs)
      setPhase('confirmed')
      // 확정한 정렬 상태 그대로 노광·현상을 보여 준다. 기록·채점과는 무관한 표시다.
      sendToStage(PLAY_EXPOSURE_EVENT, { dx: last.dx, dy: last.dy, dTheta: last.dTheta })
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : '정렬을 확정하지 못했습니다.')
    }
  }

  async function submit() {
    if (!attemptId) return
    if (!orderOptionId) {
      setFormError('어떤 순서로 조정했는지 골라 주세요.')
      return
    }
    if (reason.trim().length < 5) {
      setFormError('그 순서로 조정한 이유를 한 문장이라도 적어 주세요.')
      return
    }
    setSubmitting(true)
    setFormError(null)

    try {
      // mock 모드는 서버가 없으므로 기록을 함께 넘겨 저장한다.
      if (API_MODE === 'mock') {
        const samples = samplesRef.current
        const last = samples.at(-1)!
        const events = detectOvershoots(samples, settings)
        const created = await createAttempt({
          userId: userId,
          courseId: course.id,
          inputDevice,
          startedAt: startedAtRef.current,
          samples,
          events,
          phaseMarkers: [
            { phase: 'aligning', tMs: 0 },
            { phase: 'confirmed', tMs: last.tMs },
          ],
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
        await submitAnswer(created.id, { orderOptionId, reason: reason.trim() })
        navigate(`/attempts/${created.id}/result`)
        return
      }

      await submitAnswer(attemptId, { orderOptionId, reason: reason.trim() })
      navigate(`/attempts/${attemptId}/result`)
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
        title="정렬 실습"
        description="두 마크를 허용 오차 안으로 겹친 뒤, 어떤 순서로 조정했는지와 이유를 적어 제출합니다."
        actions={<InputDeviceBadge value={inputDevice} />}
      />

      <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="장비 뷰"
              subtitle="스테이지 위의 기판과 그 위에 떠 있는 마스크 판입니다"
              aside={
                level ? <Badge tone="ok">평행 확보</Badge> : <Badge tone="muted">기울어짐</Badge>
              }
            />
            <div ref={stageHostRef}>
            <AlignmentStage3D
              readPose={readPose}
              fieldRadius={settings.fieldRadius}
              onExposureStage={setExposureStage}
              fallback={
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
              }
            />
            </div>
            {exposureStage && (
              <div className="mt-3 rounded-lg bg-slate-50 px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-semibold text-slate-800">
                    {EXPOSURE_TEXT[exposureStage].title}
                  </span>
                  {exposureStage === 'result' && (
                    within ? <Badge tone="ok">패턴이 기준 안</Badge> : <Badge tone="warn">패턴이 어긋남</Badge>
                  )}
                </div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600">
                  {exposureStage === 'result'
                    ? within
                      ? EXPOSURE_TEXT.result.okBody
                      : EXPOSURE_TEXT.result.offBody
                    : EXPOSURE_TEXT[exposureStage].body}
                </p>
              </div>
            )}
            <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-400">
              교육용 장비를 단순화해 그린 그림입니다. 실제 장비의 구조나 치수를 나타내지 않습니다.
              {sensorMode ? ` ${settings.controllerNotice}` : ''}
            </p>
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
                <div className="mt-1 text-right text-[11px] text-slate-400">
                  {reason.trim().length}자
                </div>
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
                  disabled={submitting}
                  className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:bg-slate-300"
                >
                  {submitting ? '제출 중…' : '제출하고 결과 보기'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sendToStage(CLEAR_EXPOSURE_EVENT)
                    setExposureStage(null)
                    setPhase('aligning')
                  }}
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
            <CardHeader
              title="현미경 뷰"
              subtitle="마크가 겹치는 정도를 여기서 읽습니다"
              aside={within ? <Badge tone="ok">허용 오차 안</Badge> : <Badge tone="muted">조정 중</Badge>}
            />
            <div className="mx-auto max-w-[240px]">
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
              <Row label="위치 오차" value={`${positionError(error.dx, error.dy).toFixed(1)}px`} />
              <Row
                label="계산 위치"
                value={
                  channelKind === 'websocket'
                    ? '실습 서버'
                    : channelKind === 'local'
                      ? '브라우저(서버 미연결)'
                      : '대기'
                }
              />
            </dl>
            <p className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] leading-relaxed text-slate-400">
              허용 오차는 교육 과정 설정값입니다. 실제 장비의 정렬 정밀도가 아닙니다.
            </p>
          </Card>

          <Card>
            <CardHeader title="진행" />
            {(phase === 'ready' || phase === 'starting') && (
              <>
                <button
                  type="button"
                  onClick={start}
                  disabled={!ready || phase === 'starting'}
                  className="w-full rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {phase === 'starting' ? '실습을 준비하는 중…' : '정렬 시작'}
                </button>
                {!ready && sensorMode && (
                  <p className="mt-2 text-[11.5px] leading-relaxed text-slate-500">
                    모형 컨트롤러를 연결하거나 입력 출처를 키보드로 바꾸면 시작할 수 있습니다.
                  </p>
                )}
                {formError && (
                  <p className="mt-2 rounded-lg bg-alert-50 px-3 py-2 text-xs font-medium text-alert-500">
                    {formError}
                  </p>
                )}
              </>
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
                정렬을 확정했습니다. 왼쪽 폼에 조정 순서와 이유를 적어 제출하면 이 연습이 새 기록으로
                남습니다. 이전 기록은 지워지지 않습니다.
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
            {!sensorMode && (
              <>
                <dl className="mt-2 space-y-2 border-t border-slate-100 pt-2 text-[12.5px]">
                  {settings.tiltControls.map((c) => (
                    <div key={c.keys} className="flex items-center justify-between gap-3">
                      <dt className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-600">
                        {c.keys}
                      </dt>
                      <dd className="text-slate-600">{c.effect}</dd>
                    </div>
                  ))}
                </dl>
                <div
                  className={`mt-2.5 rounded-lg px-3 py-2.5 ${
                    level ? 'bg-ok-50/60 ring-1 ring-inset ring-ok-500/25' : 'bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11.5px] font-medium text-slate-700">
                      기울기 좌우 {keyTilt.roll >= 0 ? '+' : ''}
                      {keyTilt.roll.toFixed(1)}° · 앞뒤 {keyTilt.pitch >= 0 ? '+' : ''}
                      {keyTilt.pitch.toFixed(1)}°
                    </span>
                    {level ? <Badge tone="ok">평행 확보</Badge> : <Badge tone="muted">기울어짐</Badge>}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    {level ? CONTROLLER_TEXT.rotateReady : CONTROLLER_TEXT.rotateLocked}
                  </p>
                  {(keyTilt.roll !== 0 || keyTilt.pitch !== 0) && (
                    <button
                      type="button"
                      onClick={() => {
                        keyTiltRef.current = { roll: 0, pitch: 0 }
                        setKeyTilt({ roll: 0, pitch: 0 })
                      }}
                      className="mt-2 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      {CONTROLLER_TEXT.levelReset}
                    </button>
                  )}
                  <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate-400">
                    {CONTROLLER_TEXT.keyboardTiltHint}
                  </p>
                </div>
              </>
            )}
            {sensorMode && (
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] leading-relaxed text-slate-500">
                센서 모드에서는 위치(X·Y)를 방향키로 맞추고, 회전(θ)은 모형을 비틀어 맞춥니다.
                회전은 수평이 확보된 동안에만 반영됩니다.
              </p>
            )}
            {phase === 'aligning' && (
              <p className="mt-3 rounded-lg bg-brand-50/70 px-3 py-2 text-[11.5px] text-brand-700">
                이 화면을 클릭한 상태에서 키를 누르세요.
              </p>
            )}
          </Card>

          {sensorMode && (
            <Card>
              <CardHeader
                title="모형 컨트롤러"
                subtitle="USB 로 연결한 센서 값을 브라우저가 직접 읽습니다"
                aside={
                  tiltState.available ? (
                    <Badge tone="ok">연결됨</Badge>
                  ) : tiltState.status === 'connecting' ? (
                    <Badge tone="brand">연결 중</Badge>
                  ) : tiltState.status === 'error' ? (
                    <Badge tone="alert">연결 문제</Badge>
                  ) : (
                    <Badge tone="muted">연결 안 됨</Badge>
                  )
                }
              />

              {!tiltState.available ? (
                <>
                  <p className="mb-3 text-[12px] leading-relaxed text-slate-500">
                    {tiltState.reason}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void tilt.connect()}
                      disabled={tiltState.status === 'unsupported' || tiltState.status === 'connecting'}
                      className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400"
                    >
                      {tiltState.status === 'connecting' ? '연결 중…' : '모형 컨트롤러 연결'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputDevice('keyboard')}
                      className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      키보드로 진행
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <ControllerPanel
                    attitude={attitude}
                    level={level}
                    toleranceDeg={levelTolerance}
                  />

                  <div className="mt-3 rounded-lg bg-slate-50 px-3.5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold text-slate-700">
                        {CONTROLLER_TEXT.levelStepTitle}
                      </span>
                      <span className="text-[11px] font-medium text-slate-500">
                        영점 {tiltState.zeroed ? '잡음' : '안 잡음'}
                      </span>
                    </div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">
                      {level ? '평행이 확보되었습니다.' : CONTROLLER_TEXT.levelHint}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                      {CONTROLLER_TEXT.zeroHint}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={tilt.setZero}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
                      >
                        영점 잡기
                      </button>
                      {tiltState.zeroed && (
                        <button
                          type="button"
                          onClick={tilt.clearZero}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                        >
                          영점 지우기
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void tilt.disconnect()}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
                      >
                        연결 끊기
                      </button>
                    </div>
                  </div>

                  <div
                    className={`mt-2 rounded-lg px-3.5 py-3 ${
                      level ? 'bg-ok-50/60 ring-1 ring-inset ring-ok-500/25' : 'bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold text-slate-700">
                        {CONTROLLER_TEXT.rotateStepTitle}
                      </span>
                      {level ? (
                        <Badge tone="ok">회전 입력 가능</Badge>
                      ) : (
                        <Badge tone="muted">잠김</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">
                      {level ? CONTROLLER_TEXT.rotateReady : CONTROLLER_TEXT.rotateLocked}
                    </p>
                    <div className="mt-2.5 flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">회전 미세조정</span>
                      <button
                        type="button"
                        onClick={() => nudgeTheta(-0.5)}
                        disabled={phase !== 'aligning'}
                        className="rounded-md border border-slate-200 bg-white px-2.5 py-1 font-mono text-[12px] text-slate-600 transition hover:bg-slate-50 disabled:text-slate-300"
                      >
                        −0.5°
                      </button>
                      <button
                        type="button"
                        onClick={() => nudgeTheta(0.5)}
                        disabled={phase !== 'aligning'}
                        className="rounded-md border border-slate-200 bg-white px-2.5 py-1 font-mono text-[12px] text-slate-600 transition hover:bg-slate-50 disabled:text-slate-300"
                      >
                        +0.5°
                      </button>
                    </div>
                  </div>

                  {tiltState.status === 'error' && tiltState.error && (
                    <p className="mt-2 rounded-lg bg-alert-50 px-3 py-2 text-[11.5px] leading-relaxed text-alert-500">
                      {tiltState.error}
                    </p>
                  )}
                </>
              )}
            </Card>
          )}

          <Card>
            <CardHeader title="입력 출처" subtitle="무엇으로 조작하는지 항상 표시합니다" />
            <div className="space-y-2">
              {[
                { kind: 'keyboard' as const, src: keyboard, label: '키보드 조작' },
                { kind: 'model_controller' as const, src: tilt, label: '모형 컨트롤러' },
              ].map(({ kind, src, label }) => (
                <button
                  key={kind}
                  type="button"
                  disabled={
                    phase !== 'ready' ||
                    (kind === 'model_controller' && tiltState.status === 'unsupported')
                  }
                  onClick={() => setInputDevice(kind)}
                  className={`w-full rounded-lg border px-3.5 py-2.5 text-left transition disabled:cursor-not-allowed ${
                    inputDevice === kind
                      ? 'border-brand-300 bg-brand-50/60'
                      : 'border-slate-200 disabled:bg-slate-50/60'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-slate-800">{label}</span>
                    {src.available ? (
                      <Badge tone={inputDevice === kind ? 'brand' : 'muted'}>
                        {inputDevice === kind ? '사용 중' : '사용 가능'}
                      </Badge>
                    ) : kind === 'model_controller' && tiltState.status === 'connecting' ? (
                      <Badge tone="brand">연결 중</Badge>
                    ) : kind === 'model_controller' && tiltState.status === 'unsupported' ? (
                      <Badge tone="muted">브라우저 미지원</Badge>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-medium tabular-nums text-slate-700">{value}</dd>
    </div>
  )
}
