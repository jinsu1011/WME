import { useEffect, useRef, useState } from 'react'
import { AlignmentScene, RESET_VIEW_EVENT, supportsWebGL } from '@/three/alignmentScene'
import type { ExposureStage, StagePose } from '@/three/alignmentScene'

/**
 * 실습 화면의 주인공 — 3D 장비 뷰.
 *
 * `readPose` 는 **매 프레임 호출된다.** 리액트 상태를 거치지 않으므로
 * 키보드나 모형을 움직인 즉시 화면이 따라온다.
 *
 * WebGL 을 못 쓰는 환경에서는 아무것도 그리지 않고 `fallback` 을 대신 보여준다.
 * 화면이 깨지지 않는 것이 3D 보다 우선이다.
 */
export function AlignmentStage3D({
  readPose,
  fieldRadius,
  fallback,
  onExposureStage,
}: {
  readPose: () => StagePose
  fieldRadius: number
  /** 노광·현상 연출의 단계가 바뀌면 알려 준다. */
  onExposureStage?: (stage: ExposureStage) => void
  fallback: React.ReactNode
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)

  const stageCallbackRef = useRef(onExposureStage)
  const poseRef = useRef(readPose)
  // 최신 함수를 씬이 읽을 수 있게 보관한다(렌더 중이 아니라 렌더가 끝난 뒤에 바꾼다).
  useEffect(() => {
    poseRef.current = readPose
    stageCallbackRef.current = onExposureStage
  })
  const [failed, setFailed] = useState(!supportsWebGL())
  /** 컨텍스트를 잃으면 잠시 뒤 다시 만들어 본다. 몇 번까지만 시도한다. */
  const [attempt, setAttempt] = useState(0)
  const retriesRef = useRef(0)

  useEffect(() => {
    const host = hostRef.current
    if (!host || failed) return

    let created: AlignmentScene
    try {
      created = new AlignmentScene(host, { fieldRadius }, () => poseRef.current())
    } catch {
      // 드라이버 문제 등으로 컨텍스트를 못 만들면 2D 로 내려간다.
      // 다음 틱으로 미뤄 렌더 도중에 상태를 바꾸지 않는다.
      const timer = window.setTimeout(() => setFailed(true), 0)
      return () => window.clearTimeout(timer)
    }
    if (import.meta.env.DEV) {
      ;(window as unknown as { __wmeScene?: AlignmentScene }).__wmeScene = created
    }
    // 그래픽 컨텍스트를 잃으면(다른 탭이 많거나 드라이버 문제) 2D 뷰로 내려간다.
    // 실습이 멈추는 것보다 화면이 바뀌는 편이 낫다.
    created.onExposureStage = (stage) => stageCallbackRef.current?.(stage)
    created.onContextLost = () => {
      setFailed(true)
      if (retriesRef.current >= 2) return
      retriesRef.current += 1
      window.setTimeout(() => {
        setFailed(false)
        setAttempt((n) => n + 1)
      }, 1500)
    }
    created.start()

    const observer = new ResizeObserver(() => created.resize())
    observer.observe(host)

    return () => {
      observer.disconnect()
      created.dispose()
    }
  }, [failed, fieldRadius, attempt])

  // 화면이 떠 있는 동안에는 계속 그린다.
  // WebGL 캔버스는 그리기를 멈추면 다음 합성에서 내용이 비워질 수 있어, 멈추면 빈 화면이 된다.
  // 탭이 백그라운드일 때 쉬는 처리는 씬 안에서 한다(document.hidden).

  if (failed) {
    return (
      <div>
        {fallback}
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          이 환경에서는 3D 장비 뷰를 쓸 수 없어 현미경 뷰로 진행합니다. 실습·판정·기록은 모두
          그대로입니다. 화면을 새로 고치면 3D 뷰를 다시 시도합니다.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div
        ref={hostRef}
        className="h-[360px] w-full overflow-hidden rounded-xl bg-gradient-to-b from-slate-100 to-slate-200/70 sm:h-[420px]"
        aria-label="교육용 장비 3D 뷰 — 스테이지 위의 기판과 그 위에 떠 있는 마스크 판"
        role="img"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-[11px] text-slate-400">
          화면을 잡고 끌면 보는 각도가 바뀝니다. 장비는 움직이지 않습니다.
        </span>
        <button
          type="button"
          onClick={() => hostRef.current?.dispatchEvent(new CustomEvent(RESET_VIEW_EVENT))}
          className="shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
        >
          시점 초기화
        </button>
      </div>
    </div>
  )
}
