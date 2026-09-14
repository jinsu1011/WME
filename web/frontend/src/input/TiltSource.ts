import type { ControllerSource, ControllerVelocity } from './types'
import { ZERO_VELOCITY } from './types'
import { getSerial, LineBuffer, parseLine } from './serial'
import type { SerialPortLike, SerialReading } from './serial'

/**
 * 센서를 붙인 교육용 모형 컨트롤러.
 *
 * **조작 매핑(HEADER 결정, 2026-09-13에 바뀜)**
 *   모형 기울기(roll/pitch) → **수평(평행) 맞추기.** 0 에 가까워져야 한다
 *   모형 비틀기(yaw)        → **회전 θ** (속도 방식)
 *   X/Y 위치                → 센서 모드에서도 **키보드 방향키**
 *
 * 접촉식 마스크 얼라이너에는 노광 전에 마스크와 웨이퍼를 평행하게 맞추는 단계가 실제로 있다.
 * 두 면이 기울어져 있으면 한쪽은 붙고 반대쪽은 떠서 결과가 위치마다 달라진다.
 * 그래서 순서가 평행 → 회전·위치 다. 모형의 기울기를 그 평행 조정에 대응시킨다.
 *
 * 회전은 **속도**다. 비튼 각도가 곧 θ 가 아니다.
 * (절대 매핑이면 모형을 책상에 내려놓는 순간 정렬이 풀린다)
 *
 * 수신 경로: **Web Serial API 로 브라우저가 USB 를 직접 읽는다.**
 * 아두이노 → 브라우저 직통이며 서버를 거치지 않는다.
 * 받는 줄: `WME,<t_ms>,<roll>,<pitch>,<yaw>` (115200 baud, 초당 약 50회)
 *
 * **안정화(2026-09-14)** — 기울기는 가속도로만 계산돼 손떨림이 그대로 들어온다.
 * 그래서 받는 즉시 (1) 축 부호를 맞추고 (2) 시간 기준으로 부드럽게 다듬고
 * (3) 수평 판정에 여유 폭을 둔다. 일정 시간 유지하면 '평행 확보 완료'로 붙잡아 두어
 * 비틀다가 생기는 작은 흔들림으로 회전이 다시 잠기지 않게 한다.
 * 이 값들은 화면 판정에만 쓰고 기록(표본)에는 들어가지 않는다.
 */
export interface TiltMapping {
  /** 이 각도(도) 안쪽 기울기는 흔들림으로 보고 무시한다 */
  deadZoneDeg: number
  /** (옛 매핑에서 쓰던 값. 지금은 기울기가 이동을 만들지 않는다) */
  gainPxPerDeg: number
  maxSpeed: number
  /** 비틀기(yaw)의 무시 구간 (도) */
  yawDeadZoneDeg: number
  /** 비틀기 1도당 초당 몇 도 회전할지 */
  yawGainDegPerDeg: number
  /** 최대 회전 속도 제한 (도/초) */
  maxSpeedDeg: number
}

/** 서버를 못 불러왔을 때의 최후 수단. 평소에는 과정 설정값(course.control)을 쓴다. */
export const DEFAULT_TILT_MAPPING: TiltMapping = {
  deadZoneDeg: 2,
  gainPxPerDeg: 12,
  maxSpeed: 160,
  yawDeadZoneDeg: 3,
  yawGainDegPerDeg: 2.5,
  maxSpeedDeg: 30,
}

/** 과정 설정값(서버 응답)을 이 어댑터의 변환 계수로 바꾼다. */
export function mappingFromControl(control: {
  deadZoneDeg: number
  gainPxPerDeg: number
  maxSpeedPx: number
  yawDeadZoneDeg: number
  yawGainDegPerDeg: number
  maxSpeedDeg: number
}): TiltMapping {
  return {
    deadZoneDeg: control.deadZoneDeg,
    gainPxPerDeg: control.gainPxPerDeg,
    maxSpeed: control.maxSpeedPx,
    yawDeadZoneDeg: control.yawDeadZoneDeg,
    yawGainDegPerDeg: control.yawGainDegPerDeg,
    maxSpeedDeg: control.maxSpeedDeg,
  }
}

/** 센서 값 안정화와 수평 판정 규칙. 값은 화면 쪽 설정(data/controllerSettings.ts)에서 넣는다. */
export interface TiltStability {
  /** 모형에 붙인 방향에 맞춘 축 부호(1 또는 -1) */
  axisSign: { roll: number; pitch: number; yaw: number }
  /** 다듬기 시간 상수(초). 0 이면 다듬지 않는다 */
  smoothingSec: { tilt: number; yaw: number }
  /** 수평으로 볼 허용 범위(도) */
  toleranceDeg: number
  /** 수평 안으로 들어온 뒤 밖으로 볼 때 더하는 여유(도) */
  exitMarginDeg: number
  /** 이 시간(ms) 동안 수평을 유지하면 평행 확보 완료 */
  holdMs: number
  /** 평행 확보 완료를 풀 기울기(도) */
  releaseDeg: number
}

export const DEFAULT_TILT_STABILITY: TiltStability = {
  axisSign: { roll: 1, pitch: 1, yaw: 1 },
  smoothingSec: { tilt: 0, yaw: 0 },
  toleranceDeg: 2,
  exitMarginDeg: 0,
  holdMs: 0,
  releaseDeg: 2,
}

export type TiltStatus = 'unsupported' | 'idle' | 'connecting' | 'connected' | 'error'

/** 영점을 뺀 상대 자세. 화면과 판정은 이 값만 본다. */
export interface TiltAttitude {
  roll: number
  pitch: number
  yaw: number
  /** 값을 한 번이라도 받았는지 */
  hasData: boolean
  /** 마지막으로 값을 받은 시각(ms, performance.now 기준) */
  lastAt: number
}

/** 수평 판정 상태 */
export interface TiltLevel {
  /** 지금 수평 범위 안인지(여유 폭 적용) */
  inside: boolean
  /** 유지 진행률 0~1. 완료면 1 */
  holdProgress: number
  /** 평행 확보 완료(유지 시간을 채웠고 아직 크게 기울이지 않음) */
  confirmed: boolean
  /** 완료된 시각(ms, performance.now 기준). 완료 전이면 0 */
  confirmedAt: number
}

const ZERO_ATTITUDE: TiltAttitude = { roll: 0, pitch: 0, yaw: 0, hasData: false, lastAt: 0 }

export class TiltSource implements ControllerSource {
  readonly kind = 'model_controller' as const
  readonly mapping: TiltMapping
  readonly stability: TiltStability

  private supported = getSerial() !== null
  private port: SerialPortLike | null = null
  private reader: ReadableStreamDefaultReader<string> | null = null
  private buffer = new LineBuffer()
  /** 부호를 맞추고 다듬은 자세(영점 적용 전) */
  private raw = { roll: 0, pitch: 0, yaw: 0 }
  private zero: { roll: number; pitch: number; yaw: number } | null = null
  private received = false
  private lastAt = 0
  private levelInside = false
  private levelSince = 0
  private confirmed = false
  private confirmedAt = 0
  private listeners = new Set<() => void>()

  status: TiltStatus
  lastError: string | null = null

  constructor(mapping: Partial<TiltMapping> = {}, stability: Partial<TiltStability> = {}) {
    this.mapping = { ...DEFAULT_TILT_MAPPING, ...mapping }
    this.stability = { ...DEFAULT_TILT_STABILITY, ...stability }
    this.status = this.supported ? 'idle' : 'unsupported'
  }

  /** 이 입력을 지금 쓸 수 있는지 = 연결까지 끝났는지 */
  get available(): boolean {
    return this.status === 'connected'
  }

  get unavailableReason(): string | undefined {
    if (this.status === 'connected') return undefined
    if (!this.supported) {
      return '이 브라우저는 USB 시리얼 연결(Web Serial)을 지원하지 않습니다. 크롬 계열 브라우저에서 열거나 키보드로 진행하세요.'
    }
    if (this.status === 'error') return this.lastError ?? '연결 중 문제가 발생했습니다.'
    if (this.status === 'connecting') return '연결하는 중입니다.'
    return '모형 컨트롤러가 연결되지 않았습니다. 아래 연결 버튼을 눌러 USB 포트를 선택하세요.'
  }

  /** 화면이 상태 변화를 알 수 있게 한다. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify = () => {
    for (const listener of this.listeners) listener()
  }

  /**
   * 이 페이지에서 지금 포트를 잡고 있는 컨트롤러.
   * 실습 화면이 다시 그려지면(화면 이동·코드 수정 반영) 새 컨트롤러가 만들어지는데,
   * 이전 것이 포트를 연 채 남아 있으면 "The port is already open" 으로 연결이 막힌다.
   * 그래서 새로 연결하기 전에 이전 것을 먼저 닫는다.
   */
  private static active: TiltSource | null = null

  /** 포트를 고르고 연결한다. 사용자가 버튼을 눌렀을 때만 부른다(브라우저가 요구한다). */
  connect = async (): Promise<boolean> => {
    const serial = getSerial()
    if (!serial) {
      this.status = 'unsupported'
      this.notify()
      return false
    }
    this.status = 'connecting'
    this.lastError = null
    this.notify()

    try {
      const port = await serial.requestPort()
      const previous = TiltSource.active
      if (previous && previous !== this) await previous.disconnect()
      await port.open({ baudRate: 115200 })
      this.port = port
      TiltSource.active = this
      this.status = 'connected'
      this.notify()
      void this.readLoop(port)
      return true
    } catch (e: unknown) {
      // 포트를 고르지 않고 창을 닫은 경우도 여기로 온다.
      const message = e instanceof Error ? e.message : String(e)
      this.lastError = /No port selected|cancel/i.test(message)
        ? '포트를 선택하지 않았습니다. 다시 연결하거나 키보드로 진행할 수 있습니다.'
        : /already open/i.test(message)
          ? '이 포트를 다른 곳에서 쓰고 있습니다. 같은 화면을 연 다른 탭이나 아두이노 IDE 시리얼 모니터를 닫은 뒤 새로고침(Cmd+Shift+R)하고 다시 연결하세요.'
          : `연결하지 못했습니다: ${message}`
      this.status = 'error'
      this.notify()
      return false
    }
  }

  private async readLoop(port: SerialPortLike): Promise<void> {
    if (!port.readable) {
      this.lastError = '포트에서 읽을 수 없습니다.'
      this.status = 'error'
      this.notify()
      return
    }
    const decoder = new TextDecoderStream()
    const piped = port.readable.pipeTo(decoder.writable).catch(() => undefined)
    const reader = decoder.readable.getReader()
    this.reader = reader
    this.buffer.clear()

    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        if (!value) continue
        for (const line of this.buffer.push(value)) {
          const reading = parseLine(line)
          if (!reading) continue // 부팅 메시지 등은 버린다
          this.ingest(reading, performance.now())
        }
      }
      // 여기까지 오면 장치가 빠졌거나 스트림이 닫힌 것이다.
      if (this.status === 'connected') {
        this.lastError = '연결이 끊어졌습니다. USB 를 다시 연결하거나 키보드로 진행하세요.'
        this.status = 'error'
        this.notify()
      }
    } catch (e: unknown) {
      this.lastError = `수신 중 끊어졌습니다: ${e instanceof Error ? e.message : String(e)}`
      this.status = 'error'
      this.notify()
    } finally {
      this.reader = null
      await piped
    }
  }

  /**
   * 한 줄을 반영한다 — 축 부호를 맞추고, 지난 값과의 시간 차만큼 부드럽게 따라가게 한다.
   * 첫 값은 그대로 쓴다(0 에서 천천히 올라오는 착시를 막는다).
   */
  private ingest(reading: SerialReading, now: number): void {
    const { axisSign, smoothingSec } = this.stability
    const next = {
      roll: reading.roll * axisSign.roll,
      pitch: reading.pitch * axisSign.pitch,
      yaw: reading.yaw * axisSign.yaw,
    }
    if (!this.received) {
      this.raw = next
    } else {
      // 탭이 잠깐 멈췄다 돌아와도 한 번에 크게 튀지 않게 간격을 자른다.
      const dt = Math.min(0.2, Math.max(0, (now - this.lastAt) / 1000))
      const follow = (tau: number) => (tau <= 0 ? 1 : 1 - Math.exp(-dt / tau))
      const kt = follow(smoothingSec.tilt)
      const ky = follow(smoothingSec.yaw)
      this.raw = {
        roll: this.raw.roll + (next.roll - this.raw.roll) * kt,
        pitch: this.raw.pitch + (next.pitch - this.raw.pitch) * kt,
        yaw: this.raw.yaw + (next.yaw - this.raw.yaw) * ky,
      }
    }
    this.received = true
    this.lastAt = now
    this.updateLevel(now)
  }

  /** 수평 판정 — 여유 폭(들어올 때 좁게, 나갈 때 넓게)과 유지 시간을 적용한다. */
  private updateLevel(now: number): void {
    const { toleranceDeg, exitMarginDeg, holdMs, releaseDeg } = this.stability
    const a = this.attitude()
    const tilt = Math.max(Math.abs(a.roll), Math.abs(a.pitch))
    const limit = this.levelInside ? toleranceDeg + exitMarginDeg : toleranceDeg
    const inside = tilt <= limit
    if (inside && !this.levelInside) this.levelSince = now
    this.levelInside = inside

    if (this.confirmed) {
      if (tilt > releaseDeg) {
        this.confirmed = false
        this.confirmedAt = 0
        this.notify()
      }
    } else if (inside && now - this.levelSince >= holdMs) {
      this.confirmed = true
      this.confirmedAt = now
      this.notify()
    }
  }

  /** 기준(영점)이 바뀌면 수평 판정을 처음부터 다시 한다. */
  private resetLevel(): void {
    this.levelInside = false
    this.levelSince = 0
    this.confirmed = false
    this.confirmedAt = 0
  }

  disconnect = async (): Promise<void> => {
    try {
      await this.reader?.cancel()
    } catch {
      // 이미 닫힌 경우는 무시한다.
    }
    try {
      await this.port?.close()
    } catch {
      // 같은 이유로 무시한다.
    }
    this.port = null
    if (TiltSource.active === this) TiltSource.active = null
    this.received = false
    this.resetLevel()
    this.status = this.supported ? 'idle' : 'unsupported'
    this.notify()
  }

  /** 지금 자세를 0 으로 삼는다. 책상이 기울어 있어도 그 자세가 기준이 된다. */
  setZero = (): void => {
    this.zero = { ...this.raw }
    this.resetLevel()
    this.notify()
  }

  clearZero = (): void => {
    this.zero = null
    this.resetLevel()
    this.notify()
  }

  get zeroed(): boolean {
    return this.zero !== null
  }

  /** 영점을 뺀 상대 자세 */
  attitude = (): TiltAttitude => {
    if (!this.received) return ZERO_ATTITUDE
    const z = this.zero ?? { roll: 0, pitch: 0, yaw: 0 }
    return {
      roll: this.raw.roll - z.roll,
      pitch: this.raw.pitch - z.pitch,
      yaw: this.raw.yaw - z.yaw,
      hasData: true,
      lastAt: this.lastAt,
    }
  }

  /** 수평 판정 상태. 유지 진행률은 부를 때의 시각으로 계산한다. */
  level = (): TiltLevel => {
    if (!this.received) return { inside: false, holdProgress: 0, confirmed: false, confirmedAt: 0 }
    const { holdMs } = this.stability
    const progress = this.confirmed
      ? 1
      : this.levelInside
        ? holdMs <= 0
          ? 1
          : Math.min(1, (performance.now() - this.levelSince) / holdMs)
        : 0
    return {
      inside: this.levelInside,
      holdProgress: progress,
      confirmed: this.confirmed,
      confirmedAt: this.confirmedAt,
    }
  }

  /**
   * 개발 확인용 — 시리얼로 들어온 것처럼 한 줄을 밀어 넣는다.
   * 센서가 없을 때 파싱·수평 판정·패널 동작을 확인하려고 둔 것이며,
   * **화면 어디에서도 부르지 않는다.** 실측 데이터인 것처럼 쓰지 않는다.
   */
  feedLineForDev = (line: string): boolean => {
    const reading = parseLine(line)
    if (!reading) return false
    this.ingest(reading, performance.now())
    if (this.status !== 'connected') {
      this.status = 'connected'
      this.lastError = null
    }
    this.notify()
    return true
  }

  start = () => {
    // 연결은 사용자가 버튼으로 한다. 여기서 따로 할 일이 없다.
  }

  stop = () => {
    // 실습을 멈춰도 연결은 유지한다. 끊으려면 disconnect() 를 부른다.
  }

  /**
   * 회전(θ)만 만든다. **기울기는 이동을 만들지 않는다.**
   * X/Y 는 센서 모드에서도 키보드가 담당한다.
   */
  read = (): ControllerVelocity => {
    const a = this.attitude()
    if (!a.hasData) return ZERO_VELOCITY
    return { vx: 0, vy: 0, vTheta: this.yawToVelocity(a.yaw) }
  }

  /** 비틀기 → 회전 속도. 무시 구간을 빼고 계수를 곱한 뒤 최대치를 넘지 않게 한다. */
  yawToVelocity = (yaw: number): number => {
    const { yawDeadZoneDeg, yawGainDegPerDeg, maxSpeedDeg } = this.mapping
    const over = Math.abs(yaw) - yawDeadZoneDeg
    if (over <= 0) return 0
    const v = Math.sign(yaw) * over * yawGainDegPerDeg
    return Math.max(-maxSpeedDeg, Math.min(maxSpeedDeg, v))
  }
}
