'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  Upload, FileText, ChevronDown, ChevronRight,
  AlertCircle, CheckCircle, Loader2, RefreshCw,
  Calculator, Shield, TrendingDown, Info
} from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Tipi ─────────────────────────────────────────────────────────────────────

interface VoceComputo {
  id: string
  codice: string
  descrizione: string
  um: string
  quantita: number
  prezzo_unitario: number
  importo: number
  capitolo: string
  categoria: string
  note?: string
}

interface Commessa {
  id: string
  codice: string
  nome: string
  ribasso_pct?: number
  oneri_sicurezza?: number
  sicurezza_interna_esclusa_ribasso?: boolean
  importo_contrattuale?: number
}

interface GruppoCapitolo {
  nome: string
  voci: VoceComputo[]
  totale: number
  aperto: boolean
}

const fmt = (n: number) =>
  n?.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'

// ─── Componente principale ─────────────────────────────────────────────────────

export default function ComputoPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(paramsPromise)

  const [commessa, setCommessa] = useState<Commessa | null>(null)
  const [voci, setVoci] = useState<VoceComputo[]>([])
  const [capitoli, setCapitoli] = useState<GruppoCapitolo[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [importando, setImportando] = useState(false)
  const [risultatoImport, setRisultatoImport] = useState<{
    ok?: boolean; tariffe?: number; voci?: number; importo_totale?: number; error?: string
  } | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Carica dati commessa e voci
  const carica = async () => {
    setCaricamento(true)
    try {
      const [{ data: comm }, { data: vociData }] = await Promise.all([
        supabase
          .from('commesse')
          .select('id,codice,nome,ribasso_pct,oneri_sicurezza,sicurezza_interna_esclusa_ribasso,importo_contrattuale')
          .eq('id', id)
          .single(),
        supabase
          .from('voci_computo')
          .select('id,codice,descrizione,um,quantita,prezzo_unitario,importo,capitolo,categoria,note')
          .eq('computo_id',
            // join tramite computo_metrico
            supabase.from('computo_metrico').select('id').eq('commessa_id', id).limit(1)
          )
          .order('capitolo')
          .order('codice'),
      ])
      if (comm) setCommessa(comm)
      if (vociData) {
        setVoci(vociData)
        // Raggruppa per capitolo
        const gruppi: Record<string, GruppoCapitolo> = {}
        for (const v of vociData) {
          const cap = v.capitolo || 'Generale'
          if (!gruppi[cap]) gruppi[cap] = { nome: cap, voci: [], totale: 0, aperto: true }
          gruppi[cap].voci.push(v)
          gruppi[cap].totale += v.importo || 0
        }
        setCapitoli(Object.values(gruppi))
      }
    } finally {
      setCaricamento(false)
    }
  }

  // Carica voci direttamente (senza join complessa)
  const caricaVoci = async () => {
    setCaricamento(true)
    try {
      const [{ data: comm }, { data: computoData }] = await Promise.all([
        supabase.from('commesse')
          .select('id,codice,nome,ribasso_pct,oneri_sicurezza,sicurezza_interna_esclusa_ribasso,importo_contrattuale')
          .eq('id', id).single(),
        supabase.from('computo_metrico')
          .select('id').eq('commessa_id', id).single(),
      ])
      if (comm) setCommessa(comm)
      if (!computoData) { setCaricamento(false); return }

      const { data: vociData } = await supabase
        .from('voci_computo')
        .select('id,codice,descrizione,um,quantita,prezzo_unitario,importo,capitolo,categoria,note')
        .eq('computo_id', computoData.id)
        .order('capitolo').order('codice')

      if (vociData) {
        setVoci(vociData)
        const gruppi: Record<string, GruppoCapitolo> = {}
        for (const v of vociData) {
          const cap = v.capitolo || 'Generale'
          if (!gruppi[cap]) gruppi[cap] = { nome: cap, voci: [], totale: 0, aperto: true }
          gruppi[cap].voci.push(v)
          gruppi[cap].totale += v.importo || 0
        }
        setCapitoli(Object.values(gruppi))
      }
    } finally {
      setCaricamento(false)
    }
  }

  useEffect(() => { if (id) caricaVoci() }, [id])

  // Import XPWE
  const importaFile = async (file: File) => {
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xpwe', 'pwe', 'xml'].includes(ext || '')) {
      setRisultatoImport({ error: 'Formato non supportato. Usa file .xpwe, .pwe o .xml da Primus ACCA.' })
      return
    }
    setImportando(true)
    setRisultatoImport(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('commessa_id', id)
      const res = await fetch('/api/xpwe-parse', { method: 'POST', body: fd })
      const data = await res.json()
      setRisultatoImport(data)
      if (data.ok) await caricaVoci()
    } catch (e) {
      setRisultatoImport({ error: 'Errore di rete durante l\'importazione' })
    } finally {
      setImportando(false)
    }
  }

  const toggleCapitolo = (idx: number) => {
    setCapitoli(prev => prev.map((c, i) => i === idx ? { ...c, aperto: !c.aperto } : c))
  }

  // Calcola totali con formula 3 strati
  const totaleVoci = voci.reduce((acc, v) => acc + (v.importo || 0), 0)
  const ribasso = (commessa?.ribasso_pct || 0) / 100
  const oneriSic = commessa?.oneri_sicurezza || 0

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── IMPORT ZONE ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Computo Metrico</h2>
              <p className="text-sm text-gray-500">
                {voci.length > 0
                  ? `${voci.length} voci · ${capitoli.length} capitoli · Totale lista: € ${fmt(totaleVoci)}`
                  : 'Nessuna voce importata'
                }
              </p>
            </div>
            <button
              onClick={caricaVoci}
              disabled={caricamento}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw size={13} className={caricamento ? 'animate-spin' : ''} />
              Aggiorna
            </button>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault(); setDragOver(false)
              const f = e.dataTransfer.files[0]
              if (f) importaFile(f)
            }}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
              dragOver
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            {importando ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 size={28} className="text-blue-500 animate-spin" />
                <p className="text-sm font-medium text-gray-700">Importazione in corso...</p>
                <p className="text-xs text-gray-500">Analisi voci e tariffe XPWE</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
                  <Upload size={22} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    Trascina il file XPWE oppure{' '}
                    <label className="text-blue-600 cursor-pointer hover:text-blue-700 underline">
                      seleziona dal computer
                      <input
                        type="file"
                        accept=".xpwe,.pwe,.xml"
                        className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) importaFile(f) }}
                      />
                    </label>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Primus ACCA · Formati supportati: .xpwe · .pwe · .xml
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Risultato import */}
          {risultatoImport && (
            <div className={`mt-3 flex items-start gap-3 p-3 rounded-lg text-sm ${
              risultatoImport.ok
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              {risultatoImport.ok
                ? <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                : <AlertCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
              }
              <div>
                {risultatoImport.ok ? (
                  <p className="text-green-800 font-medium">
                    Importazione completata: {risultatoImport.tariffe} tariffe · {risultatoImport.voci} voci ·
                    Totale € {fmt(risultatoImport.importo_totale || 0)}
                  </p>
                ) : (
                  <p className="text-red-800">{risultatoImport.error}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── QUADRO ECONOMICO RIBASSO ── */}
      {voci.length > 0 && commessa && (
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

              {/* Importo lista */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <FileText size={14} className="text-gray-500" />
                  <p className="text-xs text-gray-500">Importo di lista</p>
                </div>
                <p className="text-lg font-bold text-gray-900">€ {fmt(totaleVoci)}</p>
              </div>

              {/* Ribasso */}
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown size={14} className="text-blue-500" />
                  <p className="text-xs text-blue-700">Ribasso applicato</p>
                </div>
                <p className="text-lg font-bold text-blue-900">
                  {((commessa.ribasso_pct || 0)).toFixed(3)}%
                </p>
              </div>

              {/* Formula 3 strati */}
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                <div className="flex items-center gap-2 mb-1">
                  <Shield size={14} className="text-amber-600" />
                  <p className="text-xs text-amber-700">Sicurezza interna (Strato 3)</p>
                </div>
                <p className="text-xs font-semibold text-amber-800">
                  {commessa.sicurezza_interna_esclusa_ribasso ? 'NON ribassata' : 'Ribassata'}
                </p>
              </div>

              {/* Importo netto */}
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <div className="flex items-center gap-2 mb-1">
                  <Calculator size={14} className="text-green-600" />
                  <p className="text-xs text-green-700">Importo aggiudicato</p>
                </div>
                <p className="text-lg font-bold text-green-900">
                  € {fmt((commessa.importo_contrattuale || totaleVoci * (1 - ribasso)))}
                </p>
              </div>
            </div>

            {/* Formula visualizzata */}
            <div className="mt-3 bg-gray-900 rounded-lg px-4 py-3 font-mono text-xs">
              <span className="text-gray-500">Formula: </span>
              <span className="text-green-400">Lavori × (1−R)</span>
              <span className="text-gray-500"> + </span>
              <span className={commessa.sicurezza_interna_esclusa_ribasso ? 'text-amber-400' : 'text-gray-400'}>
                SicInterna{commessa.sicurezza_interna_esclusa_ribasso ? '' : ' × (1−R)'}
              </span>
              <span className="text-gray-500"> + </span>
              <span className="text-red-400">SicSpeciale</span>
              <span className="text-gray-500"> + </span>
              <span className="text-blue-400">OneriSicurezza</span>
            </div>
          </div>
        </div>
      )}

      {/* ── VOCI PER CAPITOLO ── */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {caricamento ? (
          <div className="flex items-center justify-center py-20 gap-3">
            <Loader2 size={24} className="animate-spin text-blue-500" />
            <span className="text-gray-500">Caricamento voci...</span>
          </div>
        ) : voci.length === 0 ? (
          <div className="text-center py-20">
            <FileText size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Nessun computo importato</p>
            <p className="text-gray-400 text-sm mt-1">
              Carica un file XPWE da Primus ACCA per importare le voci
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {capitoli.map((cap, idx) => (
              <div key={cap.nome} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {/* Header capitolo */}
                <button
                  onClick={() => toggleCapitolo(idx)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {cap.aperto
                      ? <ChevronDown size={16} className="text-gray-400" />
                      : <ChevronRight size={16} className="text-gray-400" />
                    }
                    <span className="font-semibold text-gray-900 text-sm">{cap.nome}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {cap.voci.length} voci
                    </span>
                  </div>
                  <span className="text-sm font-bold text-gray-800">
                    € {fmt(cap.totale)}
                  </span>
                </button>

                {/* Tabella voci */}
                {cap.aperto && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-t border-gray-100 bg-gray-50">
                          <th className="text-left px-5 py-2 text-xs font-medium text-gray-500 w-28">Tariffa</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Descrizione</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 w-16">UM</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 w-24">Quantità</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 w-28">P.U.</th>
                          <th className="text-right px-5 py-2 text-xs font-medium text-gray-500 w-32">Importo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {cap.voci.map(v => (
                          <tr key={v.id} className="hover:bg-gray-50 transition-colors group">
                            <td className="px-5 py-2.5">
                              <span className="font-mono text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                                {v.codice}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <p className="text-gray-800 line-clamp-2 leading-relaxed text-xs">
                                {v.descrizione}
                              </p>
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs text-gray-500">{v.um}</td>
                            <td className="px-3 py-2.5 text-right text-xs font-mono text-gray-700">
                              {fmt(v.quantita)}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs font-mono text-gray-700">
                              {fmt(v.prezzo_unitario)}
                            </td>
                            <td className="px-5 py-2.5 text-right text-sm font-semibold text-gray-900">
                              {fmt(v.importo)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-gray-200 bg-gray-50">
                          <td colSpan={5} className="px-5 py-2 text-xs font-semibold text-gray-600 text-right">
                            Totale {cap.nome}
                          </td>
                          <td className="px-5 py-2 text-right text-sm font-bold text-gray-900">
                            € {fmt(cap.totale)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            ))}

            {/* Totale generale */}
            <div className="bg-gray-900 text-white rounded-xl px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Totale Computo di Lista</p>
                <p className="text-xs text-gray-400">{voci.length} voci · {capitoli.length} capitoli</p>
              </div>
              <p className="text-2xl font-bold">€ {fmt(totaleVoci)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
