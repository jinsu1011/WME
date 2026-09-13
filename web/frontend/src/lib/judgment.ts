import type { JudgmentScenario, JudgmentSummary } from '@/types'

/**
 * judgment 실습의 지표 계산 (기획/설계/실습유형_설계.md 7.5).
 * 도메인 단어가 들어가지 않는다 — 순서 두 개와 글자 수만 본다.
 */
export function judgmentMetrics(
  orderedIds: string[],
  scenario: JudgmentScenario,
  answerLength: number,
  durationMs: number,
): JudgmentSummary {
  const recommended = scenario.recommendedOrder
  const rankOf = new Map(recommended.map((id, i) => [id, i + 1]))

  // 1순위로 놓은 항목이 권장 순서에서 몇 번째인가 (1부터). 모르면 목록 길이+1로 둔다.
  const firstPickRank = rankOf.get(orderedIds[0] ?? '') ?? recommended.length + 1

  // 각 항목의 (학습자 위치 − 권장 위치) 절댓값 합
  const orderDistance = orderedIds.reduce((sum, id, index) => {
    const recommendedRank = rankOf.get(id)
    if (recommendedRank === undefined) return sum
    return sum + Math.abs(index + 1 - recommendedRank)
  }, 0)

  // 상위 3개가 권장 상위 3개와 겹치는 개수
  const topRecommended = new Set(recommended.slice(0, 3))
  const top3Overlap = orderedIds.slice(0, 3).filter((id) => topRecommended.has(id)).length

  return {
    durationMs,
    firstPickRank,
    orderDistance,
    top3Overlap,
    answerLength,
    passed: orderDistance <= 4,
  }
}

/** 제출 가능한 순서인지 — 항목 id 를 빠짐없이 한 번씩 담았는지 확인한다. */
export function isCompleteOrder(orderedIds: string[], scenario: JudgmentScenario): boolean {
  const ids = new Set(orderedIds)
  return (
    ids.size === orderedIds.length &&
    orderedIds.length === scenario.checkItems.length &&
    scenario.checkItems.every((item) => ids.has(item.id))
  )
}

/** 목록에서 한 칸 올리거나 내린다. 범위를 벗어나면 그대로 둔다. */
export function moveItem<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list
  const next = [...list]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item!)
  return next
}

/**
 * 순서 배열의 **시작 상태**를 만든다.
 *
 * 과정 데이터의 `checkItems` 순서가 `recommendedOrder` 와 같을 수 있다.
 * 그대로 두면 아무것도 하지 않고 제출해도 만점이 되고, 권장 순서가 그대로 노출된다.
 * 그래서 고정된 규칙으로 섞는다 — 무작위가 아니라서 다시 열어도 같은 순서가 나온다.
 */
export function initialOrder(scenario: JudgmentScenario, seed: string): string[] {
  const ids = scenario.checkItems.map((item) => item.id)
  if (ids.length < 2) return ids

  // 문자열에서 만든 고정 난수(같은 과정이면 항상 같은 순서)
  let state = 0
  for (const char of seed) state = (state * 31 + char.charCodeAt(0)) % 2147483647
  const next = () => {
    state = (state * 1103515245 + 12345) % 2147483647
    return state / 2147483647
  }

  const shuffled = [...ids]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
  }

  // 섞었는데 권장 순서와 같아지면 앞의 둘을 바꿔 확실히 다르게 만든다.
  const same = shuffled.every((id, i) => id === scenario.recommendedOrder[i])
  if (same) [shuffled[0], shuffled[1]] = [shuffled[1]!, shuffled[0]!]
  return shuffled
}
