import { updateProgress } from '@/api'
import type { Course, StepId } from '@/types'

/**
 * 진도 기록 — PATCH /api/enrollments/{id}/progress 를 단계마다 한 번씩 부른다.
 * 과정 `steps` 에 있는 id 만 보낸다(없는 id 는 서버가 422).
 * 서버가 같은 배정을 읽고 고쳐 쓰므로 동시에 보내지 않고 차례로 보낸다.
 * 실패해도 실습 흐름을 막지 않는다 — 경고만 남긴다.
 */
export async function completeSteps(
  course: Course,
  enrollmentId: string,
  stepIds: StepId[],
): Promise<void> {
  const known = new Set(course.steps.map((s) => s.id))
  for (const stepId of stepIds) {
    if (!known.has(stepId)) continue
    try {
      await updateProgress(enrollmentId, stepId, true)
    } catch (e: unknown) {
      console.warn('[wme] 진도를 기록하지 못했습니다.', stepId, e)
    }
  }
}
