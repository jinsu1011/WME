import type {
  AlignmentSummary,
  Answer,
  Attempt,
  Course,
  Feedback,
  JudgmentSummary,
  RubricLevel,
} from '@/types'
import { isAlignmentSummary } from '@/types'
import { axisSeparation, isWithinTolerance, observedOrder, positionError } from './alignment'

/**
 * 규칙 기반 임시 채점 + 샘플 피드백. **AI 미연결 상태에서만 쓴다.**
 * LLM 이 붙으면 BACK 세션이 서버에서 채점하고, 화면은 그 값을 받기만 한다.
 *
 * 채점 규칙을 화면에서도 그대로 보여줄 수 있게 이유 문장을 함께 반환한다.
 */
export interface ScoreResult {
  levels: RubricLevel[]
  reasons: string[]
  feedback: Feedback
}

const ORDER_LABEL: Record<string, string> = {
  'xy-then-theta': '위치를 먼저, 회전을 나중에',
  'theta-then-xy': '회전을 먼저, 위치를 나중에',
  interleaved: '두 축을 번갈아',
  unknown: '판단할 수 없음',
}

export function scoreAlignment(course: Course, attempt: Attempt, answer: Answer): ScoreResult {
  const settings = course.alignment
  // 정렬 실습 채점기다. 다른 유형의 요약이 들어오면 채점하지 않는다.
  const summary = isAlignmentSummary(attempt.summary) ? attempt.summary : null
  const levels: RubricLevel[] = [0, 0, 0, 0]
  const reasons: string[] = []

  if (!settings || !summary) {
    return {
      levels,
      reasons: ['채점에 필요한 기록이 없습니다.'],
      feedback: emptyFeedback(),
    }
  }

  // 1. 정렬 정확도 — 최종 오차가 과정 설정 허용 범위 안인지
  const within = isWithinTolerance(summary.finalDx, summary.finalDy, summary.finalDTheta, settings)
  const posErr = positionError(summary.finalDx, summary.finalDy)
  if (within) {
    levels[0] = 2
    reasons.push(`최종 오차가 허용 범위(±${settings.tolerancePx}px, ±${settings.toleranceDeg}°) 안입니다.`)
  } else if (posErr <= settings.tolerancePx * 2.5 && Math.abs(summary.finalDTheta) <= settings.toleranceDeg * 2.5) {
    levels[0] = 1
    reasons.push('허용 범위를 조금 벗어났습니다. 위치 오차가 큰 축을 한 번 더 줄여 보세요.')
  } else {
    reasons.push('허용 범위 밖에서 확정했습니다. 남은 오차가 어느 축에 있는지 먼저 읽어 보세요.')
  }

  // 2. 조정 순서 — 자기 보고가 아니라 기록에서 축을 나눠 움직였는지 본다
  const separation = axisSeparation(attempt.samples)
  if (separation >= 0.7) {
    levels[1] = 2
    reasons.push('한 축씩 나눠 정리한 기록입니다.')
  } else if (separation >= 0.4) {
    levels[1] = 1
    reasons.push('두 축을 섞어 움직인 구간이 있습니다.')
  } else {
    reasons.push('위치와 회전을 동시에 움직인 구간이 많아 어느 조정이 효과를 냈는지 읽기 어렵습니다.')
  }

  // 3. 보정 효율 — 과잉 보정 횟수
  if (summary.overshootCount === 0) {
    levels[2] = 2
    reasons.push('목표를 지나친 구간 없이 수렴했습니다.')
  } else if (summary.overshootCount <= 2) {
    levels[2] = 1
    reasons.push(`목표를 지나친 구간이 ${summary.overshootCount}회 있습니다.`)
  } else {
    reasons.push(`목표를 지나친 구간이 ${summary.overshootCount}회로 많습니다.`)
  }

  // 4. 설명·기록 — 이 항목이 있어야 손재주 평가가 아니라 교육이 된다
  const text = answer.reason.trim()
  if (text.length >= 40) {
    levels[3] = 2
    reasons.push('조정 순서를 고른 이유를 문장으로 남겼습니다.')
  } else if (text.length >= 15) {
    levels[3] = 1
    reasons.push('이유가 짧습니다. 무엇을 보고 그렇게 판단했는지 한 문장 더 적어 보세요.')
  } else {
    reasons.push('조정 이유가 거의 적히지 않았습니다. 결과만으로는 판단 과정을 확인할 수 없습니다.')
  }

  const observed = observedOrder(attempt.samples, settings)
  const reportMatchesRecord = observed === 'unknown' || observed === answer.orderOptionId

  return {
    levels,
    reasons,
    feedback: buildFeedback({
      levels,
      within,
      summary,
      settings,
      observed,
      reported: answer.orderOptionId ?? '',
      reportMatchesRecord,
      events: attempt.events.filter((e) => e.type === 'overshoot').map((e) => e.id),
    }),
  }
}

function buildFeedback(input: {
  levels: RubricLevel[]
  within: boolean
  summary: AlignmentSummary
  settings: NonNullable<Course['alignment']>
  observed: string
  reported: string
  reportMatchesRecord: boolean
  events: string[]
}): Feedback {
  const { levels, within, summary, settings, observed, reported, reportMatchesRecord } = input
  const good: string[] = []
  const improve: string[] = []

  if (within) {
    good.push(
      `최종 오차 ${positionError(summary.finalDx, summary.finalDy).toFixed(1)}px, ` +
        `${Math.abs(summary.finalDTheta).toFixed(1)}° 로 과정 허용 범위 안에서 확정했습니다.`,
    )
  } else {
    improve.push(
      `허용 범위(±${settings.tolerancePx}px, ±${settings.toleranceDeg}°)를 벗어난 상태로 확정했습니다.`,
    )
  }

  if (summary.overshootCount === 0) good.push('목표를 지나친 구간이 없습니다.')
  else improve.push(`목표를 지나친 구간이 ${summary.overshootCount}회 있습니다. 한 번에 움직이는 양을 줄여 보세요.`)

  if (levels[3] === 2) good.push('조정 순서를 고른 이유를 기록으로 남겼습니다.')
  else improve.push('왜 그 순서로 조정했는지 문장으로 남기면 다음 연습에서 비교할 수 있습니다.')

  if (!reportMatchesRecord) {
    improve.push(
      `적어 낸 순서(${ORDER_LABEL[reported] ?? reported ?? '미기재'})와 기록에서 읽힌 순서` +
        `(${ORDER_LABEL[observed] ?? observed})가 다릅니다. 어느 쪽이 실제였는지 확인해 보세요.`,
    )
  }

  return {
    generatedBy: 'mock',
    good: good.length > 0 ? good : ['정렬을 끝까지 진행했습니다.'],
    improve,
    eventIds: input.events,
    nextStep: within
      ? '같은 조건에서 한 번 더 연습해 소요 시간과 보정 횟수가 줄어드는지 확인해 보세요.'
      : '마크 읽기 단계로 돌아가 허용 오차 기준과 남은 오차를 읽는 방법을 다시 확인해 보세요.',
    cannotJudge: [
      '이 연습 기록으로는 실제 장비의 정렬 정밀도나 공정 결과를 판단할 수 없습니다.',
      '허용 오차는 교육 과정 설정값입니다.',
    ],
    generatedAt: new Date().toISOString(),
  }
}

function emptyFeedback(): Feedback {
  return {
    generatedBy: 'mock',
    good: [],
    improve: ['기록이 부족해 피드백을 만들 수 없습니다.'],
    eventIds: [],
    nextStep: '정렬 실습을 다시 진행해 주세요.',
    cannotJudge: ['기록이 없어 판단할 수 없습니다.'],
    generatedAt: new Date().toISOString(),
  }
}

export { ORDER_LABEL }

/**
 * judgment 실습의 규칙 기반 채점 (설계서 7.6). **AI 미연결 상태의 mock 모드에서만 쓴다.**
 * 서버가 붙으면 서버가 같은 규칙을 데이터(`scoring`)로 적용한다.
 */
export function scoreJudgment(course: Course, summary: JudgmentSummary, answer: Answer): ScoreResult {
  const levels: RubricLevel[] = [0, 0, 0, 0]
  const reasons: string[] = []
  const m = summary.scoringMetrics

  // 0 관측 판독 — 1순위로 고른 항목이 권장 순서에서 몇 번째였나
  if (m.firstPickRank === 1) {
    levels[0] = 2
    reasons.push('관측값이 가리키는 항목을 첫 번째로 확인하려 했습니다.')
  } else if (m.firstPickRank === 2) {
    levels[0] = 1
    reasons.push('첫 번째로 고른 항목이 권장 순서에서 두 번째입니다.')
  } else {
    reasons.push(
      `첫 번째로 고른 항목이 권장 순서에서 ${m.firstPickRank}번째입니다. 관측값이 어느 범위를 가리키는지 다시 읽어 보세요.`,
    )
  }

  // 1 확인 순서 — 권장 순서와의 거리
  if (m.orderDistance <= 2) {
    levels[1] = 2
    reasons.push('권장 순서와 거의 같은 순서로 배열했습니다.')
  } else if (m.orderDistance <= 5) {
    levels[1] = 1
    reasons.push(`권장 순서와 자리 차이의 합이 ${m.orderDistance}입니다.`)
  } else {
    reasons.push(`권장 순서와 자리 차이의 합이 ${m.orderDistance}로 큽니다.`)
  }

  // 2 범위 좁히기 — 상위 3개가 얼마나 겹치나
  if (m.top3Overlap >= 3) {
    levels[2] = 2
    reasons.push('상위 3개에 관련 높은 항목을 모두 모았습니다.')
  } else if (m.top3Overlap === 2) {
    levels[2] = 1
    reasons.push('상위 3개 중 2개가 권장 상위 항목과 겹칩니다.')
  } else {
    reasons.push(`상위 3개 중 ${m.top3Overlap}개만 권장 상위 항목과 겹칩니다.`)
  }

  // 3 설명·기록 — 정렬 실습과 같은 기준
  const text = answer.reason.trim()
  if (text.length >= 40) {
    levels[3] = 2
    reasons.push('그 순서로 확인하려는 이유를 문장으로 남겼습니다.')
  } else if (text.length >= 15) {
    levels[3] = 1
    reasons.push('이유가 짧습니다. 무엇을 보고 그렇게 판단했는지 한 문장 더 적어 보세요.')
  } else {
    reasons.push('확인 순서를 정한 이유가 거의 적히지 않았습니다.')
  }

  const good: string[] = []
  const improve: string[] = []
  if (m.passed) good.push('권장 순서와 가까운 순서로 배열했습니다.')
  else improve.push('권장 순서와 차이가 있습니다. 관측값이 가리키는 범위부터 다시 읽어 보세요.')
  if (levels[3] === 2) good.push('판단 이유를 기록으로 남겼습니다.')
  else improve.push('왜 그 순서로 확인하려는지 적으면 다음 연습과 비교할 수 있습니다.')

  return {
    levels,
    reasons,
    feedback: {
      generatedBy: 'mock',
      good: good.length > 0 ? good : ['순서를 끝까지 정해 제출했습니다.'],
      improve,
      eventIds: [],
      nextStep: m.passed
        ? '같은 상황을 다시 보고 두 번째·세 번째 항목의 근거도 말로 설명해 보세요.'
        : '관측값 표를 다시 읽고 어느 범위를 가리키는지부터 정리해 보세요.',
      cannotJudge: [
        `${course.rubric.length}개 기준은 이 교육 과정이 정한 것입니다. 실제 현장의 조치 순서를 확정하지 않습니다.`,
      ],
      generatedAt: new Date().toISOString(),
    },
  }
}
