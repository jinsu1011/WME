import type { ControllerSource, ControllerVelocity } from './types'
import { ZERO_VELOCITY } from './types'

/**
 * 센서를 붙인 교육용 모형 컨트롤러 자리. **아직 구현하지 않았다.**
 *
 * 모형의 기울기(roll/pitch)를 받아 **이동 속도**로 해석한다(조이스틱 방식).
 * 기울기가 곧 위치라는 뜻이 아니다.
 *
 * 센서가 확보되면 이 클래스 안에서만:
 *   1. WebSocket 으로 { roll, pitch } 를 받고
 *   2. deadZone 을 빼고 gain 을 곱해 vx, vy 로 바꾼다
 * 화면 코드는 한 줄도 바뀌지 않는다.
 */
export interface TiltMapping {
  /** 이 각도(도) 안쪽 기울기는 흔들림으로 보고 무시한다 */
  deadZoneDeg: number
  /** 기울기 1도당 초당 몇 px 움직일지 */
  gainPxPerDeg: number
  /** 최대 속도 제한 (px/초) */
  maxSpeed: number
}

export const DEFAULT_TILT_MAPPING: TiltMapping = {
  deadZoneDeg: 2,
  gainPxPerDeg: 12,
  maxSpeed: 160,
}

export class TiltSource implements ControllerSource {
  readonly kind = 'controller' as const
  readonly available = false
  readonly unavailableReason =
    '모형 컨트롤러가 연결되지 않았습니다. 센서와 수신 서버가 준비되면 이 입력으로 바꿀 수 있습니다.'

  readonly mapping: TiltMapping

  constructor(mapping: Partial<TiltMapping> = {}) {
    this.mapping = { ...DEFAULT_TILT_MAPPING, ...mapping }
  }

  start = () => {
    // 수신 연결은 센서 확보 후 SENSOR/BACK 세션에서 붙인다. 지금은 아무것도 하지 않는다.
  }

  stop = () => {}

  read = (): ControllerVelocity => ZERO_VELOCITY

  /** 기울기 → 속도 변환 규칙. 구현 전에도 화면이 설명을 보여줄 수 있게 공개한다. */
  toVelocity = (roll: number, pitch: number): ControllerVelocity => {
    const { deadZoneDeg, gainPxPerDeg, maxSpeed } = this.mapping
    const apply = (deg: number) => {
      const over = Math.abs(deg) - deadZoneDeg
      if (over <= 0) return 0
      const v = Math.sign(deg) * over * gainPxPerDeg
      return Math.max(-maxSpeed, Math.min(maxSpeed, v))
    }
    return { vx: apply(roll), vy: apply(pitch), vTheta: 0 }
  }
}
