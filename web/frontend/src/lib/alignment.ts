import type { AlignmentEvent, AlignmentSettings, Sample } from '@/types'

/** 위치 오차의 크기(px). dx, dy 를 하나의 값으로 본다. */
export function positionError(dx: number, dy: number): number {
  return Math.hypot(dx, dy)
}

/** 허용 오차 안에 들어왔는지. 허용 오차는 과정 설정값이다. */
export function isWithinTolerance(
  dx: number,
  dy: number,
  dTheta: number,
  settings: AlignmentSettings,
): boolean {
  return positionError(dx, dy) <= settings.tolerancePx && Math.abs(dTheta) <= settings.toleranceDeg
}

/** 화면 px 을 교육용 환산값으로 표기한다. 실제 장비 정밀도가 아니다. */
export function toMicrometer(px: number, settings: AlignmentSettings): number {
  return Math.round(px * settings.umPerPx)
}

/**
 * 보정 궤적에서 과잉 보정 구간을 찾는다. 규칙 기반이며 학습 모델이 아니다.
 *
 * 과잉 보정 = 남은 오차가 줄어들다가 **부호가 반대로 넘어간** 것.
 * 즉 목표를 지나쳤다가 되돌아온 경우다.
 */
export function detectOvershoots(samples: Sample[], settings: AlignmentSettings): AlignmentEvent[] {
  const events: AlignmentEvent[] = []
  const axes: { axis: 'xy' | 'theta'; pick: (s: Sample) => number; tol: number }[] = [
    { axis: 'xy', pick: (s) => s.dx, tol: settings.tolerancePx },
    { axis: 'xy', pick: (s) => s.dy, tol: settings.tolerancePx },
    { axis: 'theta', pick: (s) => s.dTheta, tol: settings.toleranceDeg },
  ]

  for (const { axis, pick, tol } of axes) {
    for (let i = 1; i < samples.length; i++) {
      const before = pick(samples[i - 1]!)
      const after = pick(samples[i]!)
      // 부호가 바뀌고, 넘어간 양이 허용 오차보다 클 때만 과잉 보정으로 본다.
      const crossed = before * after < 0
      if (crossed && Math.abs(after) > tol) {
        events.push({
          id: `ev-os-${axis}-${samples[i]!.tMs}`,
          attemptId: '',
          startMs: samples[i - 1]!.tMs,
          endMs: samples[i]!.tMs,
          type: 'overshoot',
          axis,
          metrics: { errorBefore: Math.abs(before), errorAfter: Math.abs(after) },
        })
      }
    }
  }

  return events.sort((a, b) => a.startMs - b.startMs)
}

/**
 * 두 축(위치·회전)을 한 번에 섞어 움직였는지, 나눠서 움직였는지 본다.
 * 1에 가까울수록 한 축씩 정리한 것이다. 좋고 나쁨을 단정하지 않고 근거로만 쓴다.
 */
export function axisSeparation(samples: Sample[]): number {
  let moving = 0
  let single = 0
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]!
    const b = samples[i]!
    const movedXY = Math.hypot(b.dx - a.dx, b.dy - a.dy) > 0.4
    const movedTheta = Math.abs(b.dTheta - a.dTheta) > 0.05
    if (!movedXY && !movedTheta) continue
    moving++
    if (movedXY !== movedTheta) single++
  }
  if (moving === 0) return 0
  return single / moving
}

/** 기록에서 실제로 어떤 축을 먼저 정리했는지 읽는다. 자기 보고와 비교하는 데 쓴다. */
export function observedOrder(
  samples: Sample[],
  settings: AlignmentSettings,
): 'xy-then-theta' | 'theta-then-xy' | 'interleaved' | 'unknown' {
  const xyDone = samples.findIndex((s) => positionError(s.dx, s.dy) <= settings.tolerancePx)
  const thetaDone = samples.findIndex((s) => Math.abs(s.dTheta) <= settings.toleranceDeg)
  if (xyDone < 0 || thetaDone < 0) return 'unknown'
  const gap = Math.abs(xyDone - thetaDone) / Math.max(1, samples.length)
  if (gap < 0.12) return 'interleaved'
  return xyDone < thetaDone ? 'xy-then-theta' : 'theta-then-xy'
}

/** 보정 동작 횟수 — 움직임이 멈췄다가 다시 시작한 횟수로 센다. */
export function countAdjustments(samples: Sample[]): number {
  let count = 0
  let moving = false
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]!
    const b = samples[i]!
    const isMoving =
      Math.hypot(b.dx - a.dx, b.dy - a.dy) > 0.4 || Math.abs(b.dTheta - a.dTheta) > 0.05
    if (isMoving && !moving) count++
    moving = isMoving
  }
  return count
}

/**
 * 그림에 쓸 만큼만 남기고 솎아낸다. 기록 자체는 줄이지 않는다(저장·분석은 원본으로 한다).
 * 점이 수천 개가 되면 매번 다시 그리는 비용이 커진다.
 */
export function thinForDraw<T>(list: T[], max = 300): T[] {
  if (list.length <= max) return list
  const step = list.length / max
  const out = Array.from({ length: max }, (_, i) => list[Math.floor(i * step)]!)
  // 마지막 점(현재 위치)은 반드시 남긴다.
  out[out.length - 1] = list[list.length - 1]!
  return out
}
