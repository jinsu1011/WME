import type { ReactNode } from 'react'
import { API_MODE } from '@/api'
import { Badge } from './Badge'
import { Card } from './ui'

/** 불러오는 중 표시. 뼈대만 보여주고 가짜 숫자를 채우지 않는다. */
export function Loading({ label = '불러오는 중입니다' }: { label?: string }) {
  return (
    <Card className="border-dashed">
      <div className="flex items-center gap-2.5">
        <span className="size-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
        <span className="text-[13px] text-slate-500">{label}</span>
      </div>
    </Card>
  )
}

/**
 * 불러오기 실패 표시. 원인을 숨기지 않고 그대로 보여주고 다시 시도할 수 있게 한다.
 * server 모드에서는 서버가 떠 있는지도 함께 안내한다.
 */
export function LoadError({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <Card className="border-alert-500/30 bg-alert-50/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[13px] font-semibold text-slate-800">데이터를 불러오지 못했습니다</div>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{message}</p>
          {API_MODE === 'server' && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
              실습 서버(localhost:8000)가 실행 중인지 확인해 주세요. 서버 없이 보려면 화면을 mock
              모드로 실행합니다.
            </p>
          )}
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            다시 시도
          </button>
        )}
      </div>
    </Card>
  )
}

/** 지금 어느 구현으로 동작하는지 화면에 밝힌다. 데이터 출처를 숨기지 않는다. */
export function ApiModeBadge() {
  return API_MODE === 'server' ? (
    <Badge tone="ok">실습 서버 연결</Badge>
  ) : (
    <Badge tone="warn">서버 미연결 · 시연용 기록</Badge>
  )
}

/** 로딩·실패·성공을 한 번에 처리한다. */
export function Loaded<T>({
  state,
  children,
  label,
}: {
  state: { data: T | null; loading: boolean; error: string | null; reload: () => void }
  children: (data: T) => ReactNode
  label?: string
}) {
  if (state.error) return <LoadError message={state.error} onRetry={state.reload} />
  if (state.loading || state.data === null) return <Loading label={label} />
  return <>{children(state.data)}</>
}
