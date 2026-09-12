import type { AlignmentSettings, Sample } from '@/types'
import { viz } from '@/charts/theme'
import { positionError } from '@/lib/alignment'

const SIZE = 320
const C = SIZE / 2
/** 고정 마크(사각 프레임) 한 변의 절반 */
const BOX = 44
/** 움직이는 마크(십자선) 팔 길이의 절반 */
const ARM = 34

/**
 * 정렬 마크 화면. 고정된 프레임 안에 십자선을 넣는 전형적인 정렬 마크 모양이다.
 * 마크 이름·문구는 전부 props 로 받는다(업종 문구는 데이터에만 둔다).
 */
export function AlignmentView({
  dx,
  dy,
  dTheta,
  settings,
  within,
  trail,
}: {
  dx: number
  dy: number
  dTheta: number
  settings: AlignmentSettings
  within: boolean
  /** 지나온 경로. 있으면 옅게 함께 그린다. */
  trail?: Sample[]
}) {
  const movingColor = within ? viz.good : viz.series1
  const trailPath =
    trail && trail.length > 1
      ? trail.map((s, i) => `${i === 0 ? 'M' : 'L'} ${C + s.dx} ${C + s.dy}`).join(' ')
      : null

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={`고정 마크 기준 남은 오차 X ${dx.toFixed(1)}, Y ${dy.toFixed(1)} 화면 단위, 회전 ${dTheta.toFixed(1)}도`}
      className="w-full"
    >
      {/* 시야 */}
      <circle cx={C} cy={C} r={settings.fieldRadius + 12} fill="#fbfbfa" stroke={viz.grid} />
      <line x1={C} y1={16} x2={C} y2={SIZE - 16} stroke={viz.grid} strokeDasharray="3 5" />
      <line x1={16} y1={C} x2={SIZE - 16} y2={C} stroke={viz.grid} strokeDasharray="3 5" />

      {/* 허용 오차 범위 — 과정 설정값 */}
      <rect
        x={C - settings.tolerancePx}
        y={C - settings.tolerancePx}
        width={settings.tolerancePx * 2}
        height={settings.tolerancePx * 2}
        fill={within ? 'rgba(12,163,12,0.18)' : 'none'}
        stroke={within ? viz.good : viz.tick}
        strokeWidth={1.5}
        strokeDasharray="2 2"
      />

      {/* 고정 마크 — 사각 프레임 */}
      <g stroke={viz.baseline} fill="none" strokeWidth={5}>
        <rect x={C - BOX} y={C - BOX} width={BOX * 2} height={BOX * 2} rx={2} />
      </g>
      <g stroke={viz.baseline} strokeWidth={3}>
        <line x1={C - BOX - 14} y1={C} x2={C - BOX - 4} y2={C} />
        <line x1={C + BOX + 4} y1={C} x2={C + BOX + 14} y2={C} />
        <line x1={C} y1={C - BOX - 14} x2={C} y2={C - BOX - 4} />
        <line x1={C} y1={C + BOX + 4} x2={C} y2={C + BOX + 14} />
      </g>

      {/* 지나온 경로 */}
      {trailPath && (
        <path d={trailPath} fill="none" stroke={viz.series1} strokeOpacity={0.25} strokeWidth={1.5} />
      )}

      {/* 움직이는 마크 — 십자선 */}
      <g transform={`translate(${C + dx} ${C + dy}) rotate(${dTheta})`}>
        <line x1={-ARM} y1={0} x2={ARM} y2={0} stroke={movingColor} strokeWidth={6} strokeLinecap="round" />
        <line x1={0} y1={-ARM} x2={0} y2={ARM} stroke={movingColor} strokeWidth={6} strokeLinecap="round" />
        <circle cx={0} cy={0} r={5} fill="#fff" stroke={movingColor} strokeWidth={3} />
        {/* 회전 방향을 읽을 수 있게 한쪽 팔에만 표식을 둔다 */}
        <circle cx={ARM - 2} cy={0} r={3.5} fill={movingColor} />
      </g>

      {within && (
        <circle cx={C} cy={C} r={BOX + 26} fill="none" stroke={viz.good} strokeWidth={2} strokeDasharray="6 6" />
      )}
    </svg>
  )
}

/** 마크 색·모양이 무엇을 뜻하는지 글로 함께 둔다. 색만으로 뜻을 싣지 않는다. */
export function AlignmentLegend({
  settings,
  within,
}: {
  settings: AlignmentSettings
  within: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-4 rounded" style={{ background: viz.baseline }} />
        {settings.markLabels.fixed} (고정)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block h-0.5 w-4 rounded"
          style={{ background: within ? viz.good : viz.series1 }}
        />
        {settings.markLabels.moving} (조작){within ? ' · 허용 오차 안' : ''}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block size-2.5 rounded-sm border border-dashed border-slate-400" />
        허용 범위 ±{settings.tolerancePx}px · ±{settings.toleranceDeg}°
      </span>
    </div>
  )
}

/** 남은 오차 숫자 표시. 색이 아니라 숫자와 글로 상태를 말한다. */
export function ErrorReadout({
  dx,
  dy,
  dTheta,
  settings,
  within,
}: {
  dx: number
  dy: number
  dTheta: number
  settings: AlignmentSettings
  within: boolean
}) {
  const posOk = positionError(dx, dy) <= settings.tolerancePx
  const rotOk = Math.abs(dTheta) <= settings.toleranceDeg
  return (
    <div className="grid grid-cols-3 gap-2">
      <Cell label="X 오차" value={`${dx >= 0 ? '+' : ''}${dx.toFixed(1)}`} unit="px" ok={posOk} />
      <Cell label="Y 오차" value={`${dy >= 0 ? '+' : ''}${dy.toFixed(1)}`} unit="px" ok={posOk} />
      <Cell
        label="회전 오차"
        value={`${dTheta >= 0 ? '+' : ''}${dTheta.toFixed(1)}`}
        unit="°"
        ok={rotOk}
      />
      <div className="col-span-3 text-[11px] font-medium">
        {within ? (
          <span className="text-ok-500">허용 오차 안 — 정렬을 확정할 수 있습니다</span>
        ) : (
          <span className="text-slate-400">
            허용 오차 밖 — 위치 오차 {positionError(dx, dy).toFixed(1)}px
          </span>
        )}
      </div>
    </div>
  )
}

function Cell({
  label,
  value,
  unit,
  ok,
}: {
  label: string
  value: string
  unit: string
  ok: boolean
}) {
  return (
    <div
      className={`rounded-lg border px-2.5 py-2 ${
        ok ? 'border-ok-500/30 bg-ok-50/60' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-0.5">
        <span className="text-[17px] font-bold tabular-nums text-slate-900">{value}</span>
        <span className="text-[11px] text-slate-400">{unit}</span>
      </div>
      <div className="text-[10px] text-slate-400">{ok ? '기준 안' : '기준 밖'}</div>
    </div>
  )
}
