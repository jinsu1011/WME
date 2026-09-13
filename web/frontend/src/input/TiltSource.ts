import type { ControllerSource, ControllerVelocity } from './types'
import { ZERO_VELOCITY } from './types'
import { getSerial, LineBuffer, parseLine } from './serial'
import type { SerialPortLike } from './serial'

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

const ZERO_ATTITUDE: TiltAttitude = { roll: 0, pitch: 0, yaw: 0, hasData: false, lastAt: 0 }

export class TiltSource implements ControllerSource {
  readonly kind = 'model_controller' as const
  readonly mapping: TiltMapping

  private supported = getSerial() !== null
  private port: SerialPortLike | null = null
  private reader: ReadableStreamDefaultReader<string> | null = null
  private buffer = new LineBuffer()
  private raw = { roll: 0, pitch: 0, yaw: 0 }
  private zero: { roll: number; pitch: number; yaw: number } | null = null
  private received = false
  private lastAt = 0
  private listeners = new Set<() => void>()

  status: TiltStatus
  lastError: string | null = null

  constructor(mapping: Partial<TiltMapping> = {}) {
    this.mapping = { ...DEFAULT_TILT_MAPPING, ...mapping }
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
      await port.open({ baudRate: 115200 })
      this.port = port
      this.status = 'connected'
      this.notify()
      void this.readLoop(port)
      return true
    } catch (e: unknown) {
      // 포트를 고르지 않고 창을 닫은 경우도 여기로 온다.
      const message = e instanceof Error ? e.message : String(e)
      this.lastError = /No port selected|cancel/i.test(message)
        ? '포트를 선택하지 않았습니다. 다시 연결하거나 키보드로 진행할 수 있습니다.'
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
          this.raw = { roll: reading.roll, pitch: reading.pitch, yaw: reading.yaw }
          this.received = true
          this.lastAt = performance.now()
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
    this.received = false
    this.status = this.supported ? 'idle' : 'unsupported'
    this.notify()
  }

  /** 지금 자세를 0 으로 삼는다. 책상이 기울어 있어도 그 자세가 기준이 된다. */
  setZero = (): void => {
    this.zero = { ...this.raw }
    this.notify()
  }

  clearZero = (): void => {
    this.zero = null
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

  /** 수평(평행)이 확보됐는지. 허용 범위는 과정 설정값이다. */
  isLevel = (toleranceDeg: number): boolean => {
    const a = this.attitude()
    if (!a.hasData) return false
    return Math.abs(a.roll) <= toleranceDeg && Math.abs(a.pitch) <= toleranceDeg
  }

  /**
   * 개발 확인용 — 시리얼로 들어온 것처럼 한 줄을 밀어 넣는다.
   * 센서가 없을 때 파싱·수평 판정·패널 동작을 확인하려고 둔 것이며,
   * **화면 어디에서도 부르지 않는다.** 실측 데이터인 것처럼 쓰지 않는다.
   */
  feedLineForDev = (line: string): boolean => {
    const reading = parseLine(line)
    if (!reading) return false
    this.raw = { roll: reading.roll, pitch: reading.pitch, yaw: reading.yaw }
    this.received = true
    this.lastAt = performance.now()
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
