'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Plus, FileText, Loader2, ChevronDown, ChevronRight, Package, Wrench, Truck, ShoppingCart, Receipt } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const TIPI_ODA = [
  { value: 'SUBAPPALTO', label: 'Subappalto', color: 'bg-purple-50 text-purple-700', ritenuta: 5 },
  { value: 'SUBAFFIDAMENTO', label: 'Subaffidamento', color: 'bg-blue-50 text-blue-700', ritenuta: 0 },
  { value: 'MATERIALE', label: 'Acquisto diretto', color: 'bg-green-50 text-green-700', ritenuta: 0 },
  { value: 'SERVIZIO', label: 'Servizio/Prof.', color: 'bg-orange-50 text-orange-700', ritenuta: 0 },
]

const STATI: Record<string, { label: string; color: string }> = {
  EMESSO: { label: 'Emesso', color: 'bg-blue-50 text-blue-700' },
  CONFERMATO: { label: 'Confermato', color: 'bg-indigo-50 text-indigo-700' },
  PARZ_EVASO: { label: 'Parz. evaso', color: 'bg-yellow-50 text-yellow-700' },
  EVASO: { label: 'Evaso', color: 'bg-green-50 text-green-700' },
  ANNULLATO: { label: 'Annullato', color: 'bg-red-50 text-red-700' },
}

export default function ODAPage() {
  const params = useParams()
  const commessaId = params.id as string
  const [oda, setOda] = useState<any[]>([])
  const [fornitori, setFornitori] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [tipo, setTipo] = useState('MATERIALE')
  const [oggetto, setOggetto] = useState('')
  const [fornitoreId, setFornitoreId] = useState('')
  const [importoNetto, setImportoNetto] = useState('')
  const [ivaPct, setIvaPct] = useState('22')
  const [ritenuta, setRitenuta] = useState('0')
  const [condPag, setCondPag] = useState('')
  const [dataConsegna, setDataConsegna] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const importoNum = parseFloat(importoNetto) || 0
  const totale = importoNum * (1 + parseFloat(ivaPct) / 100)
  const ritenutaImporto = importoNum * parseFloat(ritenuta) / 100

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('oda').select('*').eq('commessa_id', commessaId).order('created_at', { ascending: false })
    const { data: forn } = await supabase.from('professionisti_fornitori').select('id, ragione_sociale, nome, cognome').order('id', { ascending: true })
    setOda(data || [])
    setFornitori(forn || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [commessaId])
  useEffect(() => { setRitenuta(String(TIPI_ODA.find(x => x.value === tipo)?.ritenuta || 0)) }, [tipo])

  async function handleSave() {
    if (!oggetto.trim() || importoNum <= 0 || !fornitoreId) { setErr('Compila tutti i campi obbligatori'); return }
    setSaving(true)
    const { count } = await supabase.from('oda').select('*', { count: 'exact', head: true }).eq('commessa_id', commessaId)
    const numero = `ODA-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`
    const { data: odaData, error } = await supabase.from('oda').insert({
      commessa_id: commessaId, numero, tipo, oggetto: oggetto.trim(),
      fornitore_id: fornitoreId, importo_netto: importoNum, iva_pct: parseFloat(ivaPct),
      ritenuta_pct: parseFloat(ritenuta), condizioni_pagamento: condPag || null,
      data_consegna_prevista: dataConsegna || null, note: note || null, stato: 'EMESSO',
    }).select().single()
    if (error) { setErr(error.message); setSaving(false); return }
    if (tipo === 'SUBAPPALTO' && odaData) {
      const { data: cs } = await supabase.from('contratti_sub').insert({
        commessa_id: commessaId, fornitore_id: fornitoreId, importo_netto: importoNum,
        ritenuta_pct: parseFloat(ritenuta), stato: 'BOZZA'
      }).select().single()
      if (cs) await supabase.from('oda').update({ contratto_sub_id: cs.id }).eq('id', odaData.id)
    }
    if (tipo === 'MATERIALE' && odaData) {
      const { data: dam } = await supabase.from('dam').insert({
        commessa_id: commessaId, fornitore_id: fornitoreId,
        denominazione_materiale: oggetto.trim(), stato: 'IN_ATTESA'
      }).select().single()
      if (dam) await supabase.from('oda').update({ dam_id: dam.id }).eq('id', odaData.id)
    }
    setSaving(false); setModalOpen(false)
    setOggetto(''); setFornitoreId(''); setImportoNetto(''); setNote('')
    await load()
  }

  async function cambiaStato(id: string, stato: string) {
    await supabase.from('oda').update({ stato }).eq('id', id)
    await load()
  }

  const totImpegnato = oda.filter(o => o.stato !== 'ANNULLATO').reduce((s: number, o: any) => s + o.importo_netto, 0)
  const totRitenute = oda.filter(o => o.stato !== 'ANNULLATO').reduce((s: number, o: any) => s + (o.ritenuta_importo || 0), 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {[
          ['ODA emessi', String(oda.filter(o => o.stato !== 'ANNULLATO').length)],
          ['Costi impegnati', '€ ' + fmt(totImpegnato)],
          ['Ritenute accumulate', '€ ' + fmt(totRitenute)],
          ['Da pagare netto', '€ ' + fmt(totImpegnato - totRitenute)],
        ].map(([l, v], i) => (
          <div key={i} className="bg-gray-50 border border-gray-100 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">{l}</p>
            <p className="text-base font-semibold text-gray-900">{v}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Ordini di Acquisto (ODA)</h2>
          <p className="text-xs text-gray-500 mt-0.5">Subappalto → contratto sub · Materiale → DAM automatici</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nuovo ODA
        </button>
      </div>
      {loading
        ? <div className="flex items-center justify-center h-32 gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Caricamento...</div>
        : oda.length === 0
        ? <div className="flex flex-col items-center justify-center h-40 text-gray-400"><FileText className="w-10 h-10 text-gray-200 mb-3" /><p className="text-sm">Nessun ordine emesso</p></div>
        : <div className="space-y-2">
            {oda.map((o: any) => (
              <div key={o.id} className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 select-none"
                  onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                  {expanded === o.id
                    ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                  <span className="text-xs font-mono text-gray-400 w-28 shrink-0">{o.numero}</span>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded font-medium ${TIPI_ODA.find(t => t.value === o.tipo)?.color || ''}`}>
                    {TIPI_ODA.find(t => t.value === o.tipo)?.label}
                  </span>
                  <span className="flex-1 text-sm text-gray-800 truncate">{o.oggetto}</span>
                  <span className="text-xs text-gray-500 shrink-0">{o.fornitore?.ragione_sociale || '—'}</span>
                  <span className="text-sm font-medium text-gray-900 w-32 text-right shrink-0">€ {fmt(o.importo_netto)}</span>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded font-medium ${STATI[o.stato]?.color || ''}`}>
                    {STATI[o.stato]?.label}
                  </span>
                </div>
                {expanded === o.id && (
                  <div className="border-t border-gray-100 bg-gray-50/50 p-4 space-y-3">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div><p className="text-xs text-gray-400 mb-0.5">Data</p><p>{o.data_emissione}</p></div>
                      <div><p className="text-xs text-gray-400 mb-0.5">Consegna</p><p>{o.data_consegna_prevista || '—'}</p></div>
                      <div><p className="text-xs text-gray-400 mb-0.5">Pagamento</p><p>{o.condizioni_pagamento || '—'}</p></div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div><p className="text-xs text-gray-400 mb-0.5">Totale + IVA</p><p>€ {fmt(o.importo_netto * (1 + o.iva_pct / 100))}</p></div>
                      <div><p className="text-xs text-gray-400 mb-0.5">Ritenuta {o.ritenuta_pct}%</p><p className="text-purple-700">€ {fmt(o.ritenuta_importo || 0)}</p></div>
                      <div><p className="text-xs text-gray-400 mb-0.5">Da pagare</p><p className="font-semibold">€ {fmt(o.importo_netto - (o.ritenuta_importo || 0))}</p></div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {o.contratto_sub_id && <span className="text-xs px-2.5 py-1.5 bg-purple-50 text-purple-700 rounded-lg border border-purple-100">✓ Contratto sub generato</span>}
                      {o.dam_id && <span className="text-xs px-2.5 py-1.5 bg-green-50 text-green-700 rounded-lg border border-green-100">✓ DAM generato</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500">Stato →</span>
                      {['CONFERMATO', 'PARZ_EVASO', 'EVASO'].filter(s => s !== o.stato).map(s => (
                        <button key={s} onClick={() => cambiaStato(o.id, s)}
                          className="text-xs px-2.5 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-100">
                          {STATI[s]?.label}
                        </button>
                      ))}
                      <button onClick={() => cambiaStato(o.id, 'ANNULLATO')}
                        className="text-xs px-2.5 py-1 rounded border border-red-100 text-red-500 hover:bg-red-50 ml-auto">
                        Annulla
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
      }
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h2 className="text-base font-semibold">Nuovo ODA</h2>
            <div className="grid grid-cols-4 gap-2">
              {TIPI_ODA.map(t => (
                <button key={t.value} onClick={() => setTipo(t.value)}
                  className={`p-2 rounded-lg border text-xs text-center transition-all ${tipo === t.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 text-gray-500'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            {tipo === 'SUBAPPALTO' && <p className="text-xs p-2 bg-purple-50 text-purple-700 rounded-lg">→ Genera contratto sub automatico (D.Lgs. 36/2023)</p>}
            {tipo === 'MATERIALE' && <p className="text-xs p-2 bg-green-50 text-green-700 rounded-lg">→ Genera DAM per Direzione Lavori automatico</p>}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Oggetto *</label>
              <input value={oggetto} onChange={e => setOggetto(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Fornitore *</label>
              <select value={fornitoreId} onChange={e => setFornitoreId(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2">
                <option value="">Seleziona...</option>
                {fornitori.map((f: any) => <option key={f.id} value={f.id}>{f.ragione_sociale}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Importo netto €</label>
                <input type="number" step="0.01" value={importoNetto} onChange={e => setImportoNetto(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-right" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">IVA %</label>
                <select value={ivaPct} onChange={e => setIvaPct(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2">
                  <option value="22">22%</option>
                  <option value="10">10%</option>
                  <option value="4">4%</option>
                  <option value="0">0%</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Ritenuta %</label>
                <input type="number" value={ritenuta} onChange={e => setRitenuta(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-right" />
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between text-gray-600">
                <span>Totale + IVA</span>
                <span className="font-medium">€ {fmt(totale)}</span>
              </div>
              {ritenutaImporto > 0 && (
                <>
                  <div className="flex justify-between text-purple-600 text-xs">
                    <span>Ritenuta {ritenuta}%</span>
                    <span>- € {fmt(ritenutaImporto)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t border-gray-200 pt-1 mt-1">
                    <span>Da pagare</span>
                    <span>€ {fmt(importoNum - ritenutaImporto)}</span>
                  </div>
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Condizioni pagamento</label>
                <input value={condPag} onChange={e => setCondPag(e.target.value)} placeholder="30 gg. data fattura"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Consegna prevista</label>
                <input type="date" value={dataConsegna} onChange={e => setDataConsegna(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Note</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none" />
            </div>
            {err && <p className="text-xs text-red-600">{err}</p>}
            <div className="flex gap-2">
              <button onClick={() => setModalOpen(false)}
                className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                Annulla
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Crea ODA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
