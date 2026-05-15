'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, getAziendaId } from '@/lib/supabase'

/* ── Tipi ─────────────────────────────────────────────────────────────── */

interface DocCommessa {
  id: string; nome: string; categoria: string
  url: string; tipo_mime: string; dimensione: number; note?: string
}
interface DocSicurezza {
  id: string; tipo: string; soggetto?: string; soggetto_tipo?: string
  data_scadenza?: string; numero_documento?: string
}
interface ContratoSub {
  id: string; stato: string; importo_netto: number
  durc_ok?: boolean; pos_approvato?: boolean; comunicazione_sa?: boolean; antimafia_ok?: boolean
  durc_scadenza?: string
  fornitore?: { ragione_sociale: string; piva?: string } | null
}

/* ── Checklist logica ─────────────────────────────────────────────────── */

const CL_VOCI = [
  { key: 'contratto',  label: 'Contratto firmato',   critico: true  },
  { key: 'durc',       label: 'DURC valido',          critico: true  },
  { key: 'soa',        label: 'SOA adeguata',         critico: false },
  { key: 'dvr',        label: 'DVR / POS cantiere',   critico: false },
  { key: 'lavoratori', label: 'UNILAV + formazione',  critico: false },
]

function calcolaChecklist(cs: ContratoSub, subDocs: DocSicurezza[]) {
  const oggi = new Date()
  const durcDb = cs.durc_ok ||
    subDocs.some(d => d.tipo === 'DURC' && (!d.data_scadenza || new Date(d.data_scadenza) >= oggi))
  const voci: Record<string, boolean> = {
    contratto:  !['BOZZA', 'IN_FIRMA'].includes(cs.stato),
    durc:       durcDb,
    soa:        subDocs.some(d => d.tipo === 'SOA'),
    dvr:        !!cs.pos_approvato || subDocs.some(d => ['DVR', 'POS'].includes(d.tipo)),
    lavoratori: subDocs.some(d => d.tipo === 'UNILAV' || d.tipo?.toLowerCase().includes('formazione')),
  }
  const all = Object.values(voci).every(Boolean)
  const critica = !voci.contratto || !voci.durc
  return { voci, stato: all ? 'completa' : critica ? 'critica' : 'incompleta' }
}

/* ── Costanti ─────────────────────────────────────────────────────────── */

const STATO_CL = {
  completa:   { label: 'Completa',   bg: '#f0fdf4', color: '#16a34a', icon: '✅' },
  incompleta: { label: 'Incompleta', bg: '#fffbeb', color: '#d97706', icon: '⚠️' },
  critica:    { label: 'Critica',    bg: '#fef2f2', color: '#dc2626', icon: '❌' },
} as const

const TIPI_SUB_DOC = [
  'DURC', 'SOA', 'Visura camerale', 'DVR', 'POS', 'UNILAV',
  'Attestato formazione 16h', 'Attestato formazione 8h',
  'Idoneità sanitaria', 'Patente a crediti', 'Polizza RC', 'Altro',
]

const fmtSize = (b: number) =>
  b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : b > 1e3 ? (b / 1e3).toFixed(0) + ' KB' : b + ' B'
const fmtEur = (n: number) =>
  Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })
const isScaduto = (d: DocSicurezza) =>
  !!d.data_scadenza && new Date(d.data_scadenza) < new Date()
const isInScadenza = (d: DocSicurezza) => {
  if (!d.data_scadenza) return false
  const sc = new Date(d.data_scadenza)
  const tra30 = new Date(); tra30.setDate(tra30.getDate() + 30)
  return sc >= new Date() && sc <= tra30
}

/* ── Subcomponenti ────────────────────────────────────────────────────── */

function FolderHeader({
  icon, title, count, fkey, expanded, onToggle,
}: { icon: string; title: string; count?: number; fkey: string; expanded: Set<string>; onToggle: (k: string) => void }) {
  const open = expanded.has(fkey)
  return (
    <div onClick={() => onToggle(fkey)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px', cursor: 'pointer',
        background: open ? 'var(--bg)' : 'var(--panel)', borderBottom: open ? '1px solid var(--border)' : 'none',
        userSelect: 'none' }}>
      <span style={{ fontSize: 12, color: 'var(--t3)' }}>{open ? '▾' : '▸'}</span>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{title}</span>
      {count !== undefined && (
        <span style={{ fontSize: 11, fontWeight: 700, background: count > 0 ? 'var(--accent)' : 'var(--border)',
          color: count > 0 ? '#fff' : 'var(--t3)', borderRadius: 12, padding: '2px 9px' }}>
          {count}
        </span>
      )}
    </div>
  )
}

function LinkBox({
  icon, label, count, onClick, color = '#2563eb',
}: { icon: string; label: string; count: number; onClick: () => void; color?: string }) {
  return (
    <div onClick={onClick}
      style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10,
        padding: '13px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
        transition: 'border-color .15s' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', margin: 0 }}>{label}</p>
        <p style={{ fontSize: 11, color: 'var(--t3)', margin: '2px 0 0' }}>{count} elementi</p>
      </div>
      <span style={{ fontSize: 13, color, fontWeight: 700 }}>→</span>
    </div>
  )
}

/* ── Componente principale ────────────────────────────────────────────── */

export default function ArchivioPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const base = `/dashboard/commesse/${id}`

  /* state */
  const [commessa, setCommessa] = useState<any>(null)
  const [docs, setDocs] = useState<DocCommessa[]>([])
  const [docsig, setDocsig] = useState<DocSicurezza[]>([])
  const [contratti, setContratti] = useState<ContratoSub[]>([])
  const [counts, setCounts] = useState({ oda: 0, dam: 0, rda: 0, rdo: 0, ddt: 0, fatture: 0 })
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(['contratto', 'subappaltatori'])
  )
  const [subOpen, setSubOpen] = useState<string | null>(null)
  const [uploadModal, setUploadModal] = useState<{ subId: string; fornitoreNome: string } | null>(null)
  const [uForm, setUForm] = useState({ tipo: 'DURC', numero: '', data_scadenza: '', note: '' })
  const [uFile, setUFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500) }
  const toggleFolder = (k: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })

  /* ── Carica dati ─────────────────────────────────────────────────────── */
  const carica = useCallback(async () => {
    setLoading(true)
    const [
      { data: c }, { data: d }, { data: ds }, { data: cs },
      { count: cOda }, { count: cDam }, { count: cRda },
      { count: cRdo }, { count: cDdt }, { count: cFat },
    ] = await Promise.all([
      supabase.from('commesse').select('id,codice,nome,stato').eq('id', id).single(),
      supabase.from('documenti_commessa').select('id,nome,categoria,url,tipo_mime,dimensione,note').eq('commessa_id', id),
      supabase.from('documenti_sicurezza').select('id,tipo,soggetto,soggetto_tipo,data_scadenza,numero_documento').eq('commessa_id', id),
      supabase.from('contratti_sub').select('id,stato,importo_netto,durc_ok,pos_approvato,comunicazione_sa,antimafia_ok,durc_scadenza,fornitore:professionisti_fornitori(ragione_sociale,piva)').eq('commessa_id', id),
      supabase.from('oda').select('*', { count: 'exact', head: true }).eq('commessa_id', id),
      supabase.from('dam').select('*', { count: 'exact', head: true }).eq('commessa_id', id),
      supabase.from('rda').select('*', { count: 'exact', head: true }).eq('commessa_id', id),
      supabase.from('rdo').select('*', { count: 'exact', head: true }).eq('commessa_id', id),
      supabase.from('ddt').select('*', { count: 'exact', head: true }).eq('commessa_id', id),
      supabase.from('fatture_passive').select('*', { count: 'exact', head: true }).eq('commessa_id', id),
    ])
    setCommessa(c)
    setDocs((d as DocCommessa[]) || [])
    setDocsig((ds as DocSicurezza[]) || [])
    setContratti((cs as unknown as ContratoSub[]) || [])
    setCounts({ oda: cOda || 0, dam: cDam || 0, rda: cRda || 0, rdo: cRdo || 0, ddt: cDdt || 0, fatture: cFat || 0 })
    setLoading(false)
  }, [id])

  useEffect(() => { carica() }, [carica])

  /* ── Upload documento sub ────────────────────────────────────────────── */
  async function salvaDocSub() {
    if (!uploadModal) return
    setUploading(true)
    try {
      const aziendaId = await getAziendaId()
      // Record conformità in documenti_sicurezza
      await supabase.from('documenti_sicurezza').insert({
        commessa_id: id,
        azienda_id: aziendaId || null,
        tipo: uForm.tipo,
        soggetto: uploadModal.fornitoreNome,
        soggetto_tipo: 'subappaltatore',
        numero_documento: uForm.numero || null,
        data_scadenza: uForm.data_scadenza || null,
        note: uForm.note || null,
      })
      // File opzionale → documenti_commessa
      if (uFile) {
        const ext = uFile.name.split('.').pop()
        const path = `${id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('documenti').upload(path, uFile)
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('documenti').getPublicUrl(path)
          await supabase.from('documenti_commessa').insert({
            commessa_id: id,
            azienda_id: aziendaId || null,
            nome: `${uForm.tipo} — ${uploadModal.fornitoreNome}`,
            categoria: 'subappaltatore',
            url: urlData.publicUrl,
            tipo_mime: uFile.type,
            dimensione: uFile.size,
            note: `sub:${uploadModal.fornitoreNome}`,
          })
        }
      }
      showToast('✓ Documento aggiunto')
      setUploadModal(null); setUFile(null)
      setUForm({ tipo: 'DURC', numero: '', data_scadenza: '', note: '' })
      carica()
    } catch (e: any) { showToast('⚠ ' + e.message) }
    finally { setUploading(false) }
  }

  /* ── Export ZIP ──────────────────────────────────────────────────────── */
  async function esportaZip() {
    setExporting(true)
    showToast('Generazione archivio ZIP...')
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const root = zip.folder(`Archivio_${commessa?.codice || id}`)!
      const safe = (s: string) => s.replace(/[/\\:*?"<>|]/g, '_')

      // 01_Contratto — file reali
      const f01 = root.folder('01_Contratto')!
      for (const doc of docs.filter(d => ['contratto', 'capitolato', 'elaborati', 'autorizzazioni'].includes(d.categoria))) {
        try {
          const r = await fetch(doc.url)
          if (r.ok) {
            const ext = doc.tipo_mime?.split('/')[1] || 'bin'
            f01.file(`${safe(doc.nome)}.${ext}`, await r.arrayBuffer())
          }
        } catch { /* file non raggiungibile */ }
      }

      // 02_Acquisti — riepilogo
      root.folder('02_Acquisti')!.file('riepilogo.txt', [
        `ACQUISTI — ${commessa?.codice}`, '='.repeat(40),
        `ODA: ${counts.oda}`, `DAM: ${counts.dam}`, `RDA: ${counts.rda}`, `RDO: ${counts.rdo}`,
      ].join('\n'))

      // 03_Cantiere — riepilogo
      root.folder('03_Cantiere')!.file('riepilogo.txt', [
        `CANTIERE — ${commessa?.codice}`, '='.repeat(40), `DDT: ${counts.ddt}`,
      ].join('\n'))

      // 04_Sicurezza_Impresa
      const docsigAz = docsig.filter(d => d.soggetto_tipo !== 'subappaltatore')
      root.folder('04_Sicurezza_Impresa')!.file('documenti.txt', [
        'SICUREZZA IMPRESA', '='.repeat(40),
        ...docsigAz.map(d => `${d.tipo} | ${d.soggetto || 'Azienda'} | Scad: ${d.data_scadenza || 'N/D'}`),
      ].join('\n'))

      // 05_Subappaltatori
      const f05 = root.folder('05_Subappaltatori')!
      for (const cs of contratti) {
        const nome = (cs.fornitore as any)?.ragione_sociale || `sub_${cs.id}`
        const fSub = f05.folder(safe(nome))!
        const subDocs = docsig.filter(d => d.soggetto_tipo === 'subappaltatore' && d.soggetto === nome)
        const cl = calcolaChecklist(cs, subDocs)
        fSub.file('checklist.txt', [
          `Checklist Conformità — ${nome}`, `Stato: ${cl.stato.toUpperCase()}`, '='.repeat(40),
          ...CL_VOCI.map(v => `${cl.voci[v.key] ? '✓' : '✗'} ${v.label}${v.critico ? ' *' : ''}`),
          '', `Stato contratto: ${cs.stato}`, `Importo: EUR ${fmtEur(cs.importo_netto)}`,
        ].join('\n'))
        // File allegati del sub
        for (const doc of docs.filter(d => d.categoria === 'subappaltatore' && d.note?.includes(`sub:${nome}`))) {
          try {
            const r = await fetch(doc.url)
            if (r.ok) {
              const ext = doc.tipo_mime?.split('/')[1] || 'bin'
              fSub.file(`${safe(doc.nome)}.${ext}`, await r.arrayBuffer())
            }
          } catch { /* file non raggiungibile */ }
        }
      }

      // 06_Economico — riepilogo
      root.folder('06_Economico')!.file('riepilogo.txt', [
        `ECONOMICO — ${commessa?.codice}`, '='.repeat(40), `Fatture passive: ${counts.fatture}`,
      ].join('\n'))

      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Archivio_${commessa?.codice}_${new Date().toISOString().slice(0, 10)}.zip`
      a.click(); URL.revokeObjectURL(url)
      showToast('✓ ZIP scaricato')
    } catch (e: any) { showToast('⚠ ' + e.message) }
    finally { setExporting(false) }
  }

  /* ── Dati derivati ───────────────────────────────────────────────────── */
  const docContratto  = docs.filter(d => ['contratto', 'capitolato', 'elaborati', 'autorizzazioni'].includes(d.categoria))
  const docsigAzienda = docsig.filter(d => d.soggetto_tipo !== 'subappaltatore')
  const scadutiCount  = docsigAzienda.filter(d => isScaduto(d)).length

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
    fontSize: 12, background: 'var(--panel)', color: 'var(--t1)', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 4,
  }
  const cardStyle: React.CSSProperties = {
    background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden',
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--t3)', fontSize: 13 }}>
      Caricamento archivio...
    </div>
  )

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)', margin: '0 0 4px' }}>
            📦 Archivio Commessa
          </h2>
          <p style={{ fontSize: 12, color: 'var(--t3)', margin: 0 }}>
            {docs.length} file · {docsig.length} doc sicurezza · {contratti.length} subappaltatori
            {scadutiCount > 0 && <span style={{ color: '#dc2626', fontWeight: 700 }}> · {scadutiCount} SCADUTI</span>}
          </p>
        </div>
        <button onClick={esportaZip} disabled={exporting}
          style={{ padding: '10px 22px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700,
            background: exporting ? '#94a3b8' : '#1d4ed8', color: '#fff', cursor: exporting ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 8 }}>
          {exporting ? '⏳ Generando...' : '📦 Esporta tutto'}
        </button>
      </div>

      {/* ── 📋 Contratto ─────────────────────────────────────────────────── */}
      <div style={cardStyle}>
        <FolderHeader icon="📋" title="Contratto" count={docContratto.length} fkey="contratto" expanded={expanded} onToggle={toggleFolder} />
        {expanded.has('contratto') && (
          <div style={{ padding: 14 }}>
            {docContratto.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--t3)', margin: 0, padding: '10px 0' }}>
                Nessun documento contrattuale.{' '}
                <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => router.push(base + '/documenti')}>
                  Carica dalla tab Documenti →
                </span>
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 10 }}>
                {docContratto.map(doc => (
                  <a key={doc.id} href={doc.url} target="_blank" rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                      background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, textDecoration: 'none' }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>
                      {doc.tipo_mime === 'application/pdf' ? '📄' : doc.tipo_mime?.startsWith('image/') ? '🖼️' : '📎'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', margin: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.nome}</p>
                      <p style={{ fontSize: 10, color: 'var(--t3)', margin: '2px 0 0' }}>{fmtSize(doc.dimensione || 0)}</p>
                    </div>
                  </a>
                ))}
              </div>
            )}
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', textAlign: 'right' }}>
              <button onClick={() => router.push(base + '/documenti')}
                style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                Gestisci tutti i documenti →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 🛒 Acquisti ──────────────────────────────────────────────────── */}
      <div style={cardStyle}>
        <FolderHeader icon="🛒" title="Acquisti" fkey="acquisti" expanded={expanded} onToggle={toggleFolder} />
        {expanded.has('acquisti') && (
          <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 10 }}>
            <LinkBox icon="📋" label="ODA" count={counts.oda} onClick={() => router.push(base + '/oda')} />
            <LinkBox icon="✅" label="DAM" count={counts.dam} onClick={() => router.push(base + '/dam')} />
            <LinkBox icon="📝" label="RDA" count={counts.rda} onClick={() => router.push(base + '/rda')} />
            <LinkBox icon="🏷️" label="RDO" count={counts.rdo} onClick={() => router.push(base + '/rdo')} />
          </div>
        )}
      </div>

      {/* ── 🏗️ Cantiere ──────────────────────────────────────────────────── */}
      <div style={cardStyle}>
        <FolderHeader icon="🏗️" title="Cantiere" fkey="cantiere" expanded={expanded} onToggle={toggleFolder} />
        {expanded.has('cantiere') && (
          <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 10 }}>
            <LinkBox icon="🚚" label="DDT" count={counts.ddt} onClick={() => router.push(base + '/ddt')} />
            <LinkBox icon="📊" label="Giornale lavori" count={0} onClick={() => router.push(base + '/cantiere')} color="#059669" />
            <LinkBox icon="👷" label="Persone" count={0} onClick={() => router.push(base + '/persone')} color="#059669" />
          </div>
        )}
      </div>

      {/* ── 🦺 Sicurezza Impresa ─────────────────────────────────────────── */}
      <div style={cardStyle}>
        <FolderHeader icon="🦺" title="Sicurezza Impresa" count={docsigAzienda.length} fkey="sicurezza" expanded={expanded} onToggle={toggleFolder} />
        {expanded.has('sicurezza') && (
          <div style={{ padding: 14 }}>
            {docsigAzienda.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--t3)', margin: 0, padding: '10px 0' }}>
                Nessun documento.{' '}
                <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => router.push(base + '/sicurezza')}>
                  Vai a Sicurezza →
                </span>
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['Tipo', 'Soggetto', 'N° Documento', 'Scadenza', 'Stato'].map(h => (
                        <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700,
                          color: 'var(--t3)', textTransform: 'uppercase', borderBottom: '2px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {docsigAzienda.map(d => {
                      const scad = isScaduto(d); const inScad = isInScadenza(d)
                      const col = scad ? '#dc2626' : inScad ? '#d97706' : '#16a34a'
                      const bg  = scad ? '#fef2f2' : inScad ? '#fffbeb' : 'transparent'
                      return (
                        <tr key={d.id} style={{ background: bg }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--t1)', borderBottom: '1px solid var(--border)' }}>{d.tipo}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--t2)', borderBottom: '1px solid var(--border)' }}>{d.soggetto || '—'}</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, color: 'var(--accent)', borderBottom: '1px solid var(--border)' }}>{d.numero_documento || '—'}</td>
                          <td style={{ padding: '8px 10px', color: col, fontWeight: 600, borderBottom: '1px solid var(--border)' }}>
                            {d.data_scadenza ? new Date(d.data_scadenza).toLocaleDateString('it-IT') : '—'}
                          </td>
                          <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: col }}>
                              {scad ? 'Scaduto' : inScad ? 'In scadenza' : 'Valido'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', textAlign: 'right' }}>
              <button onClick={() => router.push(base + '/sicurezza')}
                style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                Gestisci documenti sicurezza →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 👷 Subappaltatori ────────────────────────────────────────────── */}
      <div style={cardStyle}>
        <FolderHeader icon="👷" title="Subappaltatori" count={contratti.length} fkey="subappaltatori" expanded={expanded} onToggle={toggleFolder} />
        {expanded.has('subappaltatori') && (
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {contratti.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--t3)', margin: 0, padding: '10px 0' }}>
                Nessun subappaltatore.{' '}
                <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => router.push(base + '/contratti')}>
                  Vai a Contratti Sub →
                </span>
              </p>
            ) : contratti.map(cs => {
              const nome    = (cs.fornitore as any)?.ragione_sociale || 'N/D'
              const subDocs = docsig.filter(d => d.soggetto_tipo === 'subappaltatore' && d.soggetto === nome)
              const subFiles = docs.filter(d => d.categoria === 'subappaltatore' && d.note?.includes(`sub:${nome}`))
              const cl      = calcolaChecklist(cs, subDocs)
              const clMeta  = STATO_CL[cl.stato as keyof typeof STATO_CL]
              const isOpen  = subOpen === cs.id

              return (
                <div key={cs.id} style={{ border: `1px solid ${clMeta.color}40`, borderRadius: 10, overflow: 'hidden' }}>
                  {/* Sub header */}
                  <div onClick={() => setSubOpen(isOpen ? null : cs.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                      cursor: 'pointer', background: clMeta.bg, userSelect: 'none' }}>
                    <span style={{ fontSize: 12, color: 'var(--t3)' }}>{isOpen ? '▾' : '▸'}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', margin: '0 0 2px' }}>{nome}</p>
                      <p style={{ fontSize: 11, color: 'var(--t3)', margin: 0 }}>
                        EUR {fmtEur(cs.importo_netto)} · {cs.stato} · {subDocs.length} doc sicurezza
                      </p>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: clMeta.color,
                      background: 'white', padding: '4px 12px', borderRadius: 20,
                      border: `1px solid ${clMeta.color}40`, flexShrink: 0 }}>
                      {clMeta.icon} {clMeta.label}
                    </span>
                  </div>

                  {/* Sub dettaglio */}
                  {isOpen && (
                    <div style={{ padding: 16, borderTop: `1px solid ${clMeta.color}30`, background: 'var(--panel)' }}>
                      {/* Checklist */}
                      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', margin: '0 0 10px' }}>
                        Checklist conformità
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 8, marginBottom: 16 }}>
                        {CL_VOCI.map(v => {
                          const ok = cl.voci[v.key]
                          return (
                            <div key={v.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
                              borderRadius: 8, background: ok ? '#f0fdf4' : '#fef2f2',
                              border: `1px solid ${ok ? '#bbf7d0' : '#fecaca'}` }}>
                              <span style={{ fontSize: 14, flexShrink: 0 }}>{ok ? '✓' : '✗'}</span>
                              <span style={{ fontSize: 12, color: ok ? '#065f46' : '#991b1b', fontWeight: v.critico ? 700 : 400 }}>
                                {v.label}
                                {v.critico && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
                              </span>
                            </div>
                          )
                        })}
                      </div>

                      {/* File allegati del sub */}
                      {subFiles.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', margin: '0 0 8px' }}>
                            File caricati ({subFiles.length})
                          </p>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {subFiles.map(f => (
                              <a key={f.id} href={f.url} target="_blank" rel="noreferrer"
                                style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6,
                                  background: 'var(--bg)', border: '1px solid var(--border)',
                                  color: 'var(--accent)', textDecoration: 'none' }}>
                                📎 {f.nome}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      <button onClick={() => setUploadModal({ subId: cs.id, fornitoreNome: nome })}
                        style={{ fontSize: 12, padding: '7px 16px', borderRadius: 8,
                          border: '1px solid var(--accent)', background: 'none',
                          color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>
                        + Aggiungi documento
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── 💰 Economico ─────────────────────────────────────────────────── */}
      <div style={cardStyle}>
        <FolderHeader icon="💰" title="Economico" fkey="economico" expanded={expanded} onToggle={toggleFolder} />
        {expanded.has('economico') && (
          <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 10 }}>
            <LinkBox icon="📈" label="SAL Attivi"      count={0} onClick={() => router.push(base + '/sal-attivi')}    color="#059669" />
            <LinkBox icon="📉" label="SAL Passivi"     count={0} onClick={() => router.push(base + '/sal-passivi')}   color="#059669" />
            <LinkBox icon="🧾" label="Fatture passive" count={counts.fatture} onClick={() => router.push(base + '/fatture')} color="#d97706" />
            <LinkBox icon="📊" label="Conto economico" count={0} onClick={() => router.push(base + '/conto-economico')} color="#7c3aed" />
            <LinkBox icon="📉" label="Marginalità"     count={0} onClick={() => router.push(base + '/marginalita')}   color="#2563eb" />
          </div>
        )}
      </div>

      {/* ── Modal upload doc sub ─────────────────────────────────────────── */}
      {uploadModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setUploadModal(null) }}>
          <div className="modal-box" style={{ maxWidth: 480, width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 2px' }}>Aggiungi documento</h3>
                <p style={{ fontSize: 11, color: 'var(--t3)', margin: 0 }}>{uploadModal.fornitoreNome}</p>
              </div>
              <button onClick={() => setUploadModal(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--t3)' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={lbl}>Tipo documento *</label>
                <select value={uForm.tipo} onChange={e => setUForm({ ...uForm, tipo: e.target.value })} style={{ ...inp }}>
                  {TIPI_SUB_DOC.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lbl}>Numero / Protocollo</label>
                  <input value={uForm.numero} onChange={e => setUForm({ ...uForm, numero: e.target.value })}
                    placeholder="es. INPS-2026-001" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Scadenza</label>
                  <input type="date" value={uForm.data_scadenza} onChange={e => setUForm({ ...uForm, data_scadenza: e.target.value })} style={inp} />
                </div>
              </div>
              <div>
                <label style={lbl}>File allegato (opzionale)</label>
                <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setUFile(f) }}
                  style={{ width: '100%', fontSize: 12 }} />
                {uFile && <p style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>{uFile.name} — {fmtSize(uFile.size)}</p>}
              </div>
              <div>
                <label style={lbl}>Note</label>
                <input value={uForm.note} onChange={e => setUForm({ ...uForm, note: e.target.value })} style={inp} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setUploadModal(null)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: 12 }}>
                  Annulla
                </button>
                <button onClick={salvaDocSub} disabled={uploading}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)',
                    color: '#fff', cursor: uploading ? 'wait' : 'pointer', fontSize: 12, fontWeight: 600 }}>
                  {uploading ? 'Salvataggio...' : '✓ Salva documento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, background: '#14532d', color: '#fff',
          padding: '10px 18px', borderRadius: 10, fontSize: 12, fontWeight: 700, zIndex: 1000,
          boxShadow: 'var(--shadow-lg)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
