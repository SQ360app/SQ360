'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Plus, Camera, CheckCircle2, Clock, XCircle, AlertTriangle, Loader2, Receipt, User, Building } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const TIPI = [
  { value: 'PICCOLO_ACQUISTO', label: 'Piccolo acquisto', color: 'bg-orange-50 text-orange-700' },
  { value: 'RIMBORSO_SPESE', label: 'Rimborso spese', color: 'bg-blue-50 text-blue-700' },
  { value: 'COSTO_INDIRETTO', label: 'Costo indiretto', color: 'bg-gray-50 text-gray-700' },
  { value: 'PROFESSIONISTA', label: 'Professionista', color: 'bg-purple-50 text-purple-700' },
  { value: 'ALTRO', label: 'Altro', color: 'bg-gray-50 text-gray-600' },
]

const SOGLIA_AUTO = 50 // sotto questa soglia: approvazione automatica

export default function SpeseCantierePage() {
  const params = useParams()
  const commessaId = params.id as string
  const [spese, setSpese] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [tipo, setTipo] = useState('PICCOLO_ACQUISTO')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [descrizione, setDescrizione] = useState('')
  const [importo, setImporto] = useState('')
  const [iva, setIva] = useState('22')
  const [fornitore, setFornitore] = useState('')
  const [metodo, setMetodo] = useState('CONTANTI')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const importoNum = parseFloat(importo) || 0
  const totale = importoNum * (1 + parseFloat(iva) / 100)
  const richiedeApp = importoNum > SOGLIA_AUTO

  async function load() {
    setLoading(true)
    const { data: d } = await supabase.from('spese_cantiere').select('*').eq('commessa_id', commessaId).order('data_spesa', { ascending: false })
    setSpese(d || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [commessaId])

  async function handleSave() {
    if (!descrizione.trim()) { setErr('La descrizione è obbligatoria'); return }
    if (importoNum <= 0) { setErr('Inserisci un importo valido'); return }
    setSaving(true)
    const stato = richiedeApp ? 'IN_APPROVAZIONE' : 'REGISTRATA'
    const { error } = await supabase.from('spese_cantiere').insert({
      commessa_id: commessaId, tipo, data_spesa: data,
      descrizione: descrizione.trim(), importo_netto: importoNum,
      iva_pct: parseFloat(iva), fornitore_libero: fornitore.trim() || null,
      metodo_pagamento: metodo, stato,
    })
    if (error) { setErr(error.message); setSaving(false); return }
    setSaving(false); setShowForm(false)
    setDescrizione(''); setImporto(''); setFornitore('')
    await load()
  }

  const totRegistrate = spese.filter(s => ['REGISTRATA','APPROVATA'].includes(s.stato)).reduce((acc: number, s: any) => acc + s.importo_netto, 0)
  const totInApp = spese.filter(s => s.stato === 'IN_APPROVAZIONE').reduce((acc: number, s: any) => acc + s.importo_netto, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 border border-gray-100 rounded-lg p-3"><p className="text-xs text-gray-500 mb-1">Registrate / approvate</p><p className="text-base font-semibold text-gray-900">\u20ac {fmt(totRegistrate)}</p></div>
        <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3"><p className="text-xs text-gray-500 mb-1">In approvazione</p><p className="text-base font-semibold text-yellow-700">\u20ac {fmt(totInApp)}</p></div>
        <div className="bg-gray-50 border border-gray-100 rounded-lg p-3"><p className="text-xs text-gray-500 mb-1">Voci totali</p><p className="text-base font-semibold text-gray-900">{spese.length}</p></div>
      </div>

      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/30 transition-colors">
          <Plus className="w-4 h-4" /> Registra nuova spesa
        </button>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <h3 className="text-sm font-medium text-gray-900">Registra spesa</h3>
          <div className="grid grid-cols-5 gap-2">
            {TIPI.map(t => (
              <button key={t.value} onClick={() => setTipo(t.value)}
                className={`p-2 rounded-lg border text-xs text-center transition-colors ${tipo === t.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 text-gray-500'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 mb-1 block">Data</label><input type="date" value={data} onChange={e => setData(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Metodo</label>
              <select value={metodo} onChange={e => setMetodo(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2">
                <option value="CONTANTI">Contanti</option>
                <option value="CARTA_AZIENDALE">Carta aziendale</option>
                <option value="BONIFICO">Bonifico</option>
                <option value="RIMBORSO_OPERAIO">Rimborso operaio</option>
              </select>
            </div>
          </div>
          <div><label className="text-xs text-gray-500 mb-1 block">Descrizione *</label><input value={descrizione} onChange={e => setDescrizione(e.target.value)} placeholder="es. Viti e tasselli ferramenta Rossi" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-500 mb-1 block">Importo netto \u20ac</label><input type="number" step="0.01" value={importo} onChange={e => setImporto(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-right" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">IVA %</label>
              <select value={iva} onChange={e => setIva(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2">
                <option value="22">22%</option><option value="10">10%</option><option value="4">4%</option><option value="0">0%</option>
              </select>
            </div>
            <div><label className="text-xs text-gray-500 mb-1 block">Totale IVA incl.</label><div className="w-full text-sm border border-gray-100 rounded-lg px-3 py-2 bg-gray-50 text-right font-medium">\u20ac {fmt(totale)}</div></div>
          </div>
          <div><label className="text-xs text-gray-500 mb-1 block">Fornitore (testo libero)</label><input value={fornitore} onChange={e => setFornitore(e.target.value)} placeholder="es. Ferramenta Rossi, Copisteria..." className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" /></div>
          {richiedeApp && importoNum > 0 && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-700"><strong>Richiede approvazione</strong> \u2014 importo superiore a \u20ac {fmt(SOGLIA_AUTO)}. Andrà in stato "In approvazione".</p>
            </div>
          )}
          <button className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-gray-200 rounded-lg text-xs text-gray-400 hover:border-gray-300">
            <Camera className="w-4 h-4" /> Allega foto scontrino / fattura
          </button>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Annulla</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {richiedeApp ? 'Invia per approvazione' : 'Registra spesa'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-24 text-sm text-gray-400 gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Caricamento...</div>
      ) : (
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              <th className="py-2.5 px-3 text-left text-xs font-medium text-gray-500">Data</th>
              <th className="py-2.5 px-3 text-left text-xs font-medium text-gray-500">Tipo</th>
              <th className="py-2.5 px-3 text-left text-xs font-medium text-gray-500">Descrizione</th>
              <th className="py-2.5 px-3 text-left text-xs font-medium text-gray-500">Fornitore</th>
              <th className="py-2.5 px-3 text-right text-xs font-medium text-gray-500">Importo</th>
              <th className="py-2.5 px-3 text-center text-xs font-medium text-gray-500">Stato</th>
            </tr></thead>
            <tbody>
              {spese.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-sm text-gray-400">Nessuna spesa registrata</td></tr>
              ) : spese.map((s: any) => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-2 px-3 text-xs text-gray-500 whitespace-nowrap">{s.data_spesa}</td>
                  <td className="py-2 px-3"><span className={`text-xs px-2 py-0.5 rounded font-medium ${TIPI.find(t => t.value === s.tipo)?.color || ''}`}>{TIPI.find(t => t.value === s.tipo)?.label}</span></td>
                  <td className="py-2 px-3 text-sm text-gray-800">{s.descrizione}</td>
                  <td className="py-2 px-3 text-xs text-gray-500">{s.fornitore_libero || '\u2014'}</td>
                  <td className="py-2 px-3 text-sm text-right font-medium text-gray-900">\u20ac {fmt(s.importo_netto)}</td>
                  <td className="py-2 px-3 flex justify-center">
                    {s.stato === 'REGISTRATA' || s.stato === 'APPROVATA' ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                    : s.stato === 'IN_APPROVAZIONE' ? <Clock className="w-4 h-4 text-yellow-500" />
                    : <XCircle className="w-4 h-4 text-red-500" />}
                  </td>
                </tr>
              ))}
            </tbody>
            {spese.length > 0 && (
              <tfoot><tr className="bg-gray-50 border-t border-gray-200">
                <td colSpan={4} className="py-2 px-3 text-xs font-medium text-gray-500">Totale contabilizzato</td>
                <td className="py-2 px-3 text-sm font-semibold text-right text-gray-900">\u20ac {fmt(totRegistrate)}</td>
                <td />
              </tr></tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
