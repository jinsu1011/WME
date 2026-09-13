/**
 * Web Serial 최소 타입 선언.
 * 표준 DOM 타입에 아직 들어 있지 않아 여기서만 좁게 선언한다(패키지를 늘리지 않는다).
 */
export interface SerialPortLike {
  open: (options: { baudRate: number }) => Promise<void>
  close: () => Promise<void>
  /** TextDecoderStream 에 그대로 연결한다. 바이트 종류를 좁히지 않는다. */
  readable: ReadableStream<BufferSource> | null
  writable: WritableStream<BufferSource> | null
}

interface SerialLike {
  requestPort: () => Promise<SerialPortLike>
  getPorts: () => Promise<SerialPortLike[]>
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
}

/** 크롬 계열에서만 쓸 수 있다. 없으면 화면이 이유를 표시하고 키보드로 둔다. */
export function getSerial(): SerialLike | null {
  const nav = navigator as unknown as { serial?: SerialLike }
  return nav.serial ?? null
}

/** 아두이노가 보내는 한 줄: `WME,<t_ms>,<roll>,<pitch>,<yaw>` */
export interface SerialReading {
  tMs: number
  roll: number
  pitch: number
  yaw: number
}

/**
 * 한 줄을 읽는다. 형식이 아니면 null 을 준다.
 * 부팅 메시지 등 다른 줄이 섞여 들어오므로 `WME,` 로 시작하는 줄만 쓴다.
 */
export function parseLine(line: string): SerialReading | null {
  const text = line.trim()
  if (!text.startsWith('WME,')) return null
  const parts = text.split(',')
  if (parts.length < 5) return null
  const [, t, roll, pitch, yaw] = parts
  const values = [t, roll, pitch, yaw].map((v) => Number(v))
  if (values.some((v) => !Number.isFinite(v))) return null
  return { tMs: values[0]!, roll: values[1]!, pitch: values[2]!, yaw: values[3]! }
}

/**
 * 들어오는 조각을 모아 줄 단위로 잘라 준다.
 * 줄이 중간에 끊겨 오는 것이 정상이므로 남은 조각은 다음 조각과 이어 붙인다.
 */
export class LineBuffer {
  private buffer = ''
  /** 줄바꿈 없이 계속 들어오는 쓰레기 입력으로 메모리가 늘지 않게 막는다. */
  private readonly maxLength = 8192

  push(chunk: string): string[] {
    this.buffer += chunk
    if (this.buffer.length > this.maxLength) {
      this.buffer = this.buffer.slice(-this.maxLength)
    }
    const lines: string[] = []
    let index = this.buffer.indexOf('\n')
    while (index >= 0) {
      lines.push(this.buffer.slice(0, index))
      this.buffer = this.buffer.slice(index + 1)
      index = this.buffer.indexOf('\n')
    }
    return lines
  }

  clear(): void {
    this.buffer = ''
  }
}
