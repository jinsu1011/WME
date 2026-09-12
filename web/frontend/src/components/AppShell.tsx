import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { product, tenant } from '@/data/tenant'
import { roleLabel } from '@/data/accounts'
import { useDemo } from '@/lib/demo'
import type { Role } from '@/types'

interface NavItem {
  to: string
  label: string
  roles: Role[]
  end?: boolean
}

/** 왼쪽 탭. 역할별로 필요한 것만 보여준다. */
const NAV: NavItem[] = [
  { to: '/learn', label: '실습', roles: ['learner'], end: true },
  { to: '/learn/status', label: '현재 상황', roles: ['learner'] },
  { to: '/learn/courses', label: '과정', roles: ['learner'] },
  { to: '/learn/records', label: '기록', roles: ['learner'] },
  { to: '/instructor', label: '교육 현황', roles: ['instructor'], end: true },
  { to: '/instructor/learners', label: '학습자', roles: ['instructor'] },
]

export function AppShell() {
  const { role } = useDemo()
  const items = NAV.filter((i) => role !== null && i.roles.includes(role))

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[216px_1fr]">
      <Sidebar items={items} />
      <div className="flex min-h-dvh min-w-0 flex-col">
        <TopBar items={items} />
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
          <Outlet />
        </main>
        <footer className="mx-auto w-full max-w-5xl px-6 pb-8 text-[11px] leading-relaxed text-slate-400">
          {tenant.demoNotice} 로그인은 데모 탐색 기능이며 인증·권한 구현이 아닙니다.
        </footer>
      </div>
    </div>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-[13px] font-bold text-white">
        {product.initials}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-bold tracking-tight text-slate-900">
            {product.name}
          </span>
          {product.nameIsProvisional && (
            <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] font-medium text-slate-400">
              가칭
            </span>
          )}
        </div>
        <div className="truncate text-[11px] text-slate-400">{tenant.programTitle}</div>
      </div>
    </div>
  )
}

function Sidebar({ items }: { items: NavItem[] }) {
  const { pathname } = useLocation()

  return (
    <aside className="sticky top-0 hidden h-dvh flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="flex h-16 items-center border-b border-slate-100 px-5">
        <Brand />
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const active = item.end ? pathname === item.to : pathname.startsWith(item.to)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-600/10'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t border-slate-100 p-3">
        <div className="rounded-lg bg-slate-50 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="grid size-5 place-items-center rounded bg-slate-700 text-[9px] font-bold text-white">
              {tenant.logoInitials}
            </span>
            <span className="truncate text-xs font-semibold text-slate-700">
              {tenant.companyName}
            </span>
          </div>
          <div className="mt-1 text-[10px] text-slate-400">{tenant.industryLabel} · 가상 고객사</div>
        </div>
      </div>
    </aside>
  )
}

function TopBar({ items }: { items: NavItem[] }) {
  const { role, currentUser, signOut } = useDemo()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-6">
        <div className="lg:hidden">
          <Brand />
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="text-right">
            <div className="text-[13px] font-medium text-slate-800">
              {currentUser.displayName}
              <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                {role ? roleLabel(role) : ''}
              </span>
            </div>
            <div className="text-[11px] text-slate-400">{currentUser.department}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              signOut()
              navigate('/login', { replace: true })
            }}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* 좁은 화면에서는 왼쪽 탭을 가로 탭으로 내린다 */}
      <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 lg:hidden">
        {items.map((item) => {
          const active = item.end ? pathname === item.to : pathname.startsWith(item.to)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${
                active ? 'bg-brand-50 text-brand-700' : 'text-slate-500'
              }`}
            >
              {item.label}
            </NavLink>
          )
        })}
      </nav>
    </header>
  )
}
