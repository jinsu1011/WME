import type { Attempt, Feedback } from '@/types'
import { learnerSeeds } from './people'
import { getCourse, IMPLEMENTED_COURSE_ID } from './courses'

/** 데모 기준 시각. 고정해야 새로고침해도 그래프가 흔들리지 않는다. */
export const DEMO_NOW = new Date('2026-09-12T14:00:00+09:00')

function daysBefore(days: number, hour = 10): string {
  const d = new Date(DEMO_NOW)
  d.setDate(d.getDate() - days)
  d.setHours(hour, 20, 0, 0)
  return d.toISOString()
}

const CHECK_BY_LEVEL = ['sensor-mount', 'mockup-fix', 're-measure', 'report']

const REASONS = [
  '동작이 끝난 뒤에도 흔들림이 줄지 않고 이어졌습니다. 부착 상태를 먼저 확인하려고 합니다.',
  '정지 이후 구간에서 기준 기록보다 각속도 변동이 크게 남아 있어 모형 고정 상태를 확인하겠습니다.',
  '기준 대비 기울기가 한쪽으로 유지되어, 같은 조건에서 다시 측정해 반복되는지 보겠습니다.',
  '관측된 것은 안정화 구간의 잔여 진동이며, 원인은 아직 확인하지 않았습니다.',
]

function sampleFeedback(rubric: number[], seedIndex: number): Feedback {
  const total = rubric.reduce((a, b) => a + b, 0)
  return {
    generatedBy: 'mock',
    good:
      total >= 6
        ? ['관측한 사실과 아직 확인하지 않은 원인을 분리해서 설명했습니다.', '선택한 근거 구간이 설명과 실제로 연결됩니다.']
        : ['동작 종료 이후 구간을 관찰 대상으로 삼은 점이 적절합니다.'],
    improve:
      total >= 6
        ? ['관측값의 크기를 숫자로 함께 적으면 다음 점검자가 재현하기 쉽습니다.']
        : [
            '근거 구간이 설명한 현상과 어긋납니다. 흔들림이 남아 있는 구간을 다시 선택해 보세요.',
            '점검 항목을 고른 이유가 관측 내용과 연결되지 않았습니다.',
          ],
    evidenceIds: [`ev-seed-${seedIndex}`],
    nextStep:
      total >= 6
        ? '같은 조건에서 한 번 더 측정해 관측이 반복되는지 확인해 보세요.'
        : '기준 관찰 단계로 돌아가 정상 기록의 안정화 구간 모양을 다시 확인해 보세요.',
    cannotJudge: ['실제 설비의 고장 여부와 원인은 이 실습 데이터로 판단할 수 없습니다.'],
    generatedAt: daysBefore(1, 11),
  }
}

/** 시드 프로필을 실제 attempt 레코드로 펼친다. 집계는 전부 이 레코드에서 계산한다. */
export const seedAttempts: Attempt[] = learnerSeeds.flatMap((s) =>
  s.attempts.map((a, i): Attempt => {
    const submitted = a.rubric !== null
    return {
      id: `a-${s.id}-${i + 1}`,
      enrollmentId: `e-${s.id}-stage`,
      userId: s.id,
      courseId: IMPLEMENTED_COURSE_ID,
      attemptNo: i + 1,
      source: 'replay',
      status: submitted ? 'feedback_ready' : 'measured',
      startedAt: daysBefore(a.daysAgo),
      endedAt: daysBefore(a.daysAgo, 11),
      phaseMarkers: [
        { phase: 'moving', tMs: 0 },
        { phase: 'settling', tMs: 4200 },
        { phase: 'ended', tMs: 12000 },
      ],
      samples: [],
      events: [],
      summary: {
        durationMs: 12000,
        settlingDurationMs: 7800,
        maxTiltDeltaDeg: 2.4 + i * 0.3,
        peakGyroMag: 18.5 - i * 1.2,
        anomalyWindowCount: 3,
      },
      answer: submitted
        ? {
            evidenceIds: [`ev-seed-${i}`],
            checkItemId: CHECK_BY_LEVEL[i % CHECK_BY_LEVEL.length]!,
            reason: REASONS[(i + s.id.length) % REASONS.length]!,
            submittedAt: daysBefore(a.daysAgo, 11),
          }
        : null,
      feedback: submitted ? sampleFeedback(a.rubric!, i) : null,
      feedbackViewedAt: submitted ? daysBefore(a.daysAgo, 12) : null,
      rubricScores: a.rubric,
      durationSec: a.durationSec,
      courseVersion: getCourse(IMPLEMENTED_COURSE_ID)!.version,
      modelVersion: 'baseline-stats-0.1',
      settingsVersion: 'settings-0.1',
    }
  }),
)
