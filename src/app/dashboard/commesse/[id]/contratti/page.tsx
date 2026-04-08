'use client'
import { useParams } from 'next/navigation'
export default function Page() {
  const { id } = useParams() as { id: string }
  return (
    <div style={{ padding: '48px 32px', textAlign: 'center', color: 'var(--t3)' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t2)', marginBottom: 8 }}>Modulo in costruzione</div>
      <div style={{ fontSize: 13 }}>Sarà disponibile nella prossima sessione · Commessa: {id}</div>
    </div>
  )
}
