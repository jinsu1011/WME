import type { ControllerSource, ControllerVelocity } from './types'
import { ZERO_VELOCITY } from './types'

/** 키를 얼마나 빠르게 움직임으로 바꿀지. 화면 px/초, 도/초. */
export interface KeyboardSpeed {
  move: number
  rotate: number
  /** Shift 를 누르고 있을 때 곱하는 배수 (느리게 = 1 보다 작게) */
  fineFactor: number
}

const DEFAULT_SPEED: KeyboardSpeed = { move: 90, rotate: 22, fineFactor: 0.25 }

/**
 * 지금 쓰는 컨트롤러. 방향키로 X/Y, Q/E 로 회전.
 * 키를 누르고 있는 동안 계속 움직인다(속도 방식). 누른 순간만 반응하지 않는다.
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

  read = (): ControllerVelocity => {
    if (!this.running) return ZERO_VELOCITY
    const has = (k: string) => this.pressed.has(k)
    const fine = has('Shift') ? this.speed.fineFactor : 1
    let vx = 0
    let vy = 0
    let vTheta = 0
    if (has('ArrowLeft')) vx -= 1
    if (has('ArrowRight')) vx += 1
    if (has('ArrowUp')) vy -= 1
    if (has('ArrowDown')) vy += 1
    if (has('q')) vTheta -= 1
    if (has('e')) vTheta += 1
    return {
      vx: vx * this.speed.move * fine,
      vy: vy * this.speed.move * fine,
      vTheta: vTheta * this.speed.rotate * fine,
    }
  }

  /** 지금 눌려 있는 키 목록. 화면의 조작 안내를 켜 주는 데만 쓴다. */
  activeKeys = (): string[] => [...this.pressed]

  private onKeyDown = (e: KeyboardEvent) => {
    const key = this.normalize(e.key)
    if (!key) return
    // 방향키로 페이지가 스크롤되지 않게 막는다.
    e.preventDefault()
    this.pressed.add(key)
  }

  private onKeyUp = (e: KeyboardEvent) => {
    const key = this.normalize(e.key)
    if (key) this.pressed.delete(key)
    if (key === 'Shift') this.pressed.delete('Shift')
  }

  private clear = () => this.pressed.clear()

  private normalize(key: string): string | null {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Shift'].includes(key)) return key
    const lower = key.toLowerCase()
    if (lower === 'q' || lower === 'e') return lower
    return null
  }
}
