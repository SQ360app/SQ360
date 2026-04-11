import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Middleware minimale - solo passthrough
// La protezione avviene lato client nel dashboard layout
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
