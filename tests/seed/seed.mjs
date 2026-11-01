#!/usr/bin/env node
// ─── SQ360 — seed del progetto di PROVA ──────────────────────────────────────
// Uso: node tests/seed/seed.mjs            (svuota la prova e la ripopola)
//
// SOLO progetto di prova (blocchi in tests/lib/ambiente.mjs). Crea:
//   • aziende "Alfa Costruzioni" (A) e "Beta Edilizia" (B), dati inventati
//   • utenti: admin A, tecnico A (non admin), admin B — confermati, nessuna email inviata
//   • fornitori (DURC valido / in scadenza / scaduto), lavoratori, una commessa per azienda
//   • A: computo importato dall'XPWE (SEED_XPWE_PATH) tramite /api/xpwe-parse dell'app locale
//     B: piccolo computo manuale
//   • RDA → RDO → ODA → DDT → fattura passiva, SAL con voci, documenti PDF sintetici
//     (contratto, DDT, fattura, DURC, POS, preventivo) caricati nello storage di prova
//   • almeno una riga di A e una di B in OGNI tabella di azienda (riempitivo automatico),
//     così il test di isolamento ha sempre qualcosa da provare a leggere
// Importi e nomi di A e B sono diversi. Stato (id, credenziali di prova) in tests/.state/seed.json
// (escluso da git). Le password sono generate a ogni esecuzione e non vengono stampate.
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID, randomBytes } from 'node:crypto'
import { apriDb, admin, comeUtente, scriviStato, XPWE, pulisci, maschera, refTest } from '../lib/ambiente.mjs'
import { leggiCatalogo, ordineTopologico } from '../lib/catalogo.mjs'
import { proprietario, diAzienda } from '../lib/classificazione.mjs'
import { avviaApp } from '../lib/app.mjs'
import { creaPdf } from './pdf.mjs'

const DOMINIO = 'sq360-prova.example'   // dominio riservato: nessuna email può arrivare davvero
const t0 = Date.now()
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a)

const db = await apriDb()
const sb = admin()
const { tabelle, enumMap, cls } = await leggiCatalogo(db)
log(`Prova ${maschera(refTest)}: ${Object.keys(tabelle).length} tabelle`)

// ── 1. Svuotamento (solo prova) ──────────────────────────────────────────────
await db.query(`TRUNCATE ${Object.keys(tabelle).map(t => `public."${t}"`).join(', ')} RESTART IDENTITY CASCADE`)
for (let pagina = 1; ; pagina++) {
  const { data, error } = await sb.auth.admin.listUsers({ page: pagina, perPage: 200 })
  if (error) throw new Error(pulisci(error.message))
  const nostri = data.users.filter(u => u.email?.endsWith('@' + DOMINIO))
  for (const u of nostri) await sb.auth.admin.deleteUser(u.id)
  if (data.users.length < 200) break
}
async function svuotaBucket(bucket, prefisso = '') {
  const { data } = await sb.storage.from(bucket).list(prefisso, { limit: 1000 })
  for (const o of data || []) {
    const p = prefisso ? `${prefisso}/${o.name}` : o.name
    if (o.id) await sb.storage.from(bucket).remove([p]); else await svuotaBucket(bucket, p)
  }
}
for (const b of ['documenti', 'aziende-assets']) await svuotaBucket(b)
log('Prova svuotata (tabelle public, utenti @' + DOMINIO + ', storage)')

// ── 2. Strumenti di inserimento ──────────────────────────────────────────────
const AZ = {
  A: { chiave: 'A', id: randomUUID(), ragione: 'Alfa Costruzioni S.r.l. (PROVA)', breve: 'Alfa', pref: 'ALFA', piva: '99999999901', k: 1 },
  B: { chiave: 'B', id: randomUUID(), ragione: 'Beta Edilizia S.p.A. (PROVA)', breve: 'Beta', pref: 'BETA', piva: '99999999902', k: 2 },
}
const oggi = new Date()
const giorni = n => new Date(oggi.getTime() + n * 86400000).toISOString().slice(0, 10)
const rnd = () => randomBytes(3).toString('hex')

function valoriCheck(t, col) {
  for (const def of tabelle[t].check) {
    const m = new RegExp(`\\(?\\(?${col}\\)?(?:::[a-z ]+)?\\s*=\\s*ANY\\s*\\(\\(?ARRAY\\[([^\\]]*)\\]`).exec(def)
    if (m) return [...m[1].matchAll(/'([^']*)'/g)].map(x => x[1])
  }
  return null
}
const inUnico = (t, col) => tabelle[t].unici.some(u => u.includes(col)) || (tabelle[t].pk.includes(col) && tabelle[t].pk.length > 1)

async function rigaDi(tab, X) {
  const c = cls[tab]
  if (!c || !diAzienda(c)) { const { rows } = await db.query(`SELECT x.* FROM public."${tab}" x LIMIT 1`); return rows[0] ? (rows[0].id ?? true) : null }
  const { rows } = await db.query(`SELECT x.* FROM public."${tab}" x WHERE ${proprietario(cls, tab, 'x')} = $1 LIMIT 1`, [X.id])
  return rows[0] ? (rows[0].id ?? true) : null
}

function sintetico(t, c, X) {
  const ammessi = valoriCheck(t, c.n)
  if (ammessi?.length) return ammessi[0]
  if (c.typtype === 'e') return enumMap[c.typname][0]
  const tipo = c.tipo
  if (/^(character|text)/.test(tipo)) {
    if (c.lung === 1) return X.pref[0]
    let s = `${X.pref} ${t}.${c.n}`
    if (inUnico(t, c.n)) s += ` ${rnd()}`
    return c.lung ? s.slice(-c.lung) : s
  }
  if (/^(smallint|integer|bigint)/.test(tipo)) return inUnico(t, c.n) ? Math.floor(Math.random() * 30000) + 1 : X.k
  if (/^(numeric|double|real)/.test(tipo)) return X.k * 111.11 > 999 ? X.k : Number((X.k * 111.11).toFixed(2))
  if (tipo === 'boolean') return false
  if (tipo === 'date') return giorni(0)
  if (/^timestamp/.test(tipo)) return new Date().toISOString()
  if (/^time/.test(tipo)) return '08:00'
  if (tipo === 'uuid') return randomUUID()
  if (/^jsonb?$/.test(tipo)) return '{}'
  if (tipo.endsWith('[]')) return []
  return null
}

/** Inserisce una riga in t per l'azienda X, completando da sé i campi obbligatori */
async function inserisci(t, X, valori = {}) {
  const T = tabelle[t]
  const riga = {}
  for (const c of T.colonne) {
    if (c.generata) continue
    if (c.n in valori) { riga[c.n] = valori[c.n]; continue }
    const fk = T.fk[c.n]
    if (c.n === 'azienda_id' && (!fk || ['public.azienda', 'public.aziende'].includes(fk.rif))) { riga[c.n] = X.id; continue }
    if (c.n === 'commessa_id' && X.commessa) { riga[c.n] = X.commessa; continue }
    if (fk) {
      const rif = fk.rif.replace(/^public\./, '')
      if (fk.rif === 'auth.users') { riga[c.n] = X.admin; continue }
      if (rif === t) { if (!c.nn) continue }
      if (!fk.rif.startsWith('public.')) { if (!c.nn) continue }
      const id = tabelle[rif] ? await rigaDi(rif, X) : null
      if (id) riga[c.n] = id
      else if (c.nn) throw new Error(`${t}.${c.n}: nessuna riga madre in ${rif} per ${X.breve}`)
      continue
    }
    if (t === 'rdo_offerte' && c.n === 'rdo_id') { riga[c.n] = await rigaDi('rdo', X); continue }
    if (t === 'audit_trail' && c.n === 'utente_id') { riga[c.n] = X.admin; continue }
    if (c.nn && !c.hadefault) riga[c.n] = sintetico(t, c, X)
  }
  const cols = Object.keys(riga)
  const tipi = Object.fromEntries(T.colonne.map(c => [c.n, c.tipo]))
  const par = cols.map(k => (/^jsonb?$/.test(tipi[k]) && typeof riga[k] !== 'string' ? JSON.stringify(riga[k]) : riga[k]))
  const ret = T.pk.length ? T.pk.map(p => `"${p}"`).join(', ') : '*'
  const sql = `INSERT INTO public."${t}" (${cols.map(k => `"${k}"`).join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING ${ret}`
  try { const { rows } = await db.query(sql, par); return rows[0] }
  catch (e) { throw new Error(`${t} (${X?.breve ?? 'globale'}): ${e.message}${e.detail ? ' · ' + e.detail : ''}`) }
}

async function caricaPdf(X, nome, titolo, righe) {
  const p = `${X.id}/seed/${nome}.pdf`
  const { error } = await sb.storage.from('documenti').upload(p, creaPdf(titolo, righe), { contentType: 'application/pdf', upsert: true })
  if (error) throw new Error(`upload ${nome}: ${pulisci(error.message)}`)
  return sb.storage.from('documenti').getPublicUrl(p).data.publicUrl
}

// ── 3. Aziende e utenti ──────────────────────────────────────────────────────
const credenziali = {}
async function creaUtente(X, ruolo, nome, cognome) {
  const email = `${ruolo}.${X.breve.toLowerCase()}@${DOMINIO}`
  const password = randomBytes(18).toString('base64url')
  const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw new Error(`createUser ${email}: ${pulisci(error.message)}`)
  await inserisci('utenti', X, { id: data.user.id, email, nome, cognome, ruolo: enumMap.ruolo_utente.includes(ruolo) ? ruolo : enumMap.ruolo_utente[0], attivo: true, moduli_abilitati: {} })
  credenziali[`${X.chiave}_${ruolo}`] = { email, password, id: data.user.id }
  return data.user.id
}
for (const X of Object.values(AZ)) {
  await inserisci('azienda', X, { id: X.id, ragione_sociale: X.ragione, partita_iva: X.piva, email: `info@${X.breve.toLowerCase()}.${DOMINIO}` })
  await inserisci('aziende', X, { id: X.id, ragione_sociale: X.ragione, piva: X.piva, email: `info@${X.breve.toLowerCase()}.${DOMINIO}` })
  X.admin = await creaUtente(X, 'admin', X.breve, 'Amministratore')
}
const ruoloTecnico = enumMap.ruolo_utente.find(r => r !== 'admin')
AZ.A.tecnico = await creaUtente(AZ.A, ruoloTecnico, 'Alfa', 'Tecnico')
log(`Aziende e utenti creati (ruoli disponibili: ${enumMap.ruolo_utente.join(', ')})`)

// ── 4. Fornitori, commessa, lavoratori ───────────────────────────────────────
const FORN = {
  A: [['Calcestruzzi Alfaverde', 120], ['Ferramenta Alfasud', 15], ['Noli Alfacentro', -10]],
  B: [['Laterizi Betamonte', 200], ['Impianti Betalago', 20], ['Scavi Betapiana', -30]],
}
for (const X of Object.values(AZ)) {
  X.fornitori = []
  for (const [i, [nome, gg]] of FORN[X.chiave].entries()) {
    const r = await inserisci('professionisti_fornitori', X, {
      nome, ragione_sociale: `${nome} S.r.l. (PROVA)`, partita_iva: `8888888${X.k}${i}00`, email: `ufficio${i}@${X.breve.toLowerCase()}-fornitori.${DOMINIO}`,
      durc_scadenza: giorni(gg), durc_regolare: gg > 0, attivo: true,
    })
    X.fornitori.push({ id: r.id, nome })
  }
  const r = await inserisci('commesse', X, {
    codice: `${X.pref}-PROVA-001`, nome: X.chiave === 'A' ? 'ALFA - Scuola primaria via dei Tigli (PROVA)' : 'BETA - Palazzina uffici corso Marconi (PROVA)',
    committente: X.chiave === 'A' ? 'Comune di Alfapoli (PROVA)' : 'Beta Immobiliare (PROVA)', stato: 'attiva',
    importo_contrattuale: X.chiave === 'A' ? 1234567.89 : 987654.32, created_by: X.admin,
  })
  X.commessa = r.id
  for (const [i, [n, c]] of [['Mario', 'Alfieri'], ['Luca', 'Alfonsi'], ['Anna', 'Alfano']].entries()) {
    const nomi = X.chiave === 'A' ? [n, c] : [['Paolo', 'Bettini'], ['Sara', 'Bertoli'], ['Ugo', 'Bellini']][i]
    await inserisci('lavoratori_commessa', X, { nome: nomi[0], cognome: nomi[1], mansione: ['Capocantiere', 'Muratore', 'Gruista'][i], durc_scadenza: giorni([90, 10, -5][i]), formazione_scadenza: giorni([200, -20, 30][i]), attivo: true })
  }
}
log('Fornitori, commesse e lavoratori creati')

// ── 5. Computo: A da XPWE tramite l'app, B manuale ───────────────────────────
const stato = { creato: new Date().toISOString(), aziende: {}, credenziali, xpwe: null }
if (!XPWE || !fs.existsSync(XPWE)) throw new Error('SEED_XPWE_PATH non trovato')
const app = await avviaApp()
try {
  const { token } = await comeUtente(credenziali.A_admin.email, credenziali.A_admin.password)
  const form = new FormData()
  form.append('file', new Blob([fs.readFileSync(XPWE)]), path.basename(XPWE))
  form.append('commessa_id', AZ.A.commessa)
  log('Import XPWE di A tramite /api/xpwe-parse …')
  const r = await fetch(`${app.base}/api/xpwe-parse`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
  const corpo = await r.json().catch(() => ({}))
  if (!r.ok || corpo.error) throw new Error(`xpwe-parse HTTP ${r.status}: ${pulisci(corpo.error || JSON.stringify(corpo).slice(0, 300))}`)
  const { rows: [v] } = await db.query(`SELECT count(*)::int n, coalesce(sum(v.importo), 0)::numeric(16,2) tot FROM public.voci_computo v JOIN public.computo_metrico c ON c.id = v.computo_id WHERE c.commessa_id = $1`, [AZ.A.commessa])
  const { rows: [m] } = await db.query(`SELECT count(*)::int n FROM public.voci_computo_misurazioni x JOIN public.voci_computo v ON v.id = x.voce_computo_id JOIN public.computo_metrico c ON c.id = v.computo_id WHERE c.commessa_id = $1`, [AZ.A.commessa])
  stato.xpwe = { file: path.basename(XPWE), http: r.status, risposta: Object.fromEntries(Object.entries(corpo).filter(([, x]) => typeof x !== 'object')), voci_db: v.n, totale_db: Number(v.tot), misurazioni_db: m.n }
  log(`XPWE importato: ${v.n} voci, totale € ${Number(v.tot).toLocaleString('it-IT')}, ${m.n} misurazioni`)
} finally { await app.ferma() }

{
  const X = AZ.B
  const comp = await inserisci('computo_metrico', X, { fonte: 'manuale', note: 'Computo BETA (PROVA)' })
  for (const [i, [cod, des, um, q, pu]] of [['B.01', 'BETA scavo di sbancamento', 'm3', 420, 18.4], ['B.02', 'BETA calcestruzzo C25/30', 'm3', 130, 142.75], ['B.03', 'BETA acciaio B450C', 'kg', 9800, 1.37]].entries())
    await inserisci('voci_computo', X, { computo_id: comp.id, codice: cod, descrizione: des, um, quantita: q, prezzo_unitario: pu, importo: Number((q * pu).toFixed(2)), capitolo: 'BETA Strutture', ordine_albero: i })
}

// ── 6. Flusso acquisti e SAL con PDF sintetici ───────────────────────────────
for (const X of Object.values(AZ)) {
  const A = X.chiave === 'A'
  const imp = A ? 12345.67 : 76543.21
  const f = X.fornitori[0]
  const { rows: voci } = await db.query(`SELECT v.id, v.codice, v.quantita, v.prezzo_unitario FROM public.voci_computo v JOIN public.computo_metrico c ON c.id = v.computo_id WHERE c.commessa_id = $1 AND v.quantita > 0 AND v.prezzo_unitario > 0 ORDER BY v.importo DESC NULLS LAST LIMIT 2`, [X.commessa])
  const intest = [`Impresa: ${X.ragione}`, `P.IVA ${X.piva} (inventata)`, `Commessa: ${X.pref}-PROVA-001`, '']
  const url = {
    contratto: await caricaPdf(X, 'contratto', 'CONTRATTO DI APPALTO', [...intest, `Committente: ${A ? 'Comune di Alfapoli' : 'Beta Immobiliare'} (PROVA)`, `Importo contrattuale: EUR ${A ? '1.234.567,89' : '987.654,32'}`]),
    preventivo: await caricaPdf(X, 'preventivo', 'PREVENTIVO FORNITORE', [...intest, `Fornitore: ${f.nome}`, `Totale offerta: EUR ${imp.toLocaleString('it-IT')}`]),
    ddt: await caricaPdf(X, 'ddt', 'DOCUMENTO DI TRASPORTO', [...intest, `Fornitore: ${f.nome}`, `DDT n. ${X.pref}-DDT-001 del ${giorni(-3)}`]),
    fattura: await caricaPdf(X, 'fattura', 'FATTURA', [...intest, `Fornitore: ${f.nome}`, `Imponibile: EUR ${imp.toLocaleString('it-IT')}  IVA 22%`]),
    durc: await caricaPdf(X, 'durc', 'DURC - DOCUMENTO UNICO DI REGOLARITA CONTRIBUTIVA', [`Impresa: ${f.nome} (PROVA)`, `Scadenza: ${giorni(120)}`, 'Esito: REGOLARE (inventato)']),
    pos: await caricaPdf(X, 'pos', 'PIANO OPERATIVO DI SICUREZZA', [...intest, 'Contenuto sintetico di prova']),
  }
  const rda = await inserisci('rda', X, { codice: `${X.pref}-RDA-001`, oggetto: `${X.breve}: fornitura calcestruzzo (PROVA)`, stato: 'approvata', origine: 'computo', urgenza: 'normale', voci_ids: voci.map(v => v.id), data_necessita: giorni(10) })
  const rdo = await inserisci('rdo', X, { rda_id: rda.id, codice: `${X.pref}-RDO-001`, fornitore: f.nome, fornitore_id: f.id, importo_offerta: imp, stato: 'accettata', oggetto: `${X.breve}: fornitura calcestruzzo`, data_invio: giorni(-8), data_risposta: giorni(-6), offerta_pdf_url: url.preventivo })
  const oda = await inserisci('oda', X, { rdo_id: rdo.id, codice: `${X.pref}-ODA-001`, fornitore: f.nome, fornitore_id: f.id, importo_netto: imp, importo_lordo: Number((imp * 1.22).toFixed(2)), stato: 'firmato', tipo_oda: 'materiali', data_firma: giorni(-5) })
  const ddt = await inserisci('ddt', X, { oda_id: oda.id, fornitore_id: f.id, fornitore_nome: f.nome, numero_ddt: `${X.pref}-DDT-001`, codice: `${X.pref}-DDT-001`, data_ddt: giorni(-3), data_ricezione: giorni(-3), file_url: url.ddt })
  await inserisci('fatture_passive', X, { oda_id: oda.id, ddt_id: ddt.id, fornitore_id: f.id, fornitore_nome: f.nome, numero_fattura: `${X.pref}-FT-001`, codice: `${X.pref}-FT-001`, data_fattura: giorni(-1), imponibile: imp, iva: Number((imp * 0.22).toFixed(2)), iva_pct: 22, totale: Number((imp * 1.22).toFixed(2)), stato_pagamento: 'DA_PAGARE', data_scadenza: giorni(59) })
  const sal = await inserisci('sal', X, { tipo: enumMap.tipo_sal.find(v => /attiv/i.test(v)) || enumMap.tipo_sal[0], numero: 1, codice: `${X.pref}-SAL-001`, data_emissione: giorni(0), metodo: 'manuale', created_by: X.admin })
  let lordo = 0
  for (const v of voci) {
    const q = Number((v.quantita * 0.25).toFixed(3)); lordo += q * v.prezzo_unitario
    await inserisci('sal_voci', X, { sal_id: sal.id, voce_computo_id: v.id, quantita_periodo: q })
  }
  await db.query('UPDATE public.sal SET importo_lordo = $1, importo_netto = $2 WHERE id = $3', [lordo.toFixed(2), (lordo * 0.95).toFixed(2), sal.id])
  const tipoDoc = enumMap.tipo_documento?.find(v => /contratt/i.test(v)) || enumMap.tipo_documento?.[0]
  await inserisci('documenti_commessa', X, { nome: `Contratto ${X.pref}-PROVA-001`, tipo: tipoDoc, categoria: 'contratto', file_url: url.contratto, file_nome: 'contratto.pdf', caricato_da: X.admin })
  await inserisci('documenti_sicurezza', X, { tipo: 'DURC', soggetto: f.nome, soggetto_tipo: 'fornitore', data_emissione: giorni(-60), data_scadenza: giorni(120), numero_documento: `${X.pref}-DURC-001` })
  await inserisci('documenti_sicurezza', X, { tipo: 'POS', soggetto: X.ragione, soggetto_tipo: 'impresa', data_emissione: giorni(-20), numero_documento: `${X.pref}-POS-001` })
  stato.aziende[X.chiave] = { id: X.id, ragione: X.ragione, commessa: X.commessa, admin: X.admin, tecnico: X.tecnico || null, rda: rda.id, rdo: rdo.id, oda: oda.id, ddt: ddt.id, sal: sal.id, pdf: url }
}
log('Flusso acquisti, SAL e documenti creati per A e B')

// ── 7. Riempitivo: almeno una riga di A e di B in ogni tabella ───────────────
const saltate = []
for (const t of ordineTopologico(tabelle, cls)) {
  const c = cls[t]
  try {
    if (!diAzienda(c)) {
      const { rows: [n] } = await db.query(`SELECT count(*)::int n FROM public."${t}"`)
      if (!n.n) await inserisci(t, AZ.A)
      continue
    }
    for (const X of Object.values(AZ))
      if (!(await rigaDi(t, X))) await inserisci(t, X)
  } catch (e) { saltate.push(`${t}: ${e.message}`) }
}
if (saltate.length) { console.error('Righe non create:\n- ' + saltate.join('\n- ')); process.exitCode = 1 }

// ── 8. Fotografia delle righe di A e B per tabella (usata dal test) ──────────
stato.righe = {}
for (const t of Object.keys(tabelle).sort()) {
  const pk = tabelle[t].pk
  const sel = pk.map(p => `x."${p}"`).join(', ')
  const { rows } = await db.query(`SELECT ${sel}, ${proprietario(cls, t, 'x')} AS _az FROM public."${t}" x`)
  stato.righe[t] = { pk, A: rows.filter(r => r._az === AZ.A.id).map(r => pk.map(p => r[p])), B: rows.filter(r => r._az === AZ.B.id).map(r => pk.map(p => r[p])), globali: rows.filter(r => !r._az).length }
}
scriviStato(stato)
const vuote = Object.entries(stato.righe).filter(([t, r]) => diAzienda(cls[t]) && (!r.A.length || !r.B.length)).map(([t]) => t)
log(`Seed completato: ${Object.keys(tabelle).length} tabelle · tabelle di azienda senza righe A o B: ${vuote.length ? vuote.join(', ') : 'nessuna'}`)
await db.end()
