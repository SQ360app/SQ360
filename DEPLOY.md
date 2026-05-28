# SQ360 — Variabili d'ambiente Vercel

Configurare in Vercel → Settings → Environment Variables.

## Supabase
NEXT_PUBLIC_SUPABASE_URL=         (Supabase → Settings → API → Project URL)
NEXT_PUBLIC_SUPABASE_ANON_KEY=    (Supabase → Settings → API → anon/public key)
SUPABASE_SERVICE_ROLE_KEY=        (Supabase → Settings → API → service_role key)
                                  ⚠️ Richiesto da /api/invite-user per inviare inviti via email

## AI
GEMINI_API_KEY=                   (Google AI Studio)

## Email (Resend)
RESEND_API_KEY=                   (Resend → API Keys)
CRON_SECRET=                      (stringa casuale — protegge /api/cron/durc)

## App
NEXT_PUBLIC_APP_URL=https://sq360.app

## Mappe (opzionale)
NEXT_PUBLIC_MAPBOX_TOKEN=         (Mapbox → Tokens; senza token mostra banner di errore, non crasha)
