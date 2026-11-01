// ─── Report tests/report/ISOLAMENTO.md da isolamento-prima.json / -dopo.json ─
import fs from 'node:fs'
import path from 'node:path'
import { REPORT_DIR } from '../lib/ambiente.mjs'
import { FIGLIE } from '../lib/classificazione.mjs'

const OPS = ['letto', 'modificato', 'inserito', 'eliminato']
const SN = v => (v === true ? '**sì**' : v === false ? 'no' : '—')

/** Cosa deve poter fare l'admin di A sulle PROPRIE righe dopo la correzione (null = non provato) */
export function atteso(tipo, t) {
  if (tipo === 'utenti') return { letto: true, modificato: true, inserito: null, eliminato: false }
  if (tipo === 'riga_azienda') return { letto: true, modificato: true, inserito: false, eliminato: false }
  if (tipo === 'audit') return { letto: true, modificato: false, inserito: true, eliminato: false }
  if (tipo === 'bloccata') return { letto: false, modificato: false, inserito: false, eliminato: false }
  if (tipo === 'globale_lettura' || tipo === 'globale_invariata') return { letto: true, modificato: false, inserito: false }
  void t
  return { letto: true, modificato: true, inserito: true, eliminato: true }
}

function causa(r, t) {
  const c = []
  if (!r.rls) c.push('RLS spenta')
  for (const p of r.regole) {
    const q = `${p.qual ?? ''} ${p.check ?? ''}`
    if (p.qual === 'true' || p.check === 'true') c.push(`regola "${p.nome}" USING true`)
    else if (/auth\.role\(\)\s*=\s*'authenticated'/.test(q)) c.push(`regola "${p.nome}": basta il login`)
  }
  if (!c.length && FIGLIE[t]) c.push(`eredita dalla madre \`${FIGLIE[t].padre}\` (aperta)`)
  if (!c.length && r.regole.length === 0 && r.rls) c.push('RLS attiva senza regole')
  return c.join('; ') || '?'
}

const fuga = r => OPS.some(o => r.attacco[o]?.esito === true)

export function scriviReport() {
  const leggi = n => { const f = path.join(REPORT_DIR, `isolamento-${n}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null }
  const prima = leggi('prima'), dopo = leggi('dopo')
  let md = '# SQ360 — Test di isolamento tra aziende\n\n'
  md += '> Progetto di **prova** (`sq360-test`), dati inventati. Utente: admin di *Alfa Costruzioni* (A) contro i dati di *Beta Edilizia* (B), '
  md += 'con le stesse API e regole dell\'app. Ogni esito è verificato nel database (letto = riga restituita; modificato = versione della riga cambiata; '
  md += 'inserito = riga creata con i dati di B; eliminato = riga sparita, o fermata solo da un vincolo FK). "—" = non applicabile o non provato.\n\n'
  const righe = []

  for (const [nome, ris] of [['PRIMA della correzione', prima], ['DOPO la correzione (migrazione 20261101_isolamento_aziende.sql)', dopo]]) {
    if (!ris) continue
    const T = ris.tabelle
    const tabAz = Object.entries(T).filter(([, r]) => Object.keys(r.attacco).length)
    const conFuga = tabAz.filter(([, r]) => fuga(r))
    const contaOp = o => tabAz.filter(([, r]) => r.attacco[o]?.esito === true).length
    const vFuga = Object.entries(ris.viste).filter(([, v]) => v.esito)
    let legitKo = []
    for (const [t, r] of Object.entries(T)) {
      const att = atteso(r.tipo, t)
      for (const o of OPS) if (att[o] !== undefined && att[o] !== null && r.legittimo[o] && r.legittimo[o].esito !== null && r.legittimo[o].esito !== att[o]) legitKo.push(`${t}.${o}`)
    }
    md += `## ${nome}\n\nData: ${ris.data}\n\n`
    md += `- Tabelle di azienda provate: **${tabAz.length}** · con dati di B raggiungibili da A: **${conFuga.length}**\n`
    md += `  - lette: ${contaOp('letto')} · modificate: ${contaOp('modificato')} · inserite come B: ${contaOp('inserito')} · eliminate: ${contaOp('eliminato')}\n`
    md += `- Viste che mostrano dati di B ad A: **${vFuga.length}**${vFuga.length ? ' (' + vFuga.map(([v]) => '`' + v + '`').join(', ') + ')' : ''}\n`
    const u = T.utenti
    if (u?.tecnico) md += `- Utente NON admin di A: modifica un collega ${SN(u.tecnico.modifica_collega.esito)}, modifica sé stesso ${SN(u.tecnico.modifica_se_stesso.esito)} · admin di A si sposta nell'azienda B: ${SN(u.spostamento_in_B.esito)}\n`
    md += `- Funzioni legittime di A (sulle proprie righe) diverse dall'atteso: **${legitKo.length}**${legitKo.length ? ' — ' + legitKo.map(x => '`' + x + '`').join(', ') : ''}\n\n`
    md += '| Tabella | Tipo | Letto | Modificato | Inserito come B | Eliminato | A sulle proprie righe (L M I E) | Causa / nota |\n|---|---|---|---|---|---|---|---|\n'
    for (const [t, r] of Object.entries(T).sort(([a], [b]) => a.localeCompare(b))) {
      const att = atteso(r.tipo, t)
      const leg = OPS.map(o => {
        const e = r.legittimo[o]?.esito
        if (e === undefined || e === null) return `${o[0].toUpperCase()}·`
        const ok = att[o] === undefined || att[o] === null || att[o] === e
        return `${o[0].toUpperCase()}${e ? '✓' : '✗'}${ok ? '' : '⚠'}`
      }).join(' ')
      const note = fuga(r) ? causa(r, t) : (OPS.map(o => r.attacco[o]?.nota).filter(Boolean)[0] || '')
      const a = o => SN(r.attacco[o]?.esito)
      md += `| \`${t}\` | ${r.tipo} | ${a('letto')} | ${a('modificato')} | ${a('inserito')} | ${a('eliminato')} | ${leg} | ${String(note).replace(/\|/g, '/').slice(0, 160)} |\n`
    }
    md += '\n**Viste**\n\n| Vista | Mostra dati di B ad A | Righe di B nel DB | A vede le proprie righe (viste/nel DB) | Opzioni |\n|---|---|---|---|---|\n'
    for (const [v, x] of Object.entries(ris.viste)) md += `| \`${v}\` | ${SN(x.esito)} | ${x.righe_b_nel_db ?? '—'} | ${x.righe_a_nel_db === undefined ? '—' : `${x.righe_a_viste}/${x.righe_a_nel_db} ${x.righe_a_viste === x.righe_a_nel_db ? '✓' : '⚠'}`} | ${x.opz || 'senza security_invoker (salta le RLS)'} |\n`
    md += '\nLegenda "A sulle proprie righe": ✓ riuscito · ✗ bloccato · · non provato · ⚠ diverso da quanto previsto per quel tipo di tabella.\n\n'
    const altri = new Set()
    for (const [t, r] of Object.entries(T)) for (const lato of ['attacco', 'legittimo']) for (const o of OPS)
      if (r[lato][o]?.altro) altri.add(`| \`${t}\` | ${lato === 'attacco' ? 'A su B' : 'A su A'} | ${o} | ${String(r[lato][o].nota).replace(/\|/g, '/')} |`)
    if (altri.size) md += '**Errori non dovuti ai permessi** (l\'operazione è fallita per altri motivi: su quella cella il test non è conclusivo)\n\n| Tabella | Chi | Operazione | Errore |\n|---|---|---|---|\n' + [...altri].sort().join('\n') + '\n\n'
    righe.push(`${nome}: ${conFuga.length} tabelle e ${vFuga.length} viste con dati di B raggiungibili; funzioni legittime fuori attesa: ${legitKo.length}`)
  }
  fs.writeFileSync(path.join(REPORT_DIR, 'ISOLAMENTO.md'), md)
  return righe.join('\n')
}
