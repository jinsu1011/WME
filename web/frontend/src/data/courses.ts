import type { Course } from '@/types'
import { tenant } from './tenant'

const T = tenant.terms

/** 계획서 4절 카탈로그. 실제 구현 과정은 stage-anomaly 하나뿐이다. */
export const courses: Course[] = [
  {
    id: 'equipment-basics',
    title: `${tenant.industryLabel} 구성과 역할`,
    subtitle: '주요 구성요소가 무엇을 담당하는지 이해한다',
    description:
      '장비를 이루는 주요 구성요소와 각 부분이 담당하는 역할을 훑는 입문 과정입니다. 현재는 소개 내용만 열람할 수 있습니다.',
    availability: 'preview',
    estimatedMinutes: 20,
    objectives: ['주요 구성요소의 이름과 역할을 설명한다', '자신이 맡을 영역의 위치를 파악한다'],
    prerequisites: [],
    steps: [],
    checkItems: [],
    rubric: [],
    version: 'preview-0.1',
  },
  {
    id: 'transfer-align',
    title: '이송과 정렬 원리',
    subtitle: '이동·정렬의 목적과 기본 개념',
    description:
      '이송과 정렬이 왜 필요한지, 어떤 조건이 결과를 좌우하는지 개념 수준에서 다룹니다. 현재는 소개 내용만 열람할 수 있습니다.',
    availability: 'preview',
    estimatedMinutes: 25,
    objectives: ['이송·정렬의 목적을 설명한다', '정렬 오차가 생기는 조건을 예시로 든다'],
    prerequisites: ['equipment-basics'],
    steps: [],
    checkItems: [],
    rubric: [],
    version: 'preview-0.1',
  },
  {
    id: 'stage-anomaly',
    title: `${T.asset} 이상 대응 실습`,
    subtitle: '정상 신호를 관찰하고, 근거를 들어 확인할 항목을 판단한다',
    description:
      `${T.mockup}을 올린 실습 장치의 움직임을 센서로 측정하고, 동작이 끝난 뒤 안정화 구간을 관찰합니다. ` +
      '정상 기준과 다른 구간을 찾아 근거로 선택하고, 먼저 확인할 점검 항목과 이유를 제출하면 학습 피드백을 받습니다.',
    availability: 'available',
    estimatedMinutes: 35,
    objectives: [
      '정상 기준과 새 측정 결과의 차이를 관찰한다',
      '판단에 사용한 시간 구간을 근거로 선택한다',
      '교육용 점검 안내에서 먼저 확인할 항목을 고른다',
      '관측된 사실과 아직 확인하지 않은 원인을 구분해 설명한다',
    ],
    prerequisites: ['equipment-basics'],
    steps: [
      { id: 'concept', title: '개념 확인', summary: `${T.asset}의 역할과 정상·이상 후보의 차이를 확인합니다.` },
      { id: 'baseline', title: '기준 관찰', summary: '사전에 수집한 정상 측정 기록과 측정 조건을 확인합니다.' },
      { id: 'practice', title: '실습 측정', summary: '센서 연결을 확인하고 측정한 뒤 동작 종료를 표시합니다.' },
      { id: 'judgement', title: '판단 제출', summary: '근거 구간을 고르고 점검 항목과 이유를 작성합니다.' },
      { id: 'feedback', title: '피드백 확인', summary: '관측과 판단에 대한 피드백을 확인하고 필요하면 재실습합니다.' },
    ],
    checkItems: [
      {
        id: 'sensor-mount',
        label: '센서 부착 상태 확인',
        hint: '센서가 판에 단단히 붙어 있지 않으면 측정값이 실제 움직임과 달라질 수 있습니다.',
      },
      {
        id: 'mockup-fix',
        label: `${T.mockup} 고정 상태 확인`,
        hint: '모형이 헐겁게 놓여 있으면 동작이 끝난 뒤에도 흔들림이 남을 수 있습니다.',
      },
      {
        id: 're-measure',
        label: '동일 조건 재측정',
        hint: '같은 부착·조작 조건에서 다시 측정해 관측이 반복되는지 확인합니다.',
      },
      {
        id: 'report',
        label: '관측 사실 보고',
        hint: '원인을 단정하지 않고 관측된 사실만 정리해 보고합니다.',
      },
    ],
    rubric: [
      { short: '관측 기술', text: '관측한 사실(무엇이, 언제, 얼마나)을 구체적으로 적었는가' },
      { short: '근거 연결', text: '선택한 근거 구간이 자신의 설명과 실제로 연결되는가' },
      { short: '판단 이유', text: '점검 항목을 고른 이유를 설명했는가' },
      { short: '단정 회피', text: '확인하지 않은 원인을 단정하지 않았는가' },
    ],
    version: 'course-1.0.0',
  },
  {
    id: 'preventive-check',
    title: '예방 점검과 기록 작성',
    subtitle: '점검 기록의 기본 구조',
    description: '점검 항목을 어떤 순서와 형식으로 기록하는지 다룰 예정입니다.',
    availability: 'coming_soon',
    estimatedMinutes: 30,
    objectives: [],
    prerequisites: [],
    steps: [],
    checkItems: [],
    rubric: [],
    version: 'draft',
  },
  {
    id: 'anomaly-report',
    title: '장비 이상 상황 보고',
    subtitle: '관측 사실과 해석의 구분',
    description: '이상 상황을 보고할 때 사실과 추정을 어떻게 구분해 적는지 다룰 예정입니다.',
    availability: 'coming_soon',
    estimatedMinutes: 30,
    objectives: [],
    prerequisites: [],
    steps: [],
    checkItems: [],
    rubric: [],
    version: 'draft',
  },
]

export const IMPLEMENTED_COURSE_ID = 'stage-anomaly'

export function getCourse(id: string): Course | undefined {
  return courses.find((c) => c.id === id)
}
