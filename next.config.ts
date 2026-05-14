import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb'
    }
  },
  webpack: (config) => {
    // @react-pdf/renderer uses pdfkit which tries to require canvas — not needed in browser
    config.resolve.fallback = { ...config.resolve.fallback, canvas: false }
    return config
  },
}

export default nextConfig
