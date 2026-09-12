import type { ReactNode } from 'react'

export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <section
      className={`rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
        padded ? 'p-5' : ''
      } ${className}`}
    >
      {children}
    </section>
  )
}

export function CardHeader({
  title,
  subtitle,
  aside,
}: {
  title: string
  subtitle?: string
  aside?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{subtitle}</p>}
      </div>
      {aside}
    </div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <div className="mb-1 text-xs font-medium tracking-wide text-slate-400">{eyebrow}</div>
        )}
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function StatTile({
  label,
  value,
  unit,
  sub,
  tone = 'default',
}: {
  label: string
  value: string | number
  unit?: string
  sub?: string
  tone?: 'default' | 'alert'
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span
          className={`text-2xl font-bold tracking-tight ${
            tone === 'alert' ? 'text-alert-500' : 'text-slate-900'
          }`}
        >
          {value}
        </span>
        {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
      </div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  )
}

export function ProgressBar({ value, showLabel = true }: { value: number; showLabel?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-600 transition-[width]"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      {showLabel && (
        <span className="w-9 text-right text-xs font-medium tabular-nums text-slate-500">
          {value}%
        </span>
      )}
    </div>
  )
}

/** 시연용 시드 데이터임을 숨기지 않는다. */
export function DemoDataNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] leading-relaxed text-slate-400">
      {children}
    </p>
  )
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center">
      <div className="text-sm font-medium text-slate-600">{title}</div>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-400">{description}</p>
    </div>
  )
}

/** 아직 만들지 않은 화면을 정직하게 표시한다. 가짜 콘텐츠로 채우지 않는다. */
export function NotBuiltYet({ what, note }: { what: string; note?: string }) {
  return (
    <Card className="border-dashed">
      <div className="text-sm font-medium text-slate-700">{what}</div>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        {note ?? '아직 구현하지 않은 화면입니다. 구현 전 상태를 그대로 표시합니다.'}
      </p>
    </Card>
  )
}
