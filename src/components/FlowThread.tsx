'use client'
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Step {
  label: string
  emoji: string
  codice?: string
  stato?: string
  skipped?: boolean
}

const COLORI: Record<string, string> = {
  // RDA / RDO
  bozza: '#f59e0b', approvata: '#3b82f6', inviata: '#8b5cf6',
  chiusa: '#10b981', annullata: '#6b7280',
  ricevuta: '#8b5cf6', risposta_ricevuta: '#8b5cf6', comparativa: '#f97316', aggiudicata: '#10b981', accettata: '#10b981',
  // DAM/SAM
  inviata_dl: '#3b82f6', rifiutata: '#ef4444', integrazione: '#8b5cf6',
  // ODA
  EMESSO: '#3b82f6', CONFERMATO: '#6366f1', PARZ_EVASO: '#f59e0b',
  EVASO: '#10b981', ANNULLATO: '#6b7280',
  firmato: '#6366f1', in_esecuzione: '#f59e0b', completato: '#10b981', contestato: '#ef4444', annullato: '#6b7280',
}

export interface FlowThreadProps {
  rdoId: string
  rdaId?: string
  richiedeSam?: boolean
}

export function FlowThread({ rdoId, rdaId, richiedeSam }: FlowThreadProps) {
  const [steps, setSteps] = useState<Step[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const newSteps: Step[] = []

      if (rdaId) {
        const { data } = await (supabase as any).from('rda').select('codice,stato').eq('id', rdaId).maybeSingle()
        if (data) newSteps.push({ label: 'RDA', emoji: '📋', codice: data.codice, stato: data.stato })
      }

      const { data: rdo } = await (supabase as any).from('rdo').select('codice,stato,richiede_sam').eq('id', rdoId).maybeSingle()
      if (!cancelled && rdo) {
        newSteps.push({ label: 'RDO', emoji: '📄', codice: rdo.codice, stato: rdo.stato })
        const samRequired = richiedeSam ?? rdo.richiede_sam ?? false

        const { data: damArr } = await (supabase as any).from('dam').select('codice,stato').eq('rdo_id', rdoId).limit(1)
        const dam = damArr?.[0]
        if (dam) {
          newSteps.push({ label: 'SAM', emoji: '🔍', codice: dam.codice, stato: dam.stato })
        } else {
          newSteps.push({
            label: 'SAM', emoji: '🔍',
            stato: samRequired ? 'pending' : 'skipped',
            skipped: !samRequired,
          })
        }

        const { data: odaArr } = await (supabase as any).from('oda').select('numero:codice,stato').eq('rdo_id', rdoId).limit(1)
        const oda = odaArr?.[0]
        if (oda) {
          newSteps.push({ label: 'ODA', emoji: '📦', codice: oda.numero, stato: oda.stato })
        } else {
          newSteps.push({ label: 'ODA', emoji: '📦', stato: 'pending' })
        }
      }

      if (!cancelled) setSteps(newSteps)
    }
    load()
    return () => { cancelled = true }
  }, [rdoId, rdaId, richiedeSam])

  if (steps.length === 0) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' as const }}>
      {steps.map((step, i) => {
        const color = COLORI[step.stato || ''] || '#6b7280'
        const isSkipped  = step.skipped
        const isPending  = step.stato === 'pending'
        const textColor  = isSkipped || isPending ? '#9ca3af' : color
        const bg         = isPending || isSkipped ? 'transparent' : color + '20'
        const border     = `1px ${isPending ? 'dashed' : 'solid'} ${color}40`
        return (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ color: '#9ca3af', fontSize: 9 }}>→</span>}
            <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 600, background: bg, color: textColor, border, whiteSpace: 'nowrap' as const }}>
              {step.emoji} {step.label}
              {step.codice && <span style={{ marginLeft: 2, opacity: 0.8, fontWeight: 400 }}>{step.codice.slice(-7)}</span>}
              {isSkipped && <span style={{ marginLeft: 2, fontSize: 8, fontStyle: 'italic', opacity: 0.8 }}>Non richiesta</span>}
            </span>
          </React.Fragment>
        )
      })}
    </div>
  )
}
