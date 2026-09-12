import { Link } from 'react-router-dom'
import { fetchCourse } from '@/api'
import { tenant } from '@/data/tenant'
import { Badge, DataSourceBadge } from '@/components/Badge'
import { Card, CardHeader, EmptyState, PageHeader } from '@/components/ui'

/**
 * 실습 화면(F4)의 골격.
 * 센서를 아직 연결하지 않았으므로 "연결됨"을 흉내 내지 않고 실제 상태를 표시한다.
 */
export function Practice() {
  const course = fetchCourse('stage-anomaly')!

  return (
    <>
      <PageHeader
        eyebrow={course.title}
        title="연습"
        description="측정 → 동작 종료 표시 → 안정화 구간 관찰 → 근거 선택 → 판단 제출"
        actions={<DataSourceBadge value="mock" />}
      />

      <Stepper steps={course.steps.map((s) => s.title)} current={2} />

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="측정 그래프"
              subtitle="기준 기록과 현재 측정을 같은 시간축에 겹쳐 표시할 영역"
            />
            <EmptyState
              title="센서가 연결되지 않았습니다"
              description="측정 보드를 USB로 연결하면 실시간 그래프가 표시됩니다. 지금은 장치가 없어 측정을 시작할 수 없습니다."
            />
          </Card>

          <Card>
            <CardHeader title="판단 제출" subtitle="근거 구간을 고르고 확인할 항목과 이유를 적습니다" />
            <fieldset disabled className="space-y-4 opacity-60">
              <div>
                <div className="mb-2 text-[11px] font-medium text-slate-400">근거 구간</div>
                <div className="rounded-lg border border-dashed border-slate-200 px-3.5 py-3 text-[12px] text-slate-400">
                  측정이 끝나면 이상 후보 구간이 여기에 나타나고, 클릭해서 근거로 선택합니다.
                </div>
              </div>
              <div>
                <div className="mb-2 text-[11px] font-medium text-slate-400">먼저 확인할 항목</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {course.checkItems.map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-not-allowed items-start gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5"
                    >
                      <input type="radio" name="check" className="mt-1" />
                      <span>
                        <span className="block text-[12.5px] font-medium text-slate-700">{c.label}</span>
                        <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-400">
                          {c.hint}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-[11px] font-medium text-slate-400">판단 이유</div>
                <textarea
                  rows={3}
                  placeholder="관측한 사실과 그 근거로 무엇을 먼저 확인할지 적습니다."
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-[13px] text-slate-700 placeholder:text-slate-300"
                />
              </div>
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
              >
                답변 제출
              </button>
            </fieldset>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="장치 상태" aside={<Badge tone="alert">연결 안 됨</Badge>} />
            <dl className="space-y-2.5 text-[13px]">
              <Row label="측정 보드" value="미연결" />
              <Row label="수신 속도" value="—" />
              <Row label="기준 기록" value="미등록" />
              <Row label="데이터 출처" value="예시 데이터" />
            </dl>
            <p className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] leading-relaxed text-slate-400">
              센서를 확보하기 전까지는 측정을 시작할 수 없습니다. 화면은 연결된 것처럼 보이게 하지
              않습니다.
            </p>
          </Card>

          <Card>
            <CardHeader title="실습 장치" />
            <div className="grid place-items-center rounded-lg bg-slate-50 py-7">
              <div className="relative grid size-28 place-items-center rounded-lg border-2 border-slate-300 bg-white">
                <div className="size-16 rounded-full border-2 border-slate-300 bg-slate-50" />
                <span className="absolute -bottom-1 right-2 rounded bg-slate-700 px-1.5 py-0.5 text-[9px] font-medium text-white">
                  센서
                </span>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              {tenant.terms.mockup}을 올린 실습 판의 개념도입니다. 측정된 이동 경로를 재현한 그림이
              아닙니다.
            </p>
          </Card>

          <Card>
            <CardHeader title="지금 할 일" />
            <ol className="space-y-2 text-[12.5px] leading-relaxed text-slate-600">
              <li>1. 센서 부착과 모형 고정 상태를 확인합니다.</li>
              <li>2. 판을 천천히 움직인 뒤 멈춥니다.</li>
              <li>3. 멈춘 즉시 ‘동작 종료’를 누릅니다.</li>
              <li>4. 종료 이후 구간의 그래프를 관찰합니다.</li>
            </ol>
            <Link
              to={`/courses/${course.id}`}
              className="mt-4 block text-[12px] font-medium text-brand-700 hover:underline"
            >
              대기방으로 돌아가기
            </Link>
          </Card>
        </div>
      </div>
    </>
  )
}

function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5">
      {steps.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'todo'
        return (
          <li
            key={label}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-medium ${
              state === 'active'
                ? 'bg-brand-600 text-white'
                : state === 'done'
                  ? 'bg-brand-50 text-brand-700'
                  : 'bg-white text-slate-400 ring-1 ring-slate-200'
            }`}
          >
            <span
              className={`grid size-4.5 place-items-center rounded-full text-[10px] ${
                state === 'active'
                  ? 'bg-white/20'
                  : state === 'done'
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100'
              }`}
            >
              {state === 'done' ? '✓' : i + 1}
            </span>
            {label}
          </li>
        )
      })}
    </ol>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-700">{value}</dd>
    </div>
  )
}
