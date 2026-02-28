import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: [],
  },
  env: {
    JWT_SECRET: process.env.JWT_SECRET || 'ai-receptionist-jwt-secret-change-in-production',
  },
}

export default nextConfig
