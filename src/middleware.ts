import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Rotte pubbliche
  if (pathname.startsWith('/login') || pathname.startsWith('/api') || pathname.startsWith('/_next')) {
    return NextResponse.next()
  }

  // Leggi il token di sessione dal cookie
  const accessToken = request.cookies.get('sb-access-token')?.value ||
    request.cookies.get(`sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0]}-auth-token`)?.value

  // Se non c'è token → redirect login
  if (!accessToken) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/dashboard'],
}
