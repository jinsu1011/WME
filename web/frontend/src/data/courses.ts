import type { Course } from '@/types'
import { tenant } from './tenant'

const T = tenant.terms

/**
 * 과정 카탈로그. 실제로 실습까지 구현된 과정은 photo-align 하나다.
 * 업종·과정에 관한 모든 문구는 이 파일과 tenant.ts 에만 둔다.
 */
export const courses: Course[] = [
  {
    id: 'photo-basics',
    title: '포토공정 개요',
    subtitle: '노광 전후에 무슨 일이 일어나는지 이해한다',
    description:
      '감광액 도포부터 노광·현상까지 포토공정의 흐름과 각 단계가 담당하는 역할을 훑는 입문 과정입니다. 현재는 소개 내용만 열람할 수 있습니다.',
    availability: 'preview',
    estimatedMinutes: 20,
    objectives: ['포토공정의 단계 순서를 설명한다', '각 단계가 왜 필요한지 예시로 든다'],
    prerequisites: [],
    steps: [],
    orderOptions: [],
    rubric: [],
    alignment: null,
    control: null,
    version: 'preview-0.1',
  },
  {
    id: 'photo-align',
    title: `포토공정 입문 — ${T.mask}·${T.assetShort} 정렬 실습`,
    subtitle: '정렬 마크를 읽고 위치와 회전을 순서대로 맞춘다',
    description:
      `노광 전에는 ${T.mask}와 ${T.asset}의 패턴 위치를 맞춰야 합니다. ` +
      `${T.aligner}에서는 작업자가 화면의 정렬 마크를 보면서 위치와 회전을 직접 조정합니다. ` +
      '이 과정에서는 고정된 마스크 마크에 어긋난 웨이퍼 마크를 허용 오차 안으로 맞추고, ' +
      '어떤 순서로 조정했는지와 그 이유를 적어 연습 피드백을 받습니다.',
    availability: 'available',
    estimatedMinutes: 30,
    objectives: [
      '노광 전 정렬이 왜 필요한지 설명한다',
      '정렬 마크를 보고 어긋난 방향과 양을 읽는다',
      '위치와 회전을 순서대로 조정해 허용 오차 안에 맞춘다',
      '자신이 그 순서로 조정한 이유를 설명하고 결과를 기록한다',
    ],
    prerequisites: ['photo-basics'],
    steps: [
      {
        id: 'concept',
        title: '개념 확인',
        summary: `포토공정에서 ${T.mask}와 ${T.assetShort}의 정렬이 어떤 역할을 하는지 확인합니다.`,
      },
      {
        id: 'marks',
        title: '마크 읽기',
        summary: '정렬 마크의 모양과 허용 오차 기준을 확인하고, 어긋난 예시를 읽습니다.',
      },
      {
        id: 'align',
        title: '정렬 실습',
        summary: '컨트롤러로 위치(X·Y)를, 화면 조작으로 회전(θ)을 조정해 두 마크를 겹칩니다.',
      },
      {
        id: 'submit',
        title: '제출',
        summary: '정렬을 확정하고, 어떤 순서로 조정했는지와 그 이유를 적습니다.',
      },
      {
        id: 'feedback',
        title: '피드백 확인',
        summary: '오차·소요 시간·보정 경로와 연습 피드백을 확인하고 필요하면 다시 연습합니다.',
      },
    ],
    orderOptions: [
      {
        id: 'xy-then-theta',
        label: '위치를 먼저 맞추고 회전을 정리했다',
        hint: '두 마크를 겹친 뒤 기울어진 각도를 마지막에 맞추는 순서입니다.',
      },
      {
        id: 'theta-then-xy',
        label: '회전을 먼저 맞추고 위치를 정리했다',
        hint: '각도를 먼저 세우면 이후 위치 조정에서 축이 덜 섞입니다.',
      },
      {
        id: 'interleaved',
        label: '위치와 회전을 번갈아 조금씩 맞췄다',
        hint: '한 번에 크게 움직이지 않고 두 축을 나눠 접근하는 순서입니다.',
      },
      {
        id: 'other',
        label: '그 밖의 순서로 진행했다',
        hint: '위 셋에 해당하지 않는 경우입니다. 이유란에 실제 순서를 적어 주세요.',
      },
    ],
    rubric: [
      { short: '정렬 정확도', text: '최종 오차가 과정에 설정된 허용 범위 안에 들어왔는가' },
      { short: '조정 순서', text: '위치를 먼저 맞추고 회전을 정리하는 등 절차를 지켰는가' },
      { short: '보정 효율', text: '과잉 보정 없이 수렴했는가' },
      { short: '설명·기록', text: '왜 그 순서로 조정했는지 설명했는가' },
    ],
    alignment: {
      tolerancePx: 4,
      toleranceDeg: 1,
      umPerPx: 25,
      startOffset: { x: 62, y: -44, theta: 6.5 },
      controls: [
        { keys: '방향키 ← → ↑ ↓', effect: '위치(X·Y) 이동' },
        { keys: 'Q / E', effect: '회전(θ) 조정' },
        { keys: 'Shift + 키', effect: '더 천천히 움직이기' },
      ],
      controllerNotice:
        `센서를 붙인 ${T.mockup}은 실제 장비의 조작기를 대신하는 교육용 컨트롤러입니다. ` +
        '실제 공정에서 웨이퍼를 손으로 기울여 정렬한다는 뜻이 아닙니다.',
      markLabels: { fixed: `${T.mask} 마크`, moving: `${T.assetShort} 마크` },
      fieldRadius: 132,
      materials: [
        '노트북과 웹 브라우저 (키보드만으로 실습 가능)',
        `센서를 붙인 ${T.mockup} — 교육용 컨트롤러 (선택, 준비되면 사용)`,
        'USB 케이블',
      ],
    },
    control: {
      deadZoneDeg: 2,
      gainPxPerDeg: 12,
      maxSpeedPx: 160,
      yawDeadZoneDeg: 3,
      yawGainDegPerDeg: 2.5,
      maxSpeedDeg: 30,
      keyboard: { movePxPerSec: 90, rotateDegPerSec: 22, fineFactor: 0.25 },
    },
    version: 'course-2.0.0',
  },
  {
    id: 'align-record',
    title: '정렬 기록 작성',
    subtitle: '조정 과정과 결과를 남기는 방법',
    description: '정렬 작업에서 무엇을 어떤 순서로 기록해야 하는지 다룰 예정입니다.',
    availability: 'coming_soon',
    estimatedMinutes: 25,
    objectives: [],
    prerequisites: [],
    steps: [],
    orderOptions: [],
    rubric: [],
    alignment: null,
    control: null,
    version: 'draft',
  },
  {
    id: 'exposure-basics',
    title: '노광 조건의 기본',
    subtitle: '조건이 결과를 바꾸는 방식',
    description: '노광 조건이 패턴 결과에 어떻게 반영되는지 개념 수준에서 다룰 예정입니다.',
    availability: 'coming_soon',
    estimatedMinutes: 30,
    objectives: [],
    prerequisites: [],
    steps: [],
    orderOptions: [],
    rubric: [],
    alignment: null,
    control: null,
    version: 'draft',
  },
  {
    id: 'defect-report',
    title: '공정 이상 상황 보고',
    subtitle: '관측 사실과 해석의 구분',
    description: '이상 상황을 보고할 때 사실과 추정을 어떻게 구분해 적는지 다룰 예정입니다.',
    availability: 'coming_soon',
    estimatedMinutes: 30,
    objectives: [],
    prerequisites: [],
    steps: [],
    orderOptions: [],
    rubric: [],
    alignment: null,
    control: null,
    version: 'draft',
  },
]

export const IMPLEMENTED_COURSE_ID = 'photo-align'

export function getCourse(id: string): Course | undefined {
  return courses.find((c) => c.id === id)
}

export function implementedCourse(): Course {
  return getCourse(IMPLEMENTED_COURSE_ID)!
}
