/**
 * 화면에 나가는 제품 문구.
 * 컴포넌트에 문장을 직접 쓰지 않고 여기 모은다(업종·과정 문구는 tenant.ts / courses.ts).
 */

/** 학습자 첫 화면 인사말 — 이 서비스가 무엇을 위한 것인지 한 번에 말한다. */
export const HOME_INTRO = {
  /** {name} 자리에 학습자 이름이 들어간다. */
  title: '{name}님, 실장비 앞에 서기 전에 연습합니다.',
  titleWithoutName: '실장비 앞에 서기 전에 연습합니다.',
  description:
    '어긋난 상태를 읽고 무엇부터 조정할지 판단하는 훈련입니다. 여기서는 몇 번이든 다시 할 수 있습니다.',
} as const

/**
 * 대기방에서 "왜 실장비가 아니라 여기서 하나"를 설명하는 블록.
 * 마지막 문장(실장비를 대체하지 않는다)은 반드시 함께 둔다.
 */
export const WHY_HERE = {
  title: '왜 실장비가 아니라 여기서 연습하나요',
  body:
    '실장비 실습은 장비를 점유하고, 숙련자가 옆에 붙어야 하고, 틀리면 재작업이 듭니다. ' +
    '그래서 신입이 충분히 반복할 수 없습니다. 여기서는 같은 판단을 몇 번이든 반복합니다.',
  limit: '다만 이 연습은 실장비 실습을 대체하지 않습니다. 그 앞에 오는 단계입니다.',
} as const

/**
 * 결과 화면 맨 위 한 줄 요약.
 * 숫자를 읽지 않아도 통과 여부와 가장 약한 기준을 바로 알 수 있게 한다.
 */
export const RESULT_HEADLINE = {
  /** 실습 유형마다 '통과'가 뜻하는 것이 다르다. */
  passed: '허용 범위 안에 맞췄습니다.',
  failed: '허용 범위 밖에서 확정했습니다.',
  passedJudgment: '권장 순서와 가깝게 배열했습니다.',
  failedJudgment: '권장 순서와 차이가 있습니다.',
  /** 통과했는데도 약한 기준이 있을 때 앞에 붙인다. */
  butPrefix: '다만 ',
  /** {short} = 가장 약한 기준 이름, {reason} = 그 기준의 판정 이유 */
  weakest: '가장 약한 기준은 ‘{short}’입니다 — {reason}',
  /** 판정 이유가 아직 없을 때(규칙 채점 전이거나 서버가 이유를 주지 않은 기록) */
  weakestNoReason: '가장 약한 기준은 ‘{short}’입니다.',
  allGood: '네 기준 모두 충족했습니다.',
  notScored: '아직 채점 전입니다. 제출한 답변과 기록은 그대로 저장되어 있습니다.',
  noAnswer: '답변을 제출하지 않은 기록입니다.',
} as const

/** 문구의 {자리}를 값으로 바꾼다. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole)
}
