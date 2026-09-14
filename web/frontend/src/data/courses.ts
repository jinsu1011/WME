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
    exerciseType: 'alignment',
    estimatedMinutes: 20,
    objectives: ['포토공정의 단계 순서를 설명한다', '각 단계가 왜 필요한지 예시로 든다'],
    prerequisites: [],
    steps: [],
    orderOptions: [],
    rubric: [],
    alignment: null,
    control: null,
    scenario: null,
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
    exerciseType: 'alignment',
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
      tiltControls: [
        { keys: 'W / S', effect: '앞뒤로 기울이기' },
        { keys: 'A / D', effect: '좌우로 기울이기' },
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
    scenario: null,
    version: 'course-2.0.0',
  },
  {
    id: 'align-record',
    title: '정렬 기록 작성',
    subtitle: '조정 과정과 결과를 남기는 방법',
    description: '정렬 작업에서 무엇을 어떤 순서로 기록해야 하는지 다룰 예정입니다.',
    availability: 'coming_soon',
    exerciseType: 'alignment',
    estimatedMinutes: 25,
    objectives: [],
    prerequisites: [],
    steps: [],
    orderOptions: [],
    rubric: [],
    alignment: null,
    control: null,
    scenario: null,
    version: 'draft',
  },
  {
    id: 'exposure-basics',
    title: '노광 조건의 기본',
    subtitle: '조건이 결과를 바꾸는 방식',
    description: '노광 조건이 패턴 결과에 어떻게 반영되는지 개념 수준에서 다룰 예정입니다.',
    availability: 'coming_soon',
    exerciseType: 'alignment',
    estimatedMinutes: 30,
    objectives: [],
    prerequisites: [],
    steps: [],
    orderOptions: [],
    rubric: [],
    alignment: null,
    control: null,
    scenario: null,
    version: 'draft',
  },
  {
    // 두 번째 실습 유형(judgment). 조작이 없고 읽고·순서 정하고·적는다.
    // 시나리오·문구·권장 순서는 전부 이 안에 있다(컴포넌트에 쓰지 않는다).
    id: 'defect-report',
    title: '공정 이상 상황 보고 — 무엇부터 확인할 것인가',
    subtitle: '관측값을 읽고 확인할 순서를 정한다',
    description:
      '검사에서 발견된 상황과 관측값을 읽고, 무엇부터 확인할지 순서를 정해 제출합니다. ' +
      '조작 장치는 쓰지 않습니다. 관찰한 것에서 무엇을 먼저 좁힐지 판단하는 연습입니다.',
    availability: 'available',
    exerciseType: 'judgment',
    estimatedMinutes: 15,
    objectives: [
      '관측값이 가리키는 범위를 읽는다',
      '확인할 항목의 순서를 근거를 들어 정한다',
      '관련이 높은 항목을 앞쪽에 모은다',
      '왜 그 순서로 확인하려는지 설명한다',
    ],
    prerequisites: [],
    steps: [
      { id: 'concept', title: '상황 읽기', summary: '무슨 일이 있었는지와 관측값을 확인합니다.' },
      { id: 'marks', title: '관측값 판독', summary: '관측값이 어느 범위를 가리키는지 읽습니다.' },
      { id: 'align', title: '순서 정하기', summary: '확인 항목 5개의 순서를 정합니다.' },
      { id: 'submit', title: '제출', summary: '왜 그 순서인지 적고 제출합니다.' },
      {
        id: 'feedback',
        title: '피드백 확인',
        summary: '권장 순서와 그 근거를 확인하고 필요하면 다시 연습합니다.',
      },
    ],
    orderOptions: [],
    rubric: [
      { short: '관측 판독', text: '관측값이 가리키는 곳을 먼저 확인하려 했는가' },
      { short: '확인 순서', text: '권장 절차와 가까운 순서로 배열했는가' },
      { short: '범위 좁히기', text: '상위 항목에 관련 높은 것을 모았는가' },
      { short: '설명·기록', text: '왜 그 순서로 확인하려는지 설명했는가' },
    ],
    alignment: null,
    control: null,
    scenario: {
      situation:
        '노광 후 검사에서 웨이퍼 가장자리 쪽 패턴이 흐리게 나왔습니다. 중심부는 정상입니다.',
      observations: [
        { label: '패턴 상태', value: '중심부 정상 · 가장자리 흐림' },
        { label: '직전 로트', value: '이상 없음' },
        { label: '레지스트 도포 두께', value: '기록상 정상 범위' },
        { label: '평행도 점검 이력', value: '3일 전 수행' },
        { label: '노광 시간', value: '설정값과 동일' },
      ],
      checkItems: [
        { id: 'wedge', label: '마스크·웨이퍼 평행도(웨지) 점검' },
        { id: 'focus', label: '노광 초점 설정 확인' },
        { id: 'contam', label: '마스크 표면 오염 확인' },
        { id: 'coat', label: '레지스트 도포 균일도 재확인' },
        { id: 'history', label: '장비 정비 이력 조회' },
      ],
      recommendedOrder: ['wedge', 'focus', 'contam', 'coat', 'history'],
      orderNote: '권장 순서는 이 교육 과정이 정한 기준이며 모든 현장의 정답이 아닙니다.',
      rationale:
        '가장자리만 흐리고 중심은 정상이라는 관측은 면 전체에 걸친 조건(평행도·초점)을 먼저 가리킵니다. ' +
        '도포나 정비 이력은 관측이 그쪽을 가리킬 때 확인합니다.',
    },
    version: 'course-judgment-1.0.0',
  },
]

export const IMPLEMENTED_COURSE_ID = 'photo-align'

export function getCourse(id: string): Course | undefined {
  return courses.find((c) => c.id === id)
}

export function implementedCourse(): Course {
  return getCourse(IMPLEMENTED_COURSE_ID)!
}
