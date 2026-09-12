import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
} from 'recharts'
import { axisTick, tooltipStyle, viz } from './theme'

/** 루브릭 항목별 달성도 — 본인 vs 배정 인원 평균. 값 라벨을 직접 붙인다. */
export function RubricBars({
  labels,
  mine,
  cohort,
}: {
  labels: string[]
  mine: number[]
  cohort: number[] | null
}) {
  const data = labels.map((label, i) => ({
    label,
    mine: mine[i] ?? 0,
    cohort: cohort?.[i] ?? null,
  }))

  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 44, bottom: 0, left: 0 }} barGap={2}>
        <CartesianGrid horizontal={false} stroke={viz.grid} />
        <XAxis type="number" domain={[0, 100]} tick={axisTick} tickLine={false} axisLine={false} unit="%" />
        <YAxis
          type="category"
          dataKey="label"
          tick={axisTick}
          tickLine={false}
          axisLine={{ stroke: viz.axis }}
          width={78}
        />
        <Tooltip {...tooltipStyle} formatter={(v, name) => [`${v}%`, name]} />
        <Legend
          verticalAlign="top"
          align="right"
          height={26}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: '#475569' }}
        />
        <Bar dataKey="mine" name="내 달성도" fill={viz.series1} radius={[0, 4, 4, 0]} barSize={13}>
          <LabelList dataKey="mine" position="right" formatter={(v) => `${v}%`} fontSize={11} fill="#475569" />
        </Bar>
        {cohort && (
          <Bar dataKey="cohort" name="배정 인원 평균" fill={viz.baseline} radius={[0, 4, 4, 0]} barSize={13} />
        )}
      </BarChart>
    </ResponsiveContainer>
  )
}

/** 시도별 루브릭 달성도 추이. 단일 계열이므로 범례 없이 제목이 계열을 설명한다. */
export function ScoreTrend({ data }: { data: { label: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={210}>
      <LineChart data={data} margin={{ top: 18, right: 26, bottom: 0, left: -18 }}>
        <CartesianGrid vertical={false} stroke={viz.grid} />
        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: viz.axis }} />
        <YAxis domain={[0, 100]} tick={axisTick} tickLine={false} axisLine={false} unit="%" />
        <Tooltip {...tooltipStyle} formatter={(v) => [`${v}%`, '루브릭 달성도']} />
        <ReferenceLine y={75} stroke={viz.good} strokeDasharray="4 4" strokeOpacity={0.55}
          label={{ value: '충족 기준 75%', position: 'insideTopRight', fontSize: 11, fill: '#5b7d5b' }} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={viz.series1}
          strokeWidth={2}
          dot={{ r: 4, fill: '#fff', stroke: viz.series1, strokeWidth: 2 }}
          activeDot={{ r: 6 }}
        >
          <LabelList dataKey="value" position="top" formatter={(v) => `${v}%`} fontSize={11} fill="#475569" />
        </Line>
      </LineChart>
    </ResponsiveContainer>
  )
}

/** 주차별 실습 활동. */
export function ActivityBars({ data }: { data: { label: string; attempts: number; minutes: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 14, right: 8, bottom: 0, left: -24 }}>
        <CartesianGrid vertical={false} stroke={viz.grid} />
        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: viz.axis }} />
        <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
        <Tooltip
          {...tooltipStyle}
          formatter={(v, _n, item) => [
            `${v}회 · ${(item?.payload as { minutes?: number } | undefined)?.minutes ?? 0}분`,
            '실습 시도',
          ]}
        />
        <Bar dataKey="attempts" name="실습 시도" fill={viz.series1} radius={[4, 4, 0, 0]} barSize={26}>
          <LabelList dataKey="attempts" position="top" fontSize={11} fill="#475569" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** 담당자용 — 학습자별 진도. 값 라벨을 붙여 색에만 의존하지 않는다. */
export function LearnerProgressBars({
  data,
  highlightId,
}: {
  data: { id: string; name: string; value: number }[]
  highlightId?: string
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 44, bottom: 0, left: 0 }}>
        <CartesianGrid horizontal={false} stroke={viz.grid} />
        <XAxis type="number" domain={[0, 100]} tick={axisTick} tickLine={false} axisLine={false} unit="%" />
        <YAxis
          type="category"
          dataKey="name"
          tick={axisTick}
          tickLine={false}
          axisLine={{ stroke: viz.axis }}
          width={64}
        />
        <Tooltip {...tooltipStyle} formatter={(v) => [`${v}%`, '진도']} />
        <Bar dataKey="value" name="진도" radius={[0, 4, 4, 0]} barSize={16} minPointSize={2}>
          {data.map((d) => (
            <Cell key={d.id} fill={d.id === highlightId ? viz.series2 : viz.series1} />
          ))}
          <LabelList dataKey="value" position="right" formatter={(v) => `${v}%`} fontSize={11} fill="#475569" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** 시도별 연습 시간(분). 정확도와 단위가 다르므로 차트를 따로 둔다. */
export function MinutesTrend({ data }: { data: { label: string; minutes: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={data} margin={{ top: 18, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid vertical={false} stroke={viz.grid} />
        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: viz.axis }} />
        <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} unit="분" />
        <Tooltip {...tooltipStyle} formatter={(v) => [`${v}분`, '연습 시간']} />
        <Bar dataKey="minutes" name="연습 시간" fill={viz.series1} radius={[4, 4, 0, 0]} barSize={26}>
          <LabelList dataKey="minutes" position="top" formatter={(v) => `${v}분`} fontSize={11} fill="#475569" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** 시간에 따른 남은 위치 오차(px). 허용 범위를 기준선으로 함께 그린다. */
export function ErrorTrend({
  data,
  tolerancePx,
}: {
  data: { sec: number; errorPx: number }[]
  tolerancePx: number
}) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <LineChart data={data} margin={{ top: 16, right: 16, bottom: 0, left: -20 }}>
        <CartesianGrid vertical={false} stroke={viz.grid} />
        <XAxis
          dataKey="sec"
          type="number"
          domain={[0, 'dataMax']}
          tickCount={5}
          tickFormatter={(v) => `${Math.round(Number(v))}초`}
          tick={axisTick}
          tickLine={false}
          axisLine={{ stroke: viz.axis }}
        />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} unit="px" />
        <Tooltip
          {...tooltipStyle}
          formatter={(v) => [`${Number(v).toFixed(1)}px`, '남은 위치 오차']}
          labelFormatter={(l) => `${Number(l).toFixed(1)}초`}
        />
        <ReferenceLine
          y={tolerancePx}
          stroke={viz.good}
          strokeDasharray="4 4"
          label={{
            value: `허용 범위 ${tolerancePx}px`,
            position: 'insideTopRight',
            fontSize: 11,
            fill: '#5b7d5b',
          }}
        />
        <Line
          type="monotone"
          dataKey="errorPx"
          stroke={viz.series1}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
