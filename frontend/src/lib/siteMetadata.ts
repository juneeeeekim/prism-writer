// 디렉토리 경로: frontend/src/lib/
// 파일명: siteMetadata.ts
// 파일 코드의 역할/설명: SEO 메타데이터, robots, sitemap에서 사용할 기준 사이트 URL을 계산한다.

const DEFAULT_SITE_URL = 'https://prism-writer.com'

export function getSiteUrl(): string {
  const rawUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL_URL ||
    DEFAULT_SITE_URL

  const urlWithProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`

  try {
    return new URL(urlWithProtocol).origin
  } catch {
    return DEFAULT_SITE_URL
  }
}
