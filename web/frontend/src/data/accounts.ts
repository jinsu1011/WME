import type { Role } from '@/types'

/**
 * 데모 로그인 계정. 실제 인증이 아니며 비밀번호 검증은 브라우저 안에서만 일어난다.
 * 발표 시연을 위해 계정을 화면에 그대로 안내한다.
 */
export interface DemoAccount {
  id: string
  password: string
  role: Role
  /** 이 계정이 어떤 사용자 기록에 해당하는지. 이름·소속은 데이터 계층에서 읽는다. */
  userId: string
  roleLabel: string
  roleDesc: string
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: '1',
    password: '1',
    role: 'learner',
    userId: 'u-1',
    roleLabel: '신입사원',
    roleDesc: '과정을 배정받아 연습하고 피드백을 확인합니다',
  },
  {
    id: '2',
    password: '2',
    role: 'instructor',
    userId: 'u-instructor',
    roleLabel: '매니저',
    roleDesc: '담당 인원의 학습 현황과 성취도를 확인합니다',
  },
]

export function roleLabel(role: Role): string {
  return DEMO_ACCOUNTS.find((a) => a.role === role)?.roleLabel ?? '사용자'
}
