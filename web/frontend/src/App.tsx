import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { Login } from '@/pages/Login'
import { PracticeList } from '@/pages/PracticeList'
import { Status } from '@/pages/Status'
import { Catalog } from '@/pages/Catalog'
import { Records } from '@/pages/Records'
import { CourseDetail } from '@/pages/CourseDetail'
import { Practice } from '@/pages/Practice'
import { Result } from '@/pages/Result'
import { Instructor } from '@/pages/Instructor'
import { Learners } from '@/pages/Learners'
import { LearnerDetail } from '@/pages/LearnerDetail'
import { useDemo } from '@/lib/demo'
import type { Role } from '@/types'

/** 로그인 전에는 어떤 화면도 열지 않는다. 데모 세션 확인일 뿐 실제 인증이 아니다. */
function RequireSession({ role: required }: { role?: Role }) {
  const { signedIn, role } = useDemo()
  if (!signedIn) return <Navigate to="/login" replace />
  if (required && role !== required) {
    return <Navigate to={role === 'instructor' ? '/instructor' : '/learn'} replace />
  }
  return <AppShell key={role ?? 'none'} />
}

export default function App() {
  const { signedIn, role } = useDemo()
  const home = role === 'instructor' ? '/instructor' : '/learn'

  return (
    <Routes>
      <Route path="/login" element={signedIn ? <Navigate to={home} replace /> : <Login />} />
      {/* 신입사원 전용 */}
      <Route element={<RequireSession role="learner" />}>
        <Route path="/learn" element={<PracticeList />} />
        <Route path="/learn/status" element={<Status />} />
        <Route path="/learn/courses" element={<Catalog />} />
        <Route path="/learn/records" element={<Records />} />
        <Route path="/courses/:courseId" element={<CourseDetail />} />
        <Route path="/attempts/new" element={<Practice />} />
      </Route>

      {/* 매니저 전용 */}
      <Route element={<RequireSession role="instructor" />}>
        <Route path="/instructor" element={<Instructor />} />
        <Route path="/instructor/learners" element={<Learners />} />
        <Route path="/instructor/learners/:learnerId" element={<LearnerDetail />} />
      </Route>

      {/* 두 역할이 함께 보는 화면 */}
      <Route element={<RequireSession />}>
        <Route index element={<Navigate to={home} replace />} />
        <Route path="/attempts/:attemptId/result" element={<Result />} />
        <Route path="*" element={<Navigate to={home} replace />} />
      </Route>
    </Routes>
  )
}
