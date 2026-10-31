# SQ360 — Variabili d'ambiente Vercel

Configurare in Vercel → Settings → Environment Variables.

## Supabase
NEXT_PUBLIC_SUPABASE_URL=         (Supabase → Settings → API → Project URL)
NEXT_PUBLIC_SUPABASE_ANON_KEY=    (Supabase → Settings → API → anon/public key)
SUPABASE_SERVICE_ROLE_KEY=        (Supabase → Settings → API → service_role key)
                                  ⚠️ Richiesto da /api/invite-user (inviti) e /api/register (nuova azienda)

## Supabase → Authentication → URL Configuration (non è una variabile)
Site URL:       https://sq-360-8ek9.vercel.app   (o il dominio definitivo)
Redirect URLs:  https://sq-360-8ek9.vercel.app/auth/conferma
                (aggiungere anche ogni altro dominio da cui si usa l'app, es. https://sq360.app/auth/conferma)
I link di invito e recupero password puntano a <dominio della richiesta>/auth/conferma:
se l'indirizzo non è nella lista, Supabase rimanda al Site URL.

## AI
GEMINI_API_KEY=                   (Google AI Studio)

## Email (Resend)
RESEND_API_KEY=                   (Resend → API Keys)
CRON_SECRET=                      (stringa casuale — protegge /api/cron/durc)

## App
(NEXT_PUBLIC_APP_URL non è più usata: i link usano il dominio della richiesta. Si può togliere da Vercel.)

## Mappe (opzionale)
NEXT_PUBLIC_MAPBOX_TOKEN=         (Mapbox → Tokens; senza token mostra banner di errore, non crasha)
