import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Role, User } from '@/types'
import { currentLearner, instructor } from '@/data/people'
import { DEMO_ACCOUNTS } from '@/data/accounts'

/**
 * 데모 로그인. 실제 인증 구현이 아니다.
 * 실제 서비스라면 서버 세션이 역할을 결정하고 비밀번호는 서버에서 검증한다.
 * 여기서는 발표 시연용으로 계정 2개를 고정해 둔다.
 */
interface DemoState {
  /** 로그인 전에는 null */
  role: Role | null
  currentUser: User
  signedIn: boolean
  signIn: (id: string, password: string) => boolean
  signOut: () => void
}

const DemoContext = createContext<DemoState | null>(null)
const STORAGE_KEY = 'semion.demo.session'

function readSaved(): Role | null {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'instructor' || saved === 'learner') return saved
  return null
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(readSaved)

  useEffect(() => {
    if (role) localStorage.setItem(STORAGE_KEY, role)
    else localStorage.removeItem(STORAGE_KEY)
  }, [role])

  const signIn = useCallback((id: string, password: string) => {
    const found = DEMO_ACCOUNTS.find((a) => a.id === id.trim() && a.password === password)
    if (!found) return false
    setRole(found.role)
    return true
  }, [])

  const signOut = useCallback(() => setRole(null), [])

  const value = useMemo<DemoState>(
    () => ({
      role,
      currentUser: role === 'instructor' ? instructor : currentLearner,
      signedIn: role !== null,
      signIn,
      signOut,
    }),
    [role, signIn, signOut],
  )

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}

export function useDemo(): DemoState {
  const ctx = useContext(DemoContext)
  if (!ctx) throw new Error('useDemo must be used inside <DemoProvider>')
  return ctx
}
