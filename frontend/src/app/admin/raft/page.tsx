// =============================================================================
// PRISM Writer - RAFT 관리자 페이지
// =============================================================================
// 파일: frontend/src/app/admin/raft/page.tsx
// 역할: 합성 데이터 생성 UI 제공 (관리자 전용)
// 생성일: 2025-12-28
//
// [Phase 1] P1-02: 관리자 페이지 라우트 생성
// [Phase 2] P2-04: SyntheticDataPanel 컴포넌트 배치
// [Q&A Review UI] RAFTDatasetList 컴포넌트 추가
// =============================================================================

import { FEATURE_FLAGS } from '@/config/featureFlags'
import { Metadata } from 'next'
import SyntheticDataPanel from '@/components/admin/SyntheticDataPanel'
import RAFTDatasetList from '@/components/admin/RAFTDatasetList'

// =============================================================================
// 페이지 메타데이터
// =============================================================================

export const metadata: Metadata = {
  title: 'RAFT 관리 | PRISM Writer',
  description: 'RAFT 파인튜닝을 위한 합성 데이터 생성 관리',
}

// =============================================================================
// 메인 페이지 컴포넌트 (서버 컴포넌트)
// =============================================================================

/**
 * RAFT 관리자 페이지
 * 
 * @description
 * - Feature Flag로 접근 제어
 * - 합성 데이터 생성 패널 제공
 * - 생성된 Q&A 목록 검토 및 삭제 기능
 * 
 * [접근 조건]
 * - ENABLE_RAFT_FEATURES=true 환경 변수 필요
 */
export default function RaftAdminPage({ 
  searchParams 
}: { 
  searchParams: { category?: string } 
}) {
  // ---------------------------------------------------------------------------
  // Feature Flag 확인 (서버에서 환경 변수 접근)
  // ---------------------------------------------------------------------------
  if (!FEATURE_FLAGS.ENABLE_RAFT_FEATURES) {
    return (
      <main className="container mx-auto p-8">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
          RAFT 관리
        </h1>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200">
            ⚠️ RAFT 기능이 비활성화되었습니다.
          </p>
          <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">
            기능을 활성화하려면 환경 변수에 <code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">ENABLE_RAFT_FEATURES=true</code>를 설정하세요.
          </p>
        </div>
      </main>
    )
  }

  // ---------------------------------------------------------------------------
  // 환경 변수 및 파라미터 준비 (P2-01, P2-02)
  // ---------------------------------------------------------------------------
  // 개발 모드 인증 우회 여부 (서버 환경 변수 -> 클라이언트 전달)
  const isDevMode = process.env.SKIP_RAFT_AUTH === 'true'
  // URL 쿼리 파라미터로 초기 카테고리 설정 (?category=...)
  const initialCategory = searchParams.category

  // ---------------------------------------------------------------------------
  // 활성화 상태: SyntheticDataPanel + RAFTDatasetList 렌더링
  // ---------------------------------------------------------------------------
  return (
    <main className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        RAFT 관리
        {isDevMode && (
          <span className="ml-3 text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full align-middle">
            Dev Mode (Auth Skipped)
          </span>
        )}
      </h1>
      
      {/* 합성 데이터 생성 패널 (Props 전달) */}
      <SyntheticDataPanel 
        isDevMode={isDevMode}
        initialCategory={initialCategory}
      />
      
      {/* 생성된 Q&A 목록 (검토 및 삭제) */}
      <RAFTDatasetList />
    </main>
  )
}

