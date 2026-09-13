import type { ControllerSource, ControllerVelocity } from './types'
import { ZERO_VELOCITY } from './types'

/**
 * 키를 얼마나 빠르게 움직임으로 바꿀지. 화면 px/초, 도/초.
 * **숫자를 여기 적어두고 쓰지 않는다.** 과정 설정값(`course.control.keyboard`)을 받아서 쓴다.
 * 아래 기본값은 서버를 못 불러왔을 때를 위한 최후 수단이다.
 */
export interface KeyboardSpeed {
  move: number
  rotate: number
  /** Shift 를 누르고 있을 때 곱하는 배수 (느리게 = 1 보다 작게) */
  fineFactor: number
  /** 기울기 조작 속도(도/초). 센서가 없을 때 키보드로 기울일 때 쓴다. */
  tilt: number
}

const DEFAULT_SPEED: KeyboardSpeed = { move: 90, rotate: 22, fineFactor: 0.25, tilt: 18 }

/** 과정 설정값(서버 응답)을 이 어댑터의 속도로 바꾼다. */
export function speedFromControl(keyboard: {
  movePxPerSec: number
  rotateDegPerSec: number
  fineFactor: number
}): Partial<KeyboardSpeed> {
  return {
    move: keyboard.movePxPerSec,
    rotate: keyboard.rotateDegPerSec,
    fineFactor: keyboard.fineFactor,
  }
}

/** 기울기 조작의 속도. 위치·회전과 달리 과정 설정값에 아직 자리가 없다. */
export interface KeyboardTiltVelocity {
  /** 좌우 기울기 변화 속도 (도/초) */
  vRoll: number
  /** 앞뒤 기울기 변화 속도 (도/초) */
  vPitch: number
}

/**
 * 지금 쓰는 컨트롤러. 키를 누르고 있는 동안 계속 움직인다(속도 방식).
 *
 * **물리 키 위치(`event.code`)로 판단한다.** `event.key` 를 쓰면 한글 입력 상태에서
 * Q·E 가 'ㅂ'·'ㄷ' 로 들어와 조작이 통째로 먹지 않는다(방향키는 영향이 없어 더 찾기 어렵다).
 *
 *   방향키        위치 X·Y
 *   Q / E         회전 θ
 *   W A S D       기울기(앞뒤 W·S, 좌우 A·D) — 센서 없이 수평 맞추기를 연습할 때 쓴다
 *   Shift         더 천천히
 */
export class KeyboardSource implements ControllerSource {
  readonly kind = 'keyboard' as const
  readonly available = true

  private pressed = new Set<string>()
  private running = false
  private speed: KeyboardSpeed

  constructor(speed: Partial<KeyboardSpeed> = {}) {
    this.speed = { ...DEFAULT_SPEED, ...speed }
  }

  start = () => {
    if (this.running) return
    this.running = true
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.clear)
  }

  stop = () => {
    this.running = false
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.clear)
    this.pressed.clear()
  }

  private has = (code: string) => this.pressed.has(code)

  private get fine(): number {
    return this.has('ShiftLeft') || this.has('ShiftRight') ? this.speed.fineFactor : 1
  }

  read = (): ControllerVelocity => {
    if (!this.running) return ZERO_VELOCITY
    const fine = this.fine
    let vx = 0
    let vy = 0
    let vTheta = 0
    if (this.has('ArrowLeft')) vx -= 1
    if (this.has('ArrowRight')) vx += 1
    if (this.has('ArrowUp')) vy -= 1
    if (this.has('ArrowDown')) vy += 1
    if (this.has('KeyQ')) vTheta -= 1
    if (this.has('KeyE')) vTheta += 1
    return {
      vx: vx * this.speed.move * fine,
      vy: vy * this.speed.move * fine,
      vTheta: vTheta * this.speed.rotate * fine,
    }
  }

  /** 기울기 조작. 누르고 있는 동안 점점 기울고, 놓으면 그 각도로 남는다(센서와 같은 성격). */
  readTilt = (): KeyboardTiltVelocity => {
    if (!this.running) return { vRoll: 0, vPitch: 0 }
    const fine = this.fine
    let vRoll = 0
    let vPitch = 0
    if (this.has('KeyA')) vRoll -= 1
    if (this.has('KeyD')) vRoll += 1
    if (this.has('KeyW')) vPitch -= 1
    if (this.has('KeyS')) vPitch += 1
    return { vRoll: vRoll * this.speed.tilt * fine, vPitch: vPitch * this.speed.tilt * fine }
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.isHandled(e.code)) return
    // 방향키로 페이지가 스크롤되지 않게 막는다.
    e.preventDefault()
    this.pressed.add(e.code)
  }

  private onKeyUp = (e: KeyboardEvent) => {
    if (!this.isHandled(e.code)) return
    this.pressed.delete(e.code)
  }

  private clear = () => this.pressed.clear()

  private isHandled(code: string): boolean {
    return [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'KeyQ',
      'KeyE',
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'ShiftLeft',
      'ShiftRight',
    ].includes(code)
  }
}
