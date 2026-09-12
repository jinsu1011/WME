import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { product, tenant } from '@/data/tenant'
import { DEMO_ACCOUNTS } from '@/data/accounts'
import { useDemo } from '@/lib/demo'

/**
 * 데모 로그인 화면. 실제 인증이 아니며 비밀번호 검증은 브라우저 안에서만 일어난다.
 * 시연용 계정을 화면에 그대로 안내해 누구나 두 역할을 다 볼 수 있게 한다.
 */
export function Login() {
  const navigate = useNavigate()
  const { signIn } = useDemo()
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(nextId: string, nextPw: string) {
    const ok = signIn(nextId, nextPw)
    if (!ok) {
      setError('아이디 또는 비밀번호가 맞지 않습니다.')
      return
    }
    setError(null)
    const account = DEMO_ACCOUNTS.find((a) => a.id === nextId.trim())
    navigate(account?.role === 'instructor' ? '/instructor' : '/learn', { replace: true })
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-brand-600 text-base font-bold text-white">
            {product.initials}
          </span>
          <div className="flex items-center justify-center gap-1.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">{product.name}</h1>
            {product.nameIsProvisional && (
              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                가칭
              </span>
            )}
          </div>
          <p className="mt-1 text-[12px] font-medium tracking-wide text-slate-400">
            {product.fullName}
          </p>
          <p className="mt-2 text-[13px] text-slate-500">
            {tenant.companyName} · {tenant.programTitle}
          </p>
        </div>

        <form
          className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
          onSubmit={(e) => {
            e.preventDefault()
            submit(id, password)
          }}
        >
          <label className="block">
            <span className="text-xs font-medium text-slate-500">아이디</span>
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              autoComplete="username"
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="아이디"
            />
          </label>

          <label className="mt-4 block">
            <span className="text-xs font-medium text-slate-500">비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="비밀번호"
            />
          </label>

          {error && (
            <p className="mt-3 rounded-lg bg-alert-50 px-3 py-2 text-xs font-medium text-alert-500">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="mt-5 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            로그인
          </button>
        </form>

        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-white/60 p-4">
          <div className="text-xs font-medium text-slate-500">시연용 계정 — 눌러서 바로 입장</div>
          <div className="mt-3 space-y-2">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setId(a.id)
                  setPassword(a.password)
                  submit(a.id, a.password)
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-600">
                  {a.roleLabel.slice(0, 2)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-slate-800">
                    {a.roleLabel}
                  </span>
                  <span className="block truncate text-[11px] text-slate-400">{a.roleDesc}</span>
                </span>
                <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-500">
                  {a.id} / {a.password}
                </span>
              </button>
            ))}
          </div>
        </div>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-400">
          {tenant.demoNotice}
          <br />
          로그인은 데모 탐색 기능이며 실제 인증·권한 구현이 아닙니다.
        </p>
      </div>
    </div>
  )
}
