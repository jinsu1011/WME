import { instructorOverview } from '@/api'
import { ApiModeBadge, Loaded } from '@/components/LoadState'
import { Card, PageHeader } from '@/components/ui'
import { useApi } from '@/lib/useApi'
import { LearnerTable } from './Instructor'

export function Learners() {
  const state = useApi(() => instructorOverview(), [])
  return (
    <>
      <PageHeader
        title="학습자"
        description="배정된 교육생의 진행 상태입니다. 이름을 누르면 개인별 성취도로 이동합니다."
        actions={<ApiModeBadge />}
      />
      <Loaded state={state} label="학습자 목록을 불러오는 중입니다">
        {(rows) => (
          <Card padded={false}>
            <LearnerTable rows={rows} />
          </Card>
        )}
      </Loaded>
    </>
  )
}
