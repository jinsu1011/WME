import type { Enrollment, RubricLevel, StepId, User } from '@/types'

/** 데모 사용자. 실제 직원 정보가 아니며 인증 구현도 아니다. */
export const instructor: User = {
  id: 'u-instructor',
  displayName: '최민정',
  role: 'instructor',
  department: '기술교육센터 · 교육 담당',
}

export interface LearnerSeed {
  id: string
  displayName: string
  department: string
  /** stage-anomaly 과정에서 완료한 단계 */
  steps: StepId[]
  /** 과거 실습 시도. 최신이 배열 끝. */
  attempts: { daysAgo: number; durationSec: number; rubric: RubricLevel[] | null }[]
  /** equipment-basics(미리보기 과정) 열람 완료 여부 */
  basicsDone: boolean
}

const ALL_STEPS: StepId[] = ['concept', 'baseline', 'practice', 'judgement', 'feedback']

/**
 * 시연용 시드 기록. 화면의 모든 집계는 이 기록에서만 계산한다.
 * 집계를 손으로 적어 넣지 않는다 — 기록이 바뀌면 그래프도 바뀐다.
 */
export const learnerSeeds: LearnerSeed[] = [
  {
    id: 'u-1',
    displayName: '박지훈',
    department: '장비기술1팀 · 신입',
    steps: ALL_STEPS.slice(0, 4),
    basicsDone: true,
    attempts: [
      { daysAgo: 12, durationSec: 1580, rubric: [1, 0, 1, 1] },
      { daysAgo: 5, durationSec: 1240, rubric: [2, 1, 1, 2] },
      { daysAgo: 1, durationSec: 980, rubric: [2, 2, 1, 2] },
    ],
  },
  {
    id: 'u-2',
    displayName: '한소영',
    department: '장비기술1팀 · 신입',
    steps: ALL_STEPS,
    basicsDone: true,
    attempts: [
      { daysAgo: 18, durationSec: 1720, rubric: [1, 1, 1, 1] },
      { daysAgo: 9, durationSec: 1130, rubric: [2, 2, 2, 2] },
    ],
  },
  {
    id: 'u-3',
    displayName: '정우석',
    department: '장비기술2팀 · 전환배치',
    steps: ALL_STEPS,
    basicsDone: true,
    attempts: [{ daysAgo: 14, durationSec: 1410, rubric: [2, 1, 2, 1] }],
  },
  {
    id: 'u-4',
    displayName: '김하늘',
    department: '장비기술2팀 · 신입',
    steps: ALL_STEPS.slice(0, 3),
    basicsDone: true,
    attempts: [
      { daysAgo: 7, durationSec: 1660, rubric: [1, 1, 0, 1] },
      { daysAgo: 2, durationSec: 1490, rubric: null },
    ],
  },
  {
    id: 'u-5',
    displayName: '오세진',
    department: '설비보전팀 · 전환배치',
    steps: ALL_STEPS,
    basicsDone: true,
    attempts: [
      { daysAgo: 21, durationSec: 1840, rubric: [1, 0, 1, 0] },
      { daysAgo: 16, durationSec: 1350, rubric: [1, 1, 1, 1] },
      { daysAgo: 8, durationSec: 1080, rubric: [2, 1, 2, 2] },
    ],
  },
  {
    id: 'u-6',
    displayName: '윤가람',
    department: '설비보전팀 · 신입',
    steps: ALL_STEPS.slice(0, 2),
    basicsDone: true,
    attempts: [],
  },
  {
    id: 'u-7',
    displayName: '서동현',
    department: '장비기술1팀 · 전환배치',
    steps: ALL_STEPS.slice(0, 4),
    basicsDone: false,
    attempts: [{ daysAgo: 3, durationSec: 1520, rubric: [1, 2, 1, 1] }],
  },
  {
    id: 'u-8',
    displayName: '문예린',
    department: '장비기술2팀 · 신입',
    steps: [],
    basicsDone: false,
    attempts: [],
  },
]

export const learners: User[] = learnerSeeds.map((s) => ({
  id: s.id,
  displayName: s.displayName,
  role: 'learner',
  department: s.department,
}))

/** 로그인한 것으로 가정하는 데모 교육생 */
export const currentLearner = learners[0]!
export const users: User[] = [...learners, instructor]

/** 배정은 초기 데이터다. 배정 편집 화면은 이번 범위에 없다. */
export const seedEnrollments: Enrollment[] = learnerSeeds.flatMap((s): Enrollment[] => [
  {
    id: `e-${s.id}-stage`,
    userId: s.id,
    courseId: 'stage-anomaly',
    status: s.steps.length === 5 ? 'completed' : s.steps.length === 0 ? 'not_started' : 'in_progress',
    stepsCompleted: s.steps,
    completedAt: null,
  },
  {
    id: `e-${s.id}-basics`,
    userId: s.id,
    courseId: 'equipment-basics',
    status: s.basicsDone ? 'completed' : 'not_started',
    stepsCompleted: [],
    completedAt: null,
  },
])
