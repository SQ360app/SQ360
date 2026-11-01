// ─── tests/report/RISULTATI.md dal report JSON di Playwright ─────────────────
import fs from 'node:fs'
import path from 'node:path'
import { REPORT_DIR } from '../lib/ambiente.mjs'

const pulisciAnsi = s => String(s || '').replace(/\u001b\[[0-9;]*m/g, '')
const breve = s => pulisciAnsi(s).split('\n').map(x => x.trim()).filter(Boolean).filter(x => !/^at |node_modules/.test(x)).slice(0, 3).join(' · ').replace(/\|/g, '/').slice(0, 400)

export function scriviRisultati({ regoleIsolamento } = {}) {
  const json = JSON.parse(fs.readFileSync(path.join(REPORT_DIR, 'e2e-risultati.json'), 'utf8'))
  const test = []
  const visita = (suite, file) => {
    for (const s of suite.suites || []) visita(s, s.file || file)
    for (const sp of suite.specs || []) for (const t of sp.tests || []) {
      const ris = t.results?.at(-1) || {}
      // Playwright riporta le annotazioni sia sul test sia sul risultato: tolgo i doppioni
      const viste = new Set()
      const ann = [...(t.annotations || []), ...(ris.annotations || [])].filter(a => { const k = a.type + '\u0000' + a.description; if (viste.has(k)) return false; viste.add(k); return true })
      test.push({ file, titolo: sp.title, stato: ris.status || t.status, durata: ris.duration || 0, errore: ris.error?.message || ris.errors?.[0]?.message || '',
        cause: ann.filter(a => a.type === 'causa').map(a => a.description), bug: ann.filter(a => a.type === 'bug').map(a => a.description), note: ann.filter(a => a.type === 'nota').map(a => a.description), salto: ann.filter(a => a.type === 'skip').map(a => a.description) })
    }
  }
  for (const s of json.suites || []) visita(s, s.file)
  const ok = t => t.stato === 'passed'
  const saltato = t => t.stato === 'skipped'
  const passati = test.filter(ok).length, saltati = test.filter(saltato).length, falliti = test.length - passati - saltati
  const bugAnnotati = test.flatMap(t => t.bug.map(b => ({ t: t.titolo, b })))
  const icona = t => (ok(t) ? '✅' : t.stato === 'skipped' ? '⏭' : '❌')

  let md = '# SQ360 — Risultati test end-to-end\n\n'
  md += `> App locale collegata al progetto di **prova** \`sq360-test\` (dati inventati), utente admin di *Alfa Costruzioni*. `
  md += `Ogni esito è verificato nel database. AI simulata con risposte fisse (intercettazione Playwright). `
  md += `Regole di isolamento (migrazione 20261101) sulla prova: **${regoleIsolamento ? 'applicate' : 'NON applicate (come la produzione oggi)'}**.\n\n`
  md += `Data: ${new Date().toISOString()} · Comando: \`npm run test:piattaforma\`\n\n`
  md += `## Riepilogo\n\n- Test: **${test.length}** · ✅ superati **${passati}** · ❌ falliti **${falliti}** · ⏭ non eseguibili nella prova **${saltati}**\n- Bug annotati durante test superati: **${bugAnnotati.length}**\n\n`
  md += '| Esito | Test | Durata | Causa probabile / dettaglio |\n|---|---|---|---|\n'
  for (const t of test) {
    const dett = ok(t) ? [...t.note].join(' · ') : saltato(t) ? t.salto.join(' · ') : [t.cause.join(' · ') || '', breve(t.errore)].filter(Boolean).join(' — ')
    md += `| ${icona(t)} | ${t.titolo} | ${(t.durata / 1000).toFixed(1)} s | ${dett.replace(/\|/g, '/').slice(0, 500)} |\n`
  }
  const problemi = [
    ...test.filter(t => !ok(t) && !saltato(t)).map(t => ({ t: t.titolo, testo: t.cause.join(' · ') || breve(t.errore), tipo: 'test fallito' })),
    ...bugAnnotati.map(x => ({ t: x.t, testo: x.b, tipo: 'bug annotato' })),
  ]
  md += '\n## Bug e problemi trovati (non corretti)\n\n'
  md += problemi.length ? problemi.map((p, i) => `${i + 1}. **${p.t}** (${p.tipo}): ${p.testo}`).join('\n') + '\n' : 'Nessuno.\n'
  md += '\n## Note\n\n- Artefatti dei test falliti (screenshot, trace): `tests/report/e2e-artefatti/` (escluso da git); `npx playwright show-trace <file>` per rivederli.\n'
  md += '- I passi che dipendono da uno precedente fallito ripiegano sui dati del seed (indicato nella colonna dettaglio), così il resto della catena viene provato comunque.\n'
  fs.writeFileSync(path.join(REPORT_DIR, 'RISULTATI.md'), md)
  return { totale: test.length, passati, falliti, saltati, bug: bugAnnotati.length }
}
