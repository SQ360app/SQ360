import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const size = parseInt(req.nextUrl.searchParams.get('size') || '192')
  const px = size === 512 ? 512 : 192
  const fontSize = px === 512 ? 140 : 52
  const subSize = px === 512 ? 64 : 24
  const radius = Math.round(px * 0.18)

  return new ImageResponse(
    (
      <div
        style={{
          width: px,
          height: px,
          background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 60%, #2563eb 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius,
          fontFamily: 'sans-serif',
          gap: px === 512 ? 8 : 3,
        }}
      >
        <span
          style={{
            color: '#ffffff',
            fontSize,
            fontWeight: 900,
            letterSpacing: px === 512 ? -4 : -1.5,
            lineHeight: 1,
          }}
        >
          SQ360
        </span>
        <span
          style={{
            color: '#93c5fd',
            fontSize: subSize,
            fontWeight: 600,
            letterSpacing: px === 512 ? 6 : 2,
            textTransform: 'uppercase',
          }}
        >
          EDILE
        </span>
      </div>
    ),
    { width: px, height: px }
  )
}
