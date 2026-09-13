import { useSearchParams } from 'react-router-dom'
import { fetchCourse } from '@/api'
import { IMPLEMENTED_COURSE_ID } from '@/data/courses'
import { Loaded } from '@/components/LoadState'
import { EmptyState } from '@/components/ui'
import { useApi } from '@/lib/useApi'
import { AlignmentExercise } from './exercises/AlignmentExercise'
import { JudgmentExercise } from './exercises/JudgmentExercise'

/**
 * 실습 화면 입구. 과정의 `exerciseType` 으로 어떤 실습을 띄울지 고른다.
 * 화면 URL(`/attempts/new`)은 유형과 상관없이 하나다.
 */
export function Practice() {
  // 경로는 하나(`/attempts/new`)로 두고 어떤 과정인지만 쿼리로 받는다.
  // 값이 없으면 지금까지처럼 정렬 실습 과정을 연다.
  const [params] = useSearchParams()
  const courseId = params.get('courseId') ?? IMPLEMENTED_COURSE_ID
  const state = useApi(() => fetchCourse(courseId), [courseId])

  return (
    <Loaded state={state} label="실습 설정을 불러오는 중입니다">
      {(course) => {
        if (!course) {
          return (
            <EmptyState
              title="실습 설정을 불러올 수 없습니다"
              description="과정 데이터를 찾지 못했습니다."
            />
          )
        }
        if (course.exerciseType === 'judgment') {
          return course.scenario ? (
            <JudgmentExercise course={course} />
          ) : (
            <EmptyState
              title="실습 설정을 불러올 수 없습니다"
              description="과정 데이터에 시나리오가 없습니다."
            />
          )
        }
        return course.alignment ? (
          <AlignmentExercise course={course} />
        ) : (
          <EmptyState
            title="실습 설정을 불러올 수 없습니다"
            description="과정 데이터에 정렬 실습 설정이 없습니다."
          />
        )
      }}
    </Loaded>
  )
}
