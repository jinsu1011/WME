/**
 * 모형 컨트롤러(센서 모드) 설정값.
 *
 * ⚠️ HEADER 확인 필요 — 이 값들은 **아직 서버 과정 설정(content)에 없다.**
 * 서버에 자리가 생기면 `course.alignment` 로 옮기고 여기 상수는 지운다.
 * 그때까지는 화면이 이 값을 쓰되, 어디서 온 값인지 화면에 밝힌다.
 */

/** 수평(평행)으로 볼 기울기 허용 범위(도). 시작값 ±2.0° */
export const LEVEL_TOLERANCE_DEG = 2.0

/**
 * 키보드로 기울기를 조작할 때의 안내.
 * ⚠️ HEADER 확인 필요 — 과정 설정값(`course.control`)에 아직 기울기 키 자리가 없다.
 * 서버에 자리가 생기면 `alignment.controls` 로 옮긴다.
 */
export const KEYBOARD_TILT_CONTROLS = [
  { keys: 'W / S', effect: '앞뒤로 기울이기' },
  { keys: 'A / D', effect: '좌우로 기울이기' },
] as const

/** 화면 표시용 설명. 업종·과정 문구는 데이터에만 둔다. */
export const CONTROLLER_TEXT = {
  panelTitle: '교육용 컨트롤러 상태',
  panelNote: '센서를 붙인 웨이퍼 모형의 자세입니다.',
  levelStepTitle: '1단계 · 수평 맞추기',
  rotateStepTitle: '2단계 · 회전 맞추기',
  levelHint: '모형을 책상에 놓고 기울기를 0 에 가깝게 만듭니다.',
  rotateLocked: '먼저 수평을 맞추세요. 수평이 확보되어야 회전 입력이 반영됩니다.',
  rotateReady: '수평이 확보되었습니다. 모형을 비틀면 회전(θ)이 조정됩니다.',
  zeroHint: '책상이 기울어 있을 수 있습니다. 모형을 내려놓고 영점을 잡으면 그 자세가 0 이 됩니다.',
  toleranceNote: '수평 허용 범위는 교육 과정 설정값입니다. 실제 장비의 평행도 기준이 아닙니다.',
  keyboardTiltHint:
    '센서가 없어도 키보드로 기울여 볼 수 있습니다. 기울어져 있으면 회전 입력이 잠깁니다.',
  levelReset: '수평으로 되돌리기',
} as const

/**
 * 정렬 확정 뒤 보여 주는 노광·현상 연출의 설명.
 * 공정 순서(노광 → 현상 → 패턴 확인)를 그대로 따른다.
 *
 * ⚠️ HEADER 확인 필요 — 과정 데이터에 자리가 생기면 `courses.ts` 로 옮긴다.
 */
export const EXPOSURE_TEXT = {
  expose: {
    title: '노광 — 마스크 너머로 빛을 쬡니다',
    body: '마스크의 패턴이 감광액에 새겨집니다. 이때 마스크와 웨이퍼가 어긋나 있으면 그대로 새겨집니다.',
  },
  develop: {
    title: '현상 — 현상액을 뿌립니다',
    body: '빛을 받은 부분이 씻겨 나가면서 패턴이 눈에 보이게 됩니다.',
  },
  result: {
    title: '결과 — 웨이퍼에 남은 패턴',
    okBody:
      '패턴이 마스크 기준 안에 들어왔습니다. 방금 맞춘 정렬이 이 결과로 이어집니다.',
    offBody:
      '패턴이 마스크 기준에서 어긋난 채로 남았습니다. 정렬 오차가 그대로 결과에 나타난 것입니다.',
  },
} as const
