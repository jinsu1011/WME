import { CONTROLLER_TEXT } from '@/data/controllerSettings'
import { viz } from '@/charts/theme'
import type { TiltAttitude } from '@/input'

/**
 * 교육용 컨트롤러(모형)의 자세를 보여주는 패널.
 *
 * 3D 라이브러리를 쓰지 않고 CSS transform 으로만 그린다.
 *   rotateX(pitch) rotateY(roll) rotateZ(yaw)
 *
 * **정렬 화면의 마크는 3D 로 기울이지 않는다.** 정렬은 평면에서 X/Y/θ 로만 일어난다.
 * 3D 표현은 이 패널에서만 쓴다.
 */
export function ControllerPanel({
  attitude,
  level,
  toleranceDeg,
}: {
  attitude: TiltAttitude
  level: boolean
  toleranceDeg: number
}) {
  const { roll, pitch, yaw, hasData } = attitude
  // 화면에서 읽기 쉽게 기울기를 조금 과장해서 보여준다(값 자체는 숫자로 따로 표시한다).
  const view = 2.2
  const transform = `rotateX(${(-pitch * view).toFixed(2)}deg) rotateY(${(roll * view).toFixed(
    2,
  )}deg) rotateZ(${yaw.toFixed(2)}deg)`

  return (
    <div
      className={`rounded-xl border px-4 py-4 transition ${
        level ? 'border-ok-500/40 bg-ok-50/40' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-slate-800">
          {CONTROLLER_TEXT.panelTitle}
        </span>
        {hasData ? (
          level ? (
            <span className="rounded-full bg-ok-50 px-2.5 py-1 text-[11px] font-semibold text-ok-500 ring-1 ring-inset ring-ok-500/30">
              평행 확보
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
              기울어짐
            </span>
          )
        ) : (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-400">
            값 없음
          </span>
        )}
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-slate-400">{CONTROLLER_TEXT.panelNote}</p>

      <div className="grid place-items-center py-2" style={{ perspective: '520px' }}>
        <div
          className="relative transition-transform duration-75"
          style={{ transformStyle: 'preserve-3d', transform }}
        >
          {/* 원판(웨이퍼 모형) */}
          <div
            className="grid size-28 place-items-center rounded-full border-2"
            style={{
              borderColor: level ? viz.good : viz.baseline,
              background: level
                ? 'radial-gradient(circle at 40% 35%, #f2fbf2, #e2f2e2)'
                : 'radial-gradient(circle at 40% 35%, #f8fafc, #e7eaef)',
            }}
          >
            {/* 축 방향 표시 — 어느 쪽이 앞인지 알 수 있게 한다 */}
            <div className="absolute h-px w-24" style={{ background: viz.axis }} />
            <div className="absolute h-24 w-px" style={{ background: viz.axis }} />
            <div
              className="absolute top-1.5 size-2 rounded-full"
              style={{ background: level ? viz.good : viz.series1 }}
            />
            <span className="absolute bottom-2 text-[9px] font-medium text-slate-400">앞</span>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Axis label="좌우 기울기" value={roll} unit="°" ok={Math.abs(roll) <= toleranceDeg} has={hasData} />
        <Axis label="앞뒤 기울기" value={pitch} unit="°" ok={Math.abs(pitch) <= toleranceDeg} has={hasData} />
        <Axis label="비틀기" value={yaw} unit="°" ok has={hasData} />
      </div>

      <p className="mt-2.5 text-[10.5px] leading-relaxed text-slate-400">
        수평 기준 ±{toleranceDeg}° · {CONTROLLER_TEXT.toleranceNote}
      </p>
    </div>
  )
}

function Axis({
  label,
  value,
  unit,
  ok,
  has,
}: {
  label: string
  value: number
  unit: string
  ok: boolean
  has: boolean
}) {
  return (
    <div
      className={`rounded-lg border px-2 py-1.5 ${
        has && ok ? 'border-ok-500/30 bg-ok-50/50' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className="flex items-baseline gap-0.5">
        <span className="text-[15px] font-bold tabular-nums text-slate-900">
          {has ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}` : '—'}
        </span>
        <span className="text-[10px] text-slate-400">{unit}</span>
      </div>
      <div className="text-[9.5px] text-slate-400">{!has ? '수신 없음' : ok ? '기준 안' : '기준 밖'}</div>
    </div>
  )
}
