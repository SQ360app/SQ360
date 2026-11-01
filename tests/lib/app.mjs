// ─── Avvio dell'app locale (next dev) collegata alla PROVA ───────────────────
// Le variabili di prova sono passate nel processo: Next non le sovrascrive con
// quelle di .env.local. Se l'app risponde già sulla porta, la riusa SOLO se
// dichiara di essere collegata alla prova (controllo su /api/xpwe-parse non serve:
// verifichiamo l'URL Supabase servito nella pagina di login).
import { spawn } from 'node:child_process'
import { ROOT, PORTA, envApp, SUPABASE_URL, refTest } from './ambiente.mjs'

const BASE = `http://localhost:${PORTA}`

async function risponde() {
  try { const r = await fetch(`${BASE}/login`, { redirect: 'manual' }); return r.status < 500 ? r : null } catch { return null }
}

/** Avvia (o riusa) l'app di prova. Restituisce { base, ferma() } */
export async function avviaApp({ log = false } = {}) {
  if (await risponde()) {
    // l'app già attiva deve essere quella di prova: il bundle contiene il ref del progetto
    const html = await (await fetch(`${BASE}/login`)).text()
    const js = [...html.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map(m => m[1])
    let trovato = false
    for (const s of js) { const t = await (await fetch(BASE + s)).text(); if (t.includes(refTest)) { trovato = true; break } }
    if (!trovato) throw new Error(`Sulla porta ${PORTA} c'è un'app che NON risulta collegata alla prova: chiudila e riprova`)
    return { base: BASE, ferma: async () => {} }
  }
  const proc = spawn(process.execPath, [ROOT + '/node_modules/next/dist/bin/next', 'dev', '-p', String(PORTA)], {
    cwd: ROOT, env: { ...process.env, ...envApp(), NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
  })
  let uscita = ''
  proc.stdout.on('data', d => { uscita += d; if (log) process.stdout.write(d) })
  proc.stderr.on('data', d => { uscita += d; if (log) process.stderr.write(d) })
  const t0 = Date.now()
  while (Date.now() - t0 < 180000) {
    if (proc.exitCode !== null) throw new Error('next dev terminato:\n' + uscita.slice(-2000).replaceAll(SUPABASE_URL, '<prova>'))
    if (await risponde()) break
    await new Promise(r => setTimeout(r, 1500))
  }
  if (!(await risponde())) { proc.kill(); throw new Error('next dev non risponde dopo 3 minuti') }
  return {
    base: BASE,
    ferma: async () => {
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' })
      else proc.kill('SIGTERM')
      await new Promise(r => setTimeout(r, 1000))
    },
  }
}
