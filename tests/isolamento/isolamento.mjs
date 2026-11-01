#!/usr/bin/env node
// ─── SQ360 — test di isolamento tra aziende (A contro B) ─────────────────────
// Uso: node tests/isolamento/isolamento.mjs <etichetta>     (es. prima / dopo)
// Richiede il seed appena eseguito (tests/.state/seed.json). SOLO progetto di prova.
//
// Con il login dell'admin di A (stesse API e stesse RLS dell'app), su OGNI tabella:
//   attacco  → legge, modifica, inserisce "come B" ed elimina righe di B
//   legittimo → le stesse operazioni sulle righe di A (devono riuscire dove previsto)
// Ogni esito è verificato nel DATABASE, non dalla risposta dell'API:
//   letto      = l'API ha restituito la riga
//   modificato = la versione della riga (xmin) è cambiata (si riscrive lo stesso valore)
//   inserito   = la nuova riga esiste nel DB (poi viene rimossa)
//   eliminato  = la riga non esiste più nel DB (o il DB l'avrebbe cancellata: blocco solo da FK)
// Lascia il DB "sporco": prima di un nuovo giro rilanciare il seed.
// Output: tests/report/isolamento-<etichetta>.json + rigenera tests/report/ISOLAMENTO.md
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { apriDb, comeUtente, leggiStato, REPORT_DIR, pulisci } from '../lib/ambiente.mjs'
import { leggiCatalogo, ordineTopologico } from '../lib/catalogo.mjs'
import { diAzienda } from '../lib/classificazione.mjs'
import { scriviReport } from './report.mjs'

const etichetta = process.argv[2] || 'prova'
const CAMPIONE = 2
const stato = leggiStato()
const db = await apriDb()
const { tabelle, cls, viste } = await leggiCatalogo(db)
const A = await comeUtente(stato.credenziali.A_admin.email, stato.credenziali.A_admin.password)
const tecnicoChiave = Object.keys(stato.credenziali).find(k => k.startsWith('A_') && k !== 'A_admin')
const TEC = await comeUtente(stato.credenziali[tecnicoChiave].email, stato.credenziali[tecnicoChiave].password)
console.log(`Isolamento "${etichetta}": ${Object.keys(tabelle).length} tabelle, ${viste.length} viste`)

const where = (pk, vals, a = 'x') => pk.map((p, i) => `${a}."${p}" = $${i + 1}`).join(' AND ')
const match = (pk, vals) => Object.fromEntries(pk.map((p, i) => [p, vals[i]]))
const esiste = async (t, pk, vals) => (await db.query(`SELECT 1 FROM public."${t}" x WHERE ${where(pk, vals)}`, vals)).rowCount > 0
const versione = async (t, pk, vals) => (await db.query(`SELECT x.xmin::text v FROM public."${t}" x WHERE ${where(pk, vals)}`, vals)).rows[0]?.v
const codice = e => (e ? `${e.code || ''} ${e.message || ''}`.trim().slice(0, 120) : '')

function colonnaDaRiscrivere(t) {
  const T = tabelle[t]
  const ok = T.colonne.filter(c => !c.generata && !T.pk.includes(c.n))
  return (ok.find(c => /^(text|character)/.test(c.tipo) && !T.fk[c.n] && !['azienda_id', 'commessa_id'].includes(c.n)) ||
          ok.find(c => !T.fk[c.n] && !['azienda_id', 'commessa_id'].includes(c.n)) || ok[0])?.n
}

async function leggi(client, t, pk, righe) {
  let letto = false, errore = ''
  for (const vals of righe) {
    const { data, error } = await client.from(t).select(pk.join(',')).match(match(pk, vals))
    if (error) errore = codice(error); else if (data?.length) letto = true
  }
  return { esito: letto, nota: errore }
}
async function modifica(client, t, pk, righe) {
  const col = colonnaDaRiscrivere(t)
  if (!col) return { esito: null, nota: 'nessuna colonna modificabile' }
  let fatto = false, errore = ''
  for (const vals of righe) {
    const { rows: [r] } = await db.query(`SELECT to_jsonb(x."${col}") v FROM public."${t}" x WHERE ${where(pk, vals)}`, vals)
    if (!r) continue
    const prima = await versione(t, pk, vals)
    const { error } = await client.from(t).update({ [col]: r.v }).match(match(pk, vals))
    if (error) errore = codice(error)
    if ((await versione(t, pk, vals)) !== prima) fatto = true
  }
  // errore non dovuto ai permessi (trigger, vincolo…) → non conclusivo, ma segnalato
  if (!fatto && errore && !/42501|row-level security|permission denied/i.test(errore)) return { esito: null, nota: errore, altro: true }
  return { esito: fatto, nota: errore }
}
async function inserisciCopia(client, t, pk, vals) {
  const T = tabelle[t]
  if (!(pk.length === 1 && pk[0] === 'id')) return { esito: null, nota: 'chiave composta: non provato' }
  const { rows: [r] } = await db.query(`SELECT to_jsonb(x) v FROM public."${t}" x WHERE ${where(pk, vals)}`, vals)
  if (!r) return { esito: null, nota: 'riga di origine assente' }
  const riga = r.v
  for (const c of T.colonne) if (c.generata) delete riga[c.n]
  const nuovoId = randomUUID(); riga.id = nuovoId
  for (const u of T.unici) for (const c of u) {
    const col = T.colonne.find(x => x.n === c)
    if (!col || T.fk[c] || c === 'id') continue
    if (/^(text|character)/.test(col.tipo)) riga[c] = `${riga[c] ?? ''}~${nuovoId.slice(0, 6)}`.slice(-(col.lung || 999))
    else if (/smallint/.test(col.tipo)) riga[c] = Math.floor(Math.random() * 20000) + 10000
    else if (/int|numeric/.test(col.tipo)) riga[c] = Math.floor(Math.random() * 900000) + 100000
  }
  if (t === 'utenti') return { esito: null, nota: 'id legato ad auth.users: provato a parte' }
  const { error } = await client.from(t).insert(riga)
  const creato = await esiste(t, ['id'], [nuovoId])
  if (creato) await db.query(`DELETE FROM public."${t}" WHERE id = $1`, [nuovoId])
  const nota = error ? codice(error) : ''
  // errore non dovuto ai permessi (vincolo, tipo…) → il test non è conclusivo
  if (!creato && error && !/42501|row-level security|permission denied/i.test(nota)) return { esito: null, nota, altro: true }
  return { esito: creato, nota }
}
async function elimina(client, t, pk, righe) {
  let fatto = false, soloFk = false, errore = ''
  for (const vals of righe) {
    if (!(await esiste(t, pk, vals))) continue
    const { error } = await client.from(t).delete().match(match(pk, vals))
    if (error) { errore = codice(error); if (error.code === '23503') soloFk = true }
    if (!(await esiste(t, pk, vals))) fatto = true
  }
  return { esito: fatto || soloFk, nota: soloFk && !fatto ? 'il DB avrebbe eliminato: fermato solo da un vincolo FK' : errore }
}

// ── Esecuzione ───────────────────────────────────────────────────────────────
const risultati = {}
const ordine = ordineTopologico(tabelle, cls)
for (const t of ordine) {
  const c = cls[t], pk = tabelle[t].pk, r = stato.righe[t]
  const B = r.B.slice(0, CAMPIONE), Aa = r.A.slice(0, CAMPIONE)
  const ris = risultati[t] = { tipo: c.tipo, rls: tabelle[t].rls, regole: tabelle[t].regole.map(p => ({ nome: p.nome, cmd: p.cmd, qual: p.qual, check: p.with_check })), attacco: {}, legittimo: {} }
  if (diAzienda(c) && B.length) {
    ris.attacco.letto = await leggi(A.client, t, pk, B)
    ris.attacco.modificato = await modifica(A.client, t, pk, B)
    ris.attacco.inserito = await inserisciCopia(A.client, t, pk, B[0])
  }
  const proprie = diAzienda(c) ? Aa : null
  if (proprie?.length) {
    ris.legittimo.letto = await leggi(A.client, t, pk, proprie)
    ris.legittimo.modificato = await modifica(A.client, t, pk, proprie)
    ris.legittimo.inserito = t === 'utenti' ? { esito: null, nota: 'creati solo dal server' } : await inserisciCopia(A.client, t, pk, proprie[0])
  } else if (!diAzienda(c)) {
    const { rows } = await db.query(`SELECT ${pk.map(p => `x."${p}"`).join(', ')} FROM public."${t}" x LIMIT 1`)
    const g = rows.map(x => pk.map(p => x[p]))
    if (g.length) {
      ris.legittimo.letto = await leggi(A.client, t, pk, g)
      ris.legittimo.modificato = await modifica(A.client, t, pk, g)
      ris.legittimo.inserito = await inserisciCopia(A.client, t, pk, g[0])
    }
  }
}
// viste: A interroga le righe che riguardano la commessa/azienda di B
const risViste = {}
for (const v of viste) {
  const col = v.cols.includes('commessa_id') ? 'commessa_id' : v.cols.includes('azienda_id') ? 'azienda_id' : v.cols.includes('id') && v.t === 'v_commesse_kpi' ? 'id' : null
  if (!col) { risViste[v.t] = { esito: null, nota: 'nessuna colonna per riconoscere B', opz: v.opz }; continue }
  const val = col === 'azienda_id' ? stato.aziende.B.id : stato.aziende.B.commessa
  const { count: nDb } = { count: (await db.query(`SELECT count(*)::int n FROM public."${v.t}" WHERE "${col}" = $1`, [val])).rows[0].n }
  const { data, error } = await A.client.from(v.t).select(col).eq(col, val)
  // funzione legittima: A deve continuare a vedere le PROPRIE righe nella vista
  const valA = col === 'azienda_id' ? stato.aziende.A.id : stato.aziende.A.commessa
  const nA = (await db.query(`SELECT count(*)::int n FROM public."${v.t}" WHERE "${col}" = $1`, [valA])).rows[0].n
  const { data: dA } = await A.client.from(v.t).select(col).eq(col, valA)
  risViste[v.t] = { esito: (data?.length || 0) > 0, righe_b_nel_db: nDb, righe_a_nel_db: nA, righe_a_viste: dA?.length || 0, nota: codice(error), opz: v.opz }
}

// utenti: un NON admin di A non deve poter modificare utenti (né sé stesso)
{
  const pk = ['id']
  const colleghi = stato.righe.utenti.A.filter(v => v[0] !== TEC.userId).slice(0, 1)
  risultati.utenti.tecnico = {
    modifica_collega: colleghi.length && (await esiste('utenti', pk, colleghi[0])) ? await modifica(TEC.client, 'utenti', pk, colleghi) : { esito: null, nota: 'nessun collega' },
    modifica_se_stesso: await modifica(TEC.client, 'utenti', pk, [[TEC.userId]]),
  }
  // admin di A: spostarsi nell'azienda B deve essere impossibile
  const prima = (await db.query('SELECT azienda_id FROM public.utenti WHERE id = $1', [A.userId])).rows[0]?.azienda_id
  const { error } = await A.client.from('utenti').update({ azienda_id: stato.aziende.B.id }).eq('id', A.userId)
  const dopo = (await db.query('SELECT azienda_id FROM public.utenti WHERE id = $1', [A.userId])).rows[0]?.azienda_id
  if (dopo !== prima) await db.query('UPDATE public.utenti SET azienda_id = $1 WHERE id = $2', [prima, A.userId])
  risultati.utenti.spostamento_in_B = { esito: dopo === stato.aziende.B.id, nota: codice(error) }
}

// eliminazioni per ultime, dalle figlie alle madri: prima le righe di B, poi quelle di A
for (const t of [...ordine].reverse()) {
  const c = cls[t], pk = tabelle[t].pk, r = stato.righe[t]
  if (diAzienda(c) && r.B.length) risultati[t].attacco.eliminato = await elimina(A.client, t, pk, r.B.slice(0, CAMPIONE))
}
for (const t of [...ordine].reverse()) {
  const c = cls[t], pk = tabelle[t].pk, r = stato.righe[t]
  if (diAzienda(c) && r.A.length) risultati[t].legittimo.eliminato = await elimina(A.client, t, pk, r.A.slice(0, CAMPIONE))
}

fs.mkdirSync(REPORT_DIR, { recursive: true })
fs.writeFileSync(path.join(REPORT_DIR, `isolamento-${etichetta}.json`), JSON.stringify({ etichetta, data: new Date().toISOString(), tabelle: risultati, viste: risViste }, null, 2))
const esito = scriviReport()
console.log(pulisci(esito))
await db.end()
