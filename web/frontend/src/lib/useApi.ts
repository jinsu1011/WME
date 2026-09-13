import { useCallback, useEffect, useState } from 'react'

/**
 * 화면이 데이터를 불러오는 공통 훅.
 *
 * 서버 호출은 시간이 걸리므로 화면마다 "불러오는 중 / 실패 / 성공" 세 상태가 필요하다.
 * 매 화면에 같은 코드를 쓰지 않기 위해 여기 한 곳에 모았다.
 *
 *   const { data, loading, error, reload } = useApi(() => listAttempts(userId), [userId])
 *
 * deps 가 바뀌면 다시 불러온다. 화면이 사라진 뒤 도착한 응답은 버린다.
 */
export interface ApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

export function useApi<T>(load: () => Promise<T>, deps: unknown[] = []): ApiState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    load()
      .then((value) => {
        if (!alive) return
        setData(value)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : '데이터를 불러오지 못했습니다.')
        setLoading(false)
      })
    return () => {
      alive = false
    }
    // load 함수는 매 렌더마다 새로 만들어지므로 deps 로 쓰지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  return { data, loading, error, reload }
}
