import type { Role } from '@/types'

/**
 * 데모 로그인 계정. 실제 인증이 아니며 비밀번호 검증은 브라우저 안에서만 일어난다.
 * 발표 시연을 위해 계정을 화면에 그대로 안내한다.
 */
export interface DemoAccount {
  id: string
  password: string
  role: Role
  roleLabel: string
  roleDesc: string
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: '1',
    password: '1',
    role: 'learner',
    roleLabel: '신입사원',
    roleDesc: '과정을 배정받아 연습하고 피드백을 확인합니다',
  },
  {
    id: '2',
    password: '2',
    role: 'instructor',
    roleLabel: '매니저',
    roleDesc: '담당 인원의 학습 현황과 성취도를 확인합니다',
  },
]

export function roleLabel(role: Role): string {
  return DEMO_ACCOUNTS.find((a) => a.role === role)?.roleLabel ?? '사용자'
}
