'use client'
import React from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  details?: string[]
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open, title, description, details, confirmLabel = 'Conferma',
  cancelLabel = 'Annulla', danger = false, onConfirm, onCancel
}: ConfirmDialogProps) {
  if (!open) return null
  return (
    <div
      style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:9000,
        display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(2px)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div style={{ background:'var(--panel)',borderRadius:16,padding:28,width:440,maxWidth:'94vw',
        boxShadow:'0 24px 60px rgba(0,0,0,0.3)',border:'1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex',alignItems:'flex-start',gap:14,marginBottom:18 }}>
          <div style={{ width:44,height:44,borderRadius:12,flexShrink:0,display:'flex',
            alignItems:'center',justifyContent:'center',
            background: danger ? '#fef2f2' : 'var(--accent-light)' }}>
            {danger
              ? <Trash2 size={20} style={{ color:'#dc2626' }} />
              : <AlertTriangle size={20} style={{ color:'var(--accent)' }} />}
          </div>
          <div style={{ flex:1 }}>
            <h3 style={{ fontSize:15,fontWeight:700,color:'var(--t1)',margin:0 }}>{title}</h3>
            <p style={{ fontSize:12,color:'var(--t3)',margin:'2px 0 0' }}>
              {danger ? 'Operazione irreversibile' : 'Conferma richiesta'}
            </p>
          </div>
          <button onClick={onCancel} style={{ background:'none',border:'none',cursor:'pointer',
            color:'var(--t3)',padding:4,borderRadius:6,lineHeight:1 }}>
            <X size={16} />
          </button>
        </div>
        <p style={{ fontSize:13,color:'var(--t2)',lineHeight:1.6,margin:'0 0 14px' }}>
          {description}
        </p>
        {details && details.length > 0 && (
          <div style={{ background:danger?'#fef2f2':'var(--bg)',borderRadius:8,padding:'10px 14px',
            marginBottom:18,border:`1px solid ${danger?'#fca5a5':'var(--border)'}` }}>
            <p style={{ fontSize:11,fontWeight:700,color:danger?'#dc2626':'var(--t3)',
              textTransform:'uppercase',letterSpacing:'0.05em',margin:'0 0 6px' }}>
              Elementi interessati:
            </p>
            {details.map((d,i) => (
              <p key={i} style={{ fontSize:12,color:danger?'#7f1d1d':'var(--t2)',margin:'2px 0',
                display:'flex',alignItems:'center',gap:6 }}>
                <span style={{ color:danger?'#dc2626':'var(--accent)',fontWeight:700 }}>•</span> {d}
              </p>
            ))}
          </div>
        )}
        <div style={{ display:'flex',gap:10,justifyContent:'flex-end' }}>
          <button onClick={onCancel}
            style={{ padding:'9px 18px',borderRadius:9,border:'1px solid var(--border)',
              background:'var(--panel)',color:'var(--t2)',cursor:'pointer',fontSize:13,
              fontWeight:500,transition:'all 0.15s' }}>
            {cancelLabel}
          </button>
          <button onClick={onConfirm}
            style={{ padding:'9px 18px',borderRadius:9,border:'none',cursor:'pointer',
              fontSize:13,fontWeight:600,transition:'all 0.15s',
              background: danger ? '#dc2626' : 'var(--accent)',
              color:'#fff' }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
