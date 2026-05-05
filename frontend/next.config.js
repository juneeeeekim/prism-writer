const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  experimental: {
    optimizePackageImports: ['@heroicons/react'],
  },

  output: 'standalone',

  images: {
    domains: [],
    unoptimized: process.env.NODE_ENV === 'development',
  },

  env: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'PRISM Writer',
  },
}

module.exports = withBundleAnalyzer(nextConfig)

