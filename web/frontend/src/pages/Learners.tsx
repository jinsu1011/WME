import { instructorOverview } from '@/api'
import { Card, PageHeader } from '@/components/ui'
import { LearnerTable } from './Instructor'

export function Learners() {
  const rows = instructorOverview()
  return (
    <>
      <PageHeader
        title="학습자"
        description="배정된 교육생의 진행 상태입니다. 이름을 누르면 개인별 성취도로 이동합니다."
      />
      <Card padded={false}>
        <LearnerTable rows={rows} />
      </Card>
    </>
  )
}
