// =============================================================================
// PRISM Writer - Analytics Provider (Client Component)
// =============================================================================
// 파일: frontend/src/components/analytics/AnalyticsProvider.tsx
// 역할: Vercel Analytics를 클라이언트 사이드에서만 로드
// [Performance] 초기 번들에서 제외하여 hydration 후 로드
// =============================================================================

'use client'

import { Analytics } from '@vercel/analytics/react'

/**
 * Analytics Provider Component
 *
 * @description
 * 'use client' 지시어로 클라이언트 컴포넌트로 분리하여
 * 서버 컴포넌트인 layout.tsx에서 안전하게 사용 가능
 */
export default function AnalyticsProvider() {
  return <Analytics />
}
