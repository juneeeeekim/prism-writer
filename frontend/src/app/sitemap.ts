// 디렉토리 경로: frontend/src/app/
// 파일명: sitemap.ts
// 파일 코드의 역할/설명: 공개 색인 대상 URL 목록을 Next.js metadata route로 제공한다.

import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/siteMetadata'

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl()
  const now = new Date()

  return [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]
}
