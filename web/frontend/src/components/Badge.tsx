import type { ReactNode } from 'react'
import type { Availability, DataSource, InputDevice } from '@/types'

const TONES = {
  ok: 'bg-ok-50 text-ok-500 ring-ok-500/20',
  warn: 'bg-warn-50 text-warn-500 ring-warn-500/20',
  alert: 'bg-alert-50 text-alert-500 ring-alert-500/20',
  brand: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  muted: 'bg-muted-50 text-muted-500 ring-slate-400/20',
} as const

export type Tone = keyof typeof TONES

export function Badge({
  tone = 'muted',
  children,
}: {
  tone?: Tone
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}

const AVAILABILITY_META: Record<Availability, { label: string; tone: Tone }> = {
  available: { label: '실습 가능', tone: 'ok' },
  preview: { label: '미리보기', tone: 'brand' },
  coming_soon: { label: '준비 중', tone: 'muted' },
}

export function AvailabilityBadge({ value }: { value: Availability }) {
  const meta = AVAILABILITY_META[value]
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}

/** 측정 데이터의 출처. 합성 데이터를 실측처럼 보이게 하지 않기 위해 항상 표시한다. */
/**
 * 기록의 출처. 시연용 예시와 학습자가 실제로 남긴 기록을 섞어 보여주지 않는다.
 * 실습 유형이 둘 이상이므로 조작 장치를 뜻하는 말은 쓰지 않는다(그건 입력 출처 배지가 맡는다).
 */
const SOURCE_META: Record<DataSource, { label: string; tone: Tone }> = {
  mock: { label: '예시 데이터', tone: 'warn' },
  replay: { label: '저장된 측정 재생', tone: 'brand' },
  live: { label: '학습자 기록', tone: 'ok' },
}

export function DataSourceBadge({ value }: { value: DataSource }) {
  const meta = SOURCE_META[value]
  return (
    <Badge tone={meta.tone}>
      <span className="size-1.5 rounded-full bg-current" />
      {meta.label}
    </Badge>
  )
}

/** 무엇으로 조작했는지. 합성·예시 기록과 구분해 항상 표시한다. */
const INPUT_META: Record<InputDevice, { label: string; tone: Tone }> = {
  keyboard: { label: '키보드 조작', tone: 'brand' },
  model_controller: { label: '모형 컨트롤러', tone: 'ok' },
}

export function InputDeviceBadge({ value }: { value: InputDevice }) {
  const meta = INPUT_META[value]
  return (
    <Badge tone={meta.tone}>
      <span className="size-1.5 rounded-full bg-current" />
      {meta.label}
    </Badge>
  )
}
