#!/usr/bin/env node
// ─── SQ360 — controllo automatico delle scritture sul database ───────────────
//
// Uso:   node scripts/check-scritture.mjs            (schema letto dal DB, sola lettura)
//        node scripts/check-scritture.mjs schema.json (schema OpenAPI già scaricato)
//
// Per ogni .insert() / .update() / .upsert() nel codice (src/**/*.ts, *.tsx):
//   - individua la tabella (.from('tabella'))
//   - risolve l'oggetto scritto: letterale, variabile dichiarata a parte (payload),
//     array, .map(x => ({...})), spread, ternari, funzioni che restituiscono il payload
//   - confronta con lo schema reale (OpenAPI di PostgREST, letto con la service role
//     di .env.local, SOLO GET):
//       • colonne inesistenti
//       • campi obbligatori mancanti (solo insert/upsert; NOT NULL senza default)
//       • valori stringa non ammessi dagli enum
//       • tabelle inesistenti
//   - elenca le scritture che non è riuscito a risolvere (da controllare a mano)
// Report: scripts/report-scritture.md · exit code 1 se ci sono problemi.

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const ts = require(path.join(ROOT, 'node_modules', 'typescript'))
const REPORT = path.join(ROOT, 'scripts', 'report-scritture.md')

// ─── Schema ──────────────────────────────────────────────────────────────────
function leggiEnv(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const r of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(r)
    if (m && !r.trim().startsWith('#')) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return out
}
async function caricaSchema() {
  const arg = process.argv[2]
  if (arg) return JSON.parse(fs.readFileSync(arg, 'utf8'))
  const env = { ...leggiEnv(path.join(ROOT, '.env.local')), ...process.env }
  const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Servono NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY in .env.local (oppure un file schema come argomento)')
  const r = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/openapi+json' } })
  if (!r.ok) throw new Error(`Lettura schema fallita: HTTP ${r.status}`)
  return r.json()
}

// ─── File sorgente ───────────────────────────────────────────────────────────
function elencaFile(dir) {
  const out = []
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f)
    if (fs.statSync(p).isDirectory()) out.push(...elencaFile(p))
    else if (/\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts')) out.push(p)
  }
  return out
}

// ─── Risoluzione degli oggetti scritti ───────────────────────────────────────
// Ritorna un array di { props: Map<nome, nodoValore>, parziale: bool, nota?: string }
function risolvi(node, checker, profondita = 0) {
  if (!node || profondita > 8) return [{ props: new Map(), parziale: true, nota: 'troppo annidato' }]
  const k = node.kind
  if (k === ts.SyntaxKind.ParenthesizedExpression || k === ts.SyntaxKind.AsExpression ||
      k === ts.SyntaxKind.NonNullExpression || k === ts.SyntaxKind.SatisfiesExpression ||
      k === ts.SyntaxKind.TypeAssertionExpression || k === ts.SyntaxKind.AwaitExpression) {
    return risolvi(node.expression, checker, profondita + 1)
  }
  if (k === ts.SyntaxKind.ObjectLiteralExpression) {
    const props = new Map(); let parziale = false; const note = []
    for (const p of node.properties) {
      if (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) {
        const nome = p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : null
        if (nome === null) { parziale = true; note.push('chiave calcolata'); continue }
        props.set(nome, ts.isPropertyAssignment(p) ? p.initializer : null)
      } else if (ts.isSpreadAssignment(p)) {
        const dentro = risolvi(p.expression, checker, profondita + 1)
        // spread condizionale tipo ...(cond ? {a} : {}) → unione dei rami
        for (const o of dentro) { for (const [n, v] of o.props) props.set(n, v); if (o.parziale) parziale = true }
      } else { parziale = true; note.push('metodo/accessor') }
    }
    return [{ props, parziale, nota: note.join(', ') || undefined }]
  }
  if (k === ts.SyntaxKind.ArrayLiteralExpression) {
    const out = []
    for (const e of node.elements) out.push(...(ts.isSpreadElement(e) ? risolvi(e.expression, checker, profondita + 1) : risolvi(e, checker, profondita + 1)))
    return out.length ? out : [{ props: new Map(), parziale: true, nota: 'array vuoto' }]
  }
  if (k === ts.SyntaxKind.ConditionalExpression) {
    return [...risolvi(node.whenTrue, checker, profondita + 1), ...risolvi(node.whenFalse, checker, profondita + 1)]
  }
  if (k === ts.SyntaxKind.Identifier) {
    const sym = checker.getSymbolAtLocation(node)
    const decl = sym?.valueDeclaration ?? sym?.declarations?.[0]
    if (decl && ts.isVariableDeclaration(decl) && decl.initializer) return risolvi(decl.initializer, checker, profondita + 1)
    if (decl && ts.isShorthandPropertyAssignment(decl)) {
      const s2 = checker.getShorthandAssignmentValueSymbol(decl)
      const d2 = s2?.valueDeclaration
      if (d2 && ts.isVariableDeclaration(d2) && d2.initializer) return risolvi(d2.initializer, checker, profondita + 1)
    }
    return [{ props: new Map(), parziale: true, nota: `variabile "${node.text}" non risolta (parametro o valore calcolato)` }]
  }
  if (k === ts.SyntaxKind.CallExpression) {
    const callee = node.expression
    // xxx.map(cb) / xxx.flatMap(cb): oggetto restituito dalla callback
    if (ts.isPropertyAccessExpression(callee) && ['map', 'flatMap'].includes(callee.name.text) && node.arguments[0]) {
      return daFunzione(node.arguments[0], checker, profondita)
    }
    // xxx.slice(...) / xxx.filter(...) / xxx.concat(...): stesso contenuto del ricevente
    if (ts.isPropertyAccessExpression(callee) && ['slice', 'filter', 'concat', 'sort', 'reverse'].includes(callee.name.text)) {
      return risolvi(callee.expression, checker, profondita + 1)
    }
    // funzione del progetto che costruisce il payload
    const sym = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(callee) ? callee.name : callee)
    let decl = sym?.valueDeclaration ?? sym?.declarations?.[0]
    if (decl && sym && (sym.flags & ts.SymbolFlags.Alias)) {
      const reale = checker.getAliasedSymbol(sym); decl = reale?.valueDeclaration ?? reale?.declarations?.[0]
    }
    if (decl) {
      if (ts.isVariableDeclaration(decl) && decl.initializer) return daFunzione(decl.initializer, checker, profondita, node)
      if (ts.isFunctionDeclaration(decl) || ts.isArrowFunction(decl) || ts.isFunctionExpression(decl) || ts.isMethodDeclaration(decl)) {
        return daFunzione(decl, checker, profondita, node)
      }
    }
    return [{ props: new Map(), parziale: true, nota: `risultato di ${callee.getText().slice(0, 40)}() non risolto` }]
  }
  return [{ props: new Map(), parziale: true, nota: `espressione non risolta (${ts.SyntaxKind[k]})` }]
}

/** Oggetto restituito da una funzione/callback (corpo a espressione o return). */
function daFunzione(fn, checker, profondita, chiamata) {
  let f = fn
  if (ts.isIdentifier(f)) {
    const sym = checker.getSymbolAtLocation(f); const d = sym?.valueDeclaration
    if (d && ts.isVariableDeclaration(d) && d.initializer) f = d.initializer
    else if (d && ts.isFunctionDeclaration(d)) f = d
  }
  if (!(ts.isArrowFunction(f) || ts.isFunctionExpression(f) || ts.isFunctionDeclaration(f) || ts.isMethodDeclaration(f)) || !f.body) {
    return [{ props: new Map(), parziale: true, nota: 'callback non risolta' }]
  }
  if (!ts.isBlock(f.body)) return risolvi(f.body, checker, profondita + 1)
  const ritorni = []
  const visita = n => {
    if (ts.isReturnStatement(n) && n.expression) ritorni.push(n.expression)
    if (!ts.isFunctionLike(n)) ts.forEachChild(n, visita)
  }
  ts.forEachChild(f.body, visita)
  if (!ritorni.length) return [{ props: new Map(), parziale: true, nota: 'funzione senza return' }]
  return ritorni.flatMap(r => risolvi(r, checker, profondita + 1))
}

// ─── Individuazione tabella dalla catena .from('t').insert(...) ──────────────
function tabellaDellaCatena(expr) {
  let e = expr
  for (let i = 0; i < 12 && e; i++) {
    if (ts.isCallExpression(e)) {
      const c = e.expression
      if (ts.isPropertyAccessExpression(c) && c.name.text === 'from' && e.arguments[0] && ts.isStringLiteralLike(e.arguments[0])) return e.arguments[0].text
      e = ts.isPropertyAccessExpression(c) ? c.expression : null
    } else if (ts.isPropertyAccessExpression(e) || ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e)) {
      e = e.expression
    } else return null
  }
  return null
}

// ─── Main ────────────────────────────────────────────────────────────────────
const schema = await caricaSchema()
const D = schema.definitions || {}
const files = elencaFile(path.join(ROOT, 'src'))
// Opzioni da tsconfig.json (paths "@/…" per risolvere le funzioni importate)
const cfg = ts.readConfigFile(path.join(ROOT, 'tsconfig.json'), ts.sys.readFile)
const opz = ts.parseJsonConfigFileContent(cfg.config || {}, ts.sys, ROOT).options
const program = ts.createProgram(files, { ...opz, noLib: true, noEmit: true, skipLibCheck: true, types: [] })
const checker = program.getTypeChecker()

const problemi = { colonne: [], obbligatori: [], enum: [], tabelle: [], nonRisolte: [] }
let totale = 0

for (const sf of program.getSourceFiles()) {
  if (!sf.fileName.replace(/\\/g, '/').includes('/src/')) continue
  const rel = path.relative(ROOT, sf.fileName).replace(/\\/g, '/')
  const visita = node => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        ['insert', 'update', 'upsert'].includes(node.expression.name.text) && node.arguments[0]) {
      const op = node.expression.name.text
      const tabella = tabellaDellaCatena(node.expression.expression)
      if (tabella) {
        totale++
        const riga = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1
        const dove = `${rel}:${riga}`
        const def = D[tabella]
        if (!def) problemi.tabelle.push({ dove, tabella, op })
        else {
          const oggetti = risolvi(node.arguments[0], checker)
          const colonne = def.properties || {}
          const richiesti = (def.required || []).filter(c => c !== 'id' && colonne[c]?.default === undefined)
          for (const o of oggetti) {
            for (const [nome, valore] of o.props) {
              const col = colonne[nome]
              if (!col) { problemi.colonne.push({ dove, tabella, op, colonna: nome }); continue }
              if (col.enum && valore && ts.isStringLiteralLike(valore) && !col.enum.includes(valore.text)) {
                problemi.enum.push({ dove, tabella, op, colonna: nome, valore: valore.text, ammessi: col.enum })
              }
            }
            if ((op === 'insert' || op === 'upsert') && !o.parziale) {
              const mancanti = richiesti.filter(c => !o.props.has(c))
              if (mancanti.length) problemi.obbligatori.push({ dove, tabella, op, mancanti })
            }
            if (o.parziale && o.props.size === 0) problemi.nonRisolte.push({ dove, tabella, op, nota: o.nota })
          }
        }
      }
    }
    ts.forEachChild(node, visita)
  }
  visita(sf)
}

// ─── Report ──────────────────────────────────────────────────────────────────
const unici = (arr, chiave) => [...new Map(arr.map(x => [chiave(x), x])).values()]
problemi.colonne = unici(problemi.colonne, x => `${x.dove}|${x.colonna}`)
problemi.enum = unici(problemi.enum, x => `${x.dove}|${x.colonna}|${x.valore}`)
problemi.nonRisolte = unici(problemi.nonRisolte, x => x.dove)

const md = ['# Controllo scritture SQ360', '', `- Data: ${new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}`,
  `- Scritture analizzate (insert/update/upsert con tabella nota): **${totale}**`,
  `- Colonne inesistenti: **${problemi.colonne.length}** · Obbligatori mancanti: **${problemi.obbligatori.length}** · Enum non validi: **${problemi.enum.length}** · Tabelle inesistenti: **${problemi.tabelle.length}** · Non risolte: **${problemi.nonRisolte.length}**`, '']
md.push('## Colonne inesistenti', '', problemi.colonne.length ? '| Dove | Tabella | Op | Colonna |\n|---|---|---|---|' : 'Nessuna.')
for (const p of problemi.colonne) md.push(`| \`${p.dove}\` | ${p.tabella} | ${p.op} | \`${p.colonna}\` |`)
md.push('', '## Campi obbligatori mancanti (insert/upsert)', '', problemi.obbligatori.length ? '| Dove | Tabella | Mancanti |\n|---|---|---|' : 'Nessuno.')
for (const p of problemi.obbligatori) md.push(`| \`${p.dove}\` | ${p.tabella} | ${p.mancanti.map(m => '`' + m + '`').join(', ')} |`)
md.push('', '## Valori non ammessi dagli enum', '', problemi.enum.length ? '| Dove | Tabella.colonna | Valore | Ammessi |\n|---|---|---|---|' : 'Nessuno.')
for (const p of problemi.enum) md.push(`| \`${p.dove}\` | ${p.tabella}.${p.colonna} | \`${p.valore}\` | ${p.ammessi.join(', ')} |`)
md.push('', '## Tabelle inesistenti', '', problemi.tabelle.length ? '| Dove | Tabella | Op |\n|---|---|---|' : 'Nessuna.')
for (const p of problemi.tabelle) md.push(`| \`${p.dove}\` | ${p.tabella} | ${p.op} |`)
md.push('', '## Scritture non risolte (da controllare a mano)', '', problemi.nonRisolte.length ? '| Dove | Tabella | Op | Motivo |\n|---|---|---|---|' : 'Nessuna.')
for (const p of problemi.nonRisolte) md.push(`| \`${p.dove}\` | ${p.tabella} | ${p.op} | ${p.nota || ''} |`)
fs.writeFileSync(REPORT, md.join('\n') + '\n')

console.log(`Scritture analizzate: ${totale}`)
console.log(`Colonne inesistenti: ${problemi.colonne.length} · Obbligatori mancanti: ${problemi.obbligatori.length} · Enum non validi: ${problemi.enum.length} · Tabelle inesistenti: ${problemi.tabelle.length} · Non risolte: ${problemi.nonRisolte.length}`)
console.log(`Report: ${path.relative(ROOT, REPORT)}`)
const err = problemi.colonne.length + problemi.obbligatori.length + problemi.enum.length + problemi.tabelle.length
process.exit(err ? 1 : 0)
