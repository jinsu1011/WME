/**
 * 차트 공통 토큰.
 * 계열 색은 검증된 기본 팔레트에서 가져왔다(흰 배경 기준, all-pairs CVD ΔE 9.2 / normal ΔE 24.0 통과).
 * 색만으로 뜻을 전달하지 않는다 — 범례와 직접 라벨을 항상 함께 둔다.
 */
export const viz = {
  series1: '#2a78d6', // blue — 본인/주 계열
  series2: '#eb6834', // orange — 두 번째 계열이 필요할 때만
  baseline: '#8493a8', // 비교 기준선(반 평균)은 계열이 아니라 회색 참조값 (흰 배경 대비 3:1 통과)
  grid: '#e8e8e3',
  axis: '#c3c2b7',
  tick: '#8a8880',
  ink: '#0f172a',
  good: '#0ca30c',
  warning: '#fab219',
  critical: '#d03b3b',
} as const

export const axisTick = { fill: viz.tick, fontSize: 12 } as const

export const tooltipStyle = {
  contentStyle: {
    borderRadius: 10,
    border: '1px solid #e2e8f0',
    boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
    fontSize: 12,
    padding: '8px 10px',
  },
  labelStyle: { color: viz.ink, fontWeight: 600, marginBottom: 2 },
  cursor: { fill: 'rgba(15,23,42,0.04)' },
} as const

/** 달성도 구간 → 상태. 색 하나로 뜻을 싣지 않고 항상 라벨과 함께 쓴다. */
export function scoreBand(pct: number): { label: string; tone: 'ok' | 'warn' | 'alert' } {
  if (pct >= 75) return { label: '충족', tone: 'ok' }
  if (pct >= 50) return { label: '부분 충족', tone: 'warn' }
  return { label: '보완 필요', tone: 'alert' }
}
