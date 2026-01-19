/** @type {import('next').NextConfig} */
const nextConfig = {
  // ==========================================================================
  // PRISM Writer - Next.js Configuration
  // ==========================================================================

  // React Strict Mode for better development experience
  reactStrictMode: true,

  // ==========================================================================
  // [Performance] 배럴 파일 최적화
  // @heroicons/react 등 대용량 라이브러리의 트리쉐이킹 활성화
  // 효과: 콜드 스타트 200-800ms 단축, 빌드 속도 개선
  // ==========================================================================
  experimental: {
    optimizePackageImports: ['@heroicons/react'],
  },
  
  // Note: 'standalone' output removed for Vercel compatibility with dynamic pages
  // Vercel handles this automatically
  
  // Image optimization settings
  images: {
    domains: [],
    unoptimized: process.env.NODE_ENV === 'development',
  },
  
  // Environment variables exposed to the browser
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'PRISM Writer',
  },
}

module.exports = nextConfig

