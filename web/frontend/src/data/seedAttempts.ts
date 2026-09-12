import type { AlignmentEvent, AlignmentSummary, Attempt, Feedback, Sample } from '@/types'
import { learnerSeeds } from './people'
import { getCourse, IMPLEMENTED_COURSE_ID } from './courses'

/** 데모 기준 시각. 고정해야 새로고침해도 그래프가 흔들리지 않는다. */
export const DEMO_NOW = new Date('2026-09-12T14:00:00+09:00')

function daysBefore(days: number, hour = 10): string {
  const d = new Date(DEMO_NOW)
  d.setDate(d.getDate() - days)
  d.setHours(hour, 20, 0, 0)
  return d.toISOString()
}

const ORDER_BY_LEVEL = ['xy-then-theta', 'theta-then-xy', 'interleaved', 'other']

const REASONS = [
  '먼저 위치를 겹쳐 두면 회전만 남아서 어긋난 양을 읽기 쉬웠습니다. 그래서 X·Y 를 먼저 맞췄습니다.',
  '각도가 기울어 있으면 위치를 맞춰도 다시 어긋나 보여서, 회전을 먼저 세운 다음 위치를 정리했습니다.',
  '한 번에 크게 움직이면 목표를 지나쳤기 때문에 두 축을 번갈아 조금씩 줄였습니다.',
  '남은 오차가 큰 축을 먼저 줄이는 방식으로 진행했고, 마지막에 회전을 다듬었습니다.',
]

/** 이 과정의 허용 오차. 과정 설정값이며 실제 장비 정밀도가 아니다. */
const TOL = getCourse(IMPLEMENTED_COURSE_ID)!.alignment!

/**
 * 시연용 보정 궤적을 만든다. 오차가 줄어드는 모양을 합성한 기록이며 실측이 아니다.
 * overshoot 가 있으면 중간에 목표를 지나쳤다가 되돌아오는 구간을 넣는다.
 */
function synthTrajectory(
  seedNo: number,
  durationMs: number,
  overshoots: number,
  converged: boolean,
): { samples: Sample[]; events: AlignmentEvent[]; final: { dx: number; dy: number; dTheta: number } } {
  const start = TOL.startOffset
  const steps = 36
  const samples: Sample[] = []
  const events: AlignmentEvent[] = []
  // 시드 번호로 모양을 조금씩 다르게 하되 매번 같은 값이 나오게 한다(난수 미사용).
  const wobble = ((seedNo % 3) - 1) * 0.35
  const endScale = converged ? 0.035 : 0.22

  for (let i = 0; i <= steps; i++) {
    const p = i / steps
    // 지수적으로 줄어드는 기본 수렴 곡선
    let decay = (1 - p) ** 1.7 * (1 - endScale) + endScale
    // 과잉 보정 구간: 목표를 지나쳐 부호가 반대로 넘어간다
    for (let k = 0; k < overshoots; k++) {
      const center = 0.45 + k * 0.18
      if (Math.abs(p - center) < 0.06) decay = -0.12 - k * 0.03
    }
    const dx = Math.round(start.x * decay * 10) / 10
    const dy = Math.round(start.y * decay * (1 + wobble * 0.1) * 10) / 10
    const dTheta = Math.round(start.theta * decay * 10) / 10
    samples.push({
      tMs: Math.round((durationMs / steps) * i),
      roll: 0,
      pitch: 0,
      waferX: -dx,
      waferY: -dy,
      waferTheta: -dTheta,
      dx,
      dy,
      dTheta,
    })
  }

  for (let k = 0; k < overshoots; k++) {
    const center = 0.45 + k * 0.18
    events.push({
      id: `ev-seed-${seedNo}-os-${k + 1}`,
      attemptId: '',
      startMs: Math.round(durationMs * (center - 0.06)),
      endMs: Math.round(durationMs * (center + 0.06)),
      type: 'overshoot',
      axis: k % 2 === 0 ? 'xy' : 'theta',
      metrics: { errorBefore: 0, errorAfter: 0 },
    })
  }

  const last = samples.at(-1)!
  return { samples, events, final: { dx: last.dx, dy: last.dy, dTheta: last.dTheta } }
}

function sampleFeedback(rubric: number[], seedIndex: number, summary: AlignmentSummary): Feedback {
  const total = rubric.reduce((a, b) => a + b, 0)
  return {
    generatedBy: 'mock',
    good:
      total >= 6
        ? [
            '허용 오차 안으로 수렴시켰고, 어떤 순서로 조정했는지 설명이 기록과 맞습니다.',
            '큰 오차를 먼저 줄이고 마지막에 회전을 다듬은 순서가 일관됩니다.',
          ]
        : ['어긋난 방향을 읽고 같은 축을 이어서 조정한 점은 적절합니다.'],
    improve:
      total >= 6
        ? ['남은 오차를 숫자로 함께 적으면 다음 연습과 비교하기 쉽습니다.']
        : [
            `목표를 지나친 구간이 ${summary.overshootCount}회 있습니다. 한 번에 움직이는 양을 줄여 보세요.`,
            '조정 순서를 고른 이유가 실제 조작 기록과 연결되지 않았습니다.',
          ],
    eventIds: [`ev-seed-${seedIndex}-os-1`],
    nextStep:
      total >= 6
        ? '같은 조건에서 한 번 더 연습해 소요 시간과 보정 횟수가 줄어드는지 확인해 보세요.'
        : '마크 읽기 단계로 돌아가 허용 오차 기준과 마크 모양을 다시 확인해 보세요.',
    cannotJudge: [
      '이 연습 기록으로는 실제 장비의 정렬 정밀도나 공정 결과를 판단할 수 없습니다.',
      '허용 오차는 교육 과정 설정값입니다.',
    ],
    generatedAt: daysBefore(1, 11),
  }
}

/** 시드 프로필을 실제 attempt 레코드로 펼친다. 집계는 전부 이 레코드에서 계산한다. */
export const seedAttempts: Attempt[] = learnerSeeds.flatMap((s) =>
  s.attempts.map((a, i): Attempt => {
    const submitted = a.rubric !== null
    const level = a.rubric ? a.rubric.reduce<number>((x, y) => x + y, 0) : 0
    // 시도가 쌓일수록 덜 헤매는 모양이 되도록 시드 값에서 유도한다.
    const overshoots = Math.max(0, 3 - i - (level >= 6 ? 1 : 0))
    const converged = submitted && level >= 4
    const durationMs = Math.min(a.durationSec, 180) * 1000
    const seedNo = i + s.id.length
    const traj = synthTrajectory(seedNo, durationMs, overshoots, converged)
    const attemptId = `a-${s.id}-${i + 1}`

    const summary: AlignmentSummary = {
      finalDx: traj.final.dx,
      finalDy: traj.final.dy,
      finalDTheta: traj.final.dTheta,
      durationMs,
      adjustmentCount: 14 + overshoots * 4 - i * 2,
      overshootCount: overshoots,
      converged,
    }

    return {
      id: attemptId,
      enrollmentId: `e-${s.id}-stage`,
      userId: s.id,
      courseId: IMPLEMENTED_COURSE_ID,
      attemptNo: i + 1,
      source: 'mock',
      inputSource: 'keyboard',
      status: submitted ? 'feedback_ready' : 'aligned',
      startedAt: daysBefore(a.daysAgo),
      endedAt: daysBefore(a.daysAgo, 11),
      phaseMarkers: [
        { phase: 'aligning', tMs: 0 },
        { phase: 'confirmed', tMs: durationMs },
      ],
      samples: traj.samples,
      events: traj.events.map((e) => ({ ...e, attemptId })),
      summary,
      answer: submitted
        ? {
            orderOptionId: ORDER_BY_LEVEL[i % ORDER_BY_LEVEL.length]!,
            reason: REASONS[(i + s.id.length) % REASONS.length]!,
            submittedAt: daysBefore(a.daysAgo, 11),
          }
        : null,
      feedback: submitted ? sampleFeedback(a.rubric!, seedNo, summary) : null,
      feedbackViewedAt: submitted ? daysBefore(a.daysAgo, 12) : null,
      rubricScores: a.rubric,
      durationSec: a.durationSec,
      courseVersion: getCourse(IMPLEMENTED_COURSE_ID)!.version,
      modelVersion: 'rule-align-0.1',
      settingsVersion: 'settings-0.2',
    }
  }),
)
