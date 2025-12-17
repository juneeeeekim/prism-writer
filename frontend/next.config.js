/** @type {import('next').NextConfig} */
const nextConfig = {
  // ==========================================================================
  // PRISM Writer - Next.js Configuration
  // ==========================================================================
  
  // React Strict Mode for better development experience
  reactStrictMode: true,
  
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

