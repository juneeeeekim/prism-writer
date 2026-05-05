// 디렉토리 경로: frontend/src/app/
// 파일명: robots.ts
// 파일 코드의 역할/설명: 검색봇 접근 정책과 sitemap 위치를 Next.js metadata route로 제공한다.

import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/siteMetadata'

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl()

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/auth/'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
