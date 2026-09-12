// 업종·고객사에 의존하는 값은 전부 이 파일에 모은다.
// 다른 업종(2차전지, 디스플레이, 정밀가공 등)에 납품하면 이 파일과 courses.ts만 교체한다.
// 화면 컴포넌트에는 "반도체", "웨이퍼" 같은 단어를 직접 쓰지 않는다.

export interface TenantConfig {
  id: string
  companyName: string
  companyShortName: string
  industryLabel: string
  logoInitials: string
  programTitle: string
  terms: {
    asset: string
    assetShort: string
    mask: string
    aligner: string
    mockup: string
    trainingCenter: string
    technician: string
  }
  demoNotice: string
}

export const tenant: TenantConfig = {
  id: 'demo-hynix',
  companyName: 'SK 하이닉수',
  companyShortName: '하이닉수',
  industryLabel: '반도체 포토공정',
  logoInitials: 'SK',
  programTitle: '장비기술 사내교육',
  terms: {
    asset: '웨이퍼',
    assetShort: '웨이퍼',
    mask: '마스크',
    aligner: '수동 마스크 얼라이너',
    mockup: '웨이퍼 모형',
    trainingCenter: '기술교육센터',
    technician: '신입·전환배치 기술자',
  },
  demoNotice:
    '미니 프로젝트 데모 환경입니다. 고객사와 학습자 기록은 시연용 가상 데이터입니다.',
}

/** 제품(플랫폼) 정보 — 고객사가 바뀌어도 그대로다. */
export const product = {
  name: 'WME',
  fullName: 'We Make Experts',
  /** 서비스명이 확정되어 '가칭' 배지를 내렸다. */
  nameIsProvisional: false,
  initials: 'W',
  tagline: '기술을 배우고, 실습으로 확인한다',
  category: '장비 운용 기업을 위한 사내 기술교육 플랫폼',
} as const
