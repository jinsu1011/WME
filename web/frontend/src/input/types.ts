import type { InputSource } from '@/types'

/**
 * 컨트롤러 한 틱의 출력. **위치가 아니라 속도**다.
 * 기울기를 위치로 바로 매핑하지 않고 속도로 해석하는 조이스틱 방식이다.
 * (기획/설계/실습과정_정렬.md 3절)
 *
 * vx, vy  : 초당 화면 px
 * vTheta  : 초당 도(°)
 */
export interface ControllerVelocity {
  vx: number
  vy: number
  vTheta: number
}

/**
 * 무엇으로 조작하든 화면은 이 인터페이스만 본다.
 * 지금 쓰는 것은 KeyboardSource 하나이고, 센서가 오면 TiltSource 를 같은 자리에 끼운다.
 * 화면 코드는 어느 구현체인지 알지 못한다.
 */
export interface ControllerSource {
  /** 화면에 표시할 입력 출처 */
  readonly kind: InputSource
  /** 이 구현체를 지금 쓸 수 있는지. 못 쓰면 화면이 이유를 표시한다. */
  readonly available: boolean
  /** 쓸 수 없을 때의 이유 (있으면 화면에 그대로 보여준다) */
  readonly unavailableReason?: string
  /** 입력 수신을 시작한다. */
  start: () => void
  /** 입력 수신을 멈추고 붙인 것을 정리한다. */
  stop: () => void
  /**
   * 지금 이 순간의 속도를 읽는다. 화면이 매 프레임 호출한다.
   * 호출하는 쪽이 경과 시간(dt)을 곱해 위치를 누적한다.
   */
  read: () => ControllerVelocity
}

export const ZERO_VELOCITY: ControllerVelocity = { vx: 0, vy: 0, vTheta: 0 }
