/**
 * 모형 컨트롤러(센서 모드) 설정값.
 *
 * ⚠️ HEADER 확인 필요 — 이 값들은 **아직 서버 과정 설정(content)에 없다.**
 * 서버에 자리가 생기면 `course.alignment` 로 옮기고 여기 상수는 지운다.
 * 그때까지는 화면이 이 값을 쓰되, 어디서 온 값인지 화면에 밝힌다.
 */

/** 수평(평행)으로 볼 기울기 허용 범위(도). 시작값 ±2.0° */
export const LEVEL_TOLERANCE_DEG = 2.0

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
} as const
