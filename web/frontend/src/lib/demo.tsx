import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Role, User } from '@/types'
import { DEMO_ACCOUNTS } from '@/data/accounts'
import { fetchUser } from '@/api'

/**
 * 데모 로그인. 실제 인증 구현이 아니다.
 * 실제 서비스라면 서버 세션이 역할을 결정하고 비밀번호는 서버에서 검증한다.
 * 여기서는 발표 시연용으로 계정 2개를 고정해 둔다.
 */
interface DemoState {
  /** 로그인 전에는 null */
  role: Role | null
  /** 로그인한 사용자의 id. 화면의 모든 조회는 이 값으로 한다. */
  userId: string
  /**
   * 이름·소속. **데이터 계층에서 읽는다.**
   * 화면에 사람 정보를 따로 들고 있지 않는다(두 벌이 되면 서로 어긋난다).
   * 불러오는 중에는 null 이다.
   */
  currentUser: User | null
  signedIn: boolean
  signIn: (id: string, password: string) => boolean
  signOut: () => void
}

const DemoContext = createContext<DemoState | null>(null)
const STORAGE_KEY = 'wme.demo.session'

function readSaved(): Role | null {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'instructor' || saved === 'learner') return saved
  return null
}

function userIdFor(role: Role | null): string {
  return DEMO_ACCOUNTS.find((a) => a.role === role)?.userId ?? ''
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(readSaved)
  // 불러온 사용자와 그 id 를 함께 들고, id 가 바뀌면 렌더 중에 null 로 본다.
  // (효과 안에서 곧바로 상태를 비우면 렌더가 한 번 더 돈다)
  const [loaded, setLoaded] = useState<{ id: string; user: User | null }>({ id: '', user: null })
  const userId = userIdFor(role)
  const currentUser = loaded.id === userId ? loaded.user : null

  useEffect(() => {
    if (role) localStorage.setItem(STORAGE_KEY, role)
    else localStorage.removeItem(STORAGE_KEY)
  }, [role])

  // 이름·소속은 항상 데이터 계층에서 읽는다. 화면에 사람 정보를 따로 두지 않는다.
  useEffect(() => {
    if (!userId) return
    let alive = true
    fetchUser(userId)
      .then((u) => {
        if (alive) setLoaded({ id: userId, user: u ?? null })
      })
      .catch(() => {
        if (alive) setLoaded({ id: userId, user: null })
      })
    return () => {
      alive = false
    }
  }, [userId])

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
      userId,
      currentUser,
      signedIn: role !== null,
      signIn,
      signOut,
    }),
    [role, userId, currentUser, signIn, signOut],
  )

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}

export function useDemo(): DemoState {
  const ctx = useContext(DemoContext)
  if (!ctx) throw new Error('useDemo must be used inside <DemoProvider>')
  return ctx
}
