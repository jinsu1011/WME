/**
 * 화면이 쓰는 유일한 데이터 접근 지점.
 *
 * `VITE_API_MODE` 로 구현을 고른다:
 *   mock   (기본) — 시드 + localStorage. 서버 없이 전부 동작한다. 발표장 백업 경로
 *   server         — FastAPI(web/backend) 호출
 *
 * 화면 코드는 `@/api` 만 import 한다. 어느 구현인지 알지 못한다.
 */
import type { ApiClient } from './contract'
import { mockApi } from './mock'
import { serverApi } from './server'

export type ApiMode = 'mock' | 'server'

const raw = (import.meta.env.VITE_API_MODE as string | undefined)?.trim()
export const API_MODE: ApiMode = raw === 'server' ? 'server' : 'mock'

const impl: ApiClient = API_MODE === 'server' ? serverApi : mockApi

export const api = impl

// 이름을 그대로 쓰던 화면 코드를 위해 개별 함수도 내보낸다.
export const listCourses = impl.listCourses
export const fetchCourse = impl.fetchCourse
export const listEnrollments = impl.listEnrollments
export const listAttempts = impl.listAttempts
export const fetchAttempt = impl.fetchAttempt
export const instructorOverview = impl.instructorOverview
export const allAttempts = impl.allAttempts
export const fetchUser = impl.fetchUser
export const statsFor = impl.statsFor
export const allLearnerStats = impl.allLearnerStats
export const updateProgress = impl.updateProgress
export const createAttempt = impl.createAttempt
export const markPhase = impl.markPhase
export const submitAnswer = impl.submitAnswer
export const requestFeedback = impl.requestFeedback
export const openAlignmentChannel = impl.openAlignmentChannel

export { clearSavedAttempts } from './mock'
export { FeedbackError } from './contract'
export type {
  AlignmentChannel,
  AlignmentState,
  ApiClient,
  ChannelHandlers,
  CreateAttemptInput,
} from './contract'
