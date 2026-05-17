import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

// ─── Tipi ────────────────────────────────────────────────────────────────────

export interface SalDocProps {
  sal: {
    numero: number; codice?: string; data_emissione: string
    importo_certificato: number; importo_cumulativo?: number
    ritenuta_garanzia: number; importo_netto: number
    stato: string; note?: string
  }
  commessa: { codice: string; nome: string; committente?: string; importo_contratto?: number }
  voci: { codice: string; descrizione: string; um: string; quantita_periodo: number; prezzo_unitario: number; importo_periodo: number }[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fi = (n: number) =>
  Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fiq = (n: number) =>
  Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('it-IT') : '—'

const STATO_LBL: Record<string, string> = {
  bozza: 'Bozza', emesso: 'Emesso', approvato: 'Approvato',
  fatturato: 'Fatturato', pagato: 'Pagato',
}

// ─── Stili ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page:         { fontFamily: 'Helvetica', fontSize: 9, color: '#111827', backgroundColor: '#fff', paddingBottom: 60 },
  header:       { backgroundColor: '#1e3a5f', padding: '18 40', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerBrand:  { color: '#fff', fontSize: 20, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5 },
  headerSub:    { color: '#93c5fd', fontSize: 8, marginTop: 2 },
  headerRight:  { alignItems: 'flex-end' },
  headerTitle:  { color: '#fff', fontSize: 14, fontFamily: 'Helvetica-Bold' },
  headerNum:    { color: '#93c5fd', fontSize: 10, marginTop: 3, fontFamily: 'Helvetica-Bold' },
  body:         { padding: '20 40' },
  row3:         { flexDirection: 'row', gap: 10, marginBottom: 12 },
  row2:         { flexDirection: 'row', gap: 12, marginBottom: 12 },
  box:          { flex: 1, border: '1 solid #e5e7eb', borderRadius: 4, padding: '10 12' },
  boxTitle:     { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, borderBottom: '1 solid #f3f4f6', paddingBottom: 4 },
  boxRow:       { flexDirection: 'row', marginBottom: 3 },
  boxLabel:     { fontSize: 8, color: '#9ca3af', width: 90, flexShrink: 0 },
  boxValue:     { fontSize: 8.5, color: '#111827', flex: 1, fontFamily: 'Helvetica-Bold' },
  section:      { marginBottom: 12 },
  sectionTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  ecoBox:       { border: '1 solid #e5e7eb', borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  ecoRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '7 12', borderBottom: '1 solid #f3f4f6' },
  ecoRowAlt:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '7 12', borderBottom: '1 solid #f3f4f6', backgroundColor: '#f9fafb' },
  ecoRowTot:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '10 12', backgroundColor: '#f0fdf4', borderTop: '2 solid #16a34a' },
  table:        { border: '1 solid #e5e7eb', borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  tableHead:    { flexDirection: 'row', backgroundColor: '#1e3a5f', padding: '7 8' },
  tableHeadTxt: { color: '#93c5fd', fontSize: 7, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow:     { flexDirection: 'row', padding: '6 8', borderBottom: '1 solid #f3f4f6' },
  tableRowAlt:  { flexDirection: 'row', padding: '6 8', borderBottom: '1 solid #f3f4f6', backgroundColor: '#f9fafb' },
  tableRowTot:  { flexDirection: 'row', padding: '8 8', backgroundColor: '#1e3a5f' },
  noteBox:      { backgroundColor: '#fffbeb', border: '1 solid #fde68a', borderRadius: 4, padding: '8 12', marginBottom: 12 },
  noteText:     { fontSize: 8.5, color: '#92400e', lineHeight: 1.5 },
  sigRow:       { flexDirection: 'row', gap: 20, marginTop: 30 },
  sigBox:       { flex: 1, borderTop: '1.5 solid #374151', paddingTop: 8 },
  sigLabel:     { fontSize: 7.5, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  sigLine:      { marginTop: 30, borderBottom: '1 solid #d1d5db' },
  footer:       { position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTop: '1 solid #e5e7eb', paddingTop: 6 },
  footerTxt:    { fontSize: 7, color: '#9ca3af' },
})

// ─── Documento ────────────────────────────────────────────────────────────────

export function SalDocument({ sal, commessa, voci }: SalDocProps) {
  const cumulPrec  = Math.max(0, (sal.importo_cumulativo || 0) - sal.importo_certificato)
  const totVoci    = voci.reduce((s, v) => s + v.importo_periodo, 0)

  return (
    <Document title={`SAL ${sal.numero} — ${commessa.nome}`} author="SQ360" subject="Stato Avanzamento Lavori">
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.headerBrand}>SQ360</Text>
            <Text style={s.headerSub}>Gestionale Edile Professionale</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerTitle}>STATO AVANZAMENTO LAVORI</Text>
            <Text style={s.headerNum}>N. {sal.numero} — {sal.codice || `SAL-A-${String(sal.numero).padStart(3,'0')}`}</Text>
          </View>
        </View>

        <View style={s.body}>

          {/* Box info */}
          <View style={s.row3}>
            <View style={s.box}>
              <Text style={s.boxTitle}>Commessa</Text>
              <View style={s.boxRow}><Text style={s.boxLabel}>Codice</Text><Text style={s.boxValue}>{commessa.codice}</Text></View>
              <View style={s.boxRow}><Text style={s.boxLabel}>Nome</Text><Text style={s.boxValue}>{commessa.nome}</Text></View>
            </View>
            <View style={s.box}>
              <Text style={s.boxTitle}>Committente</Text>
              <View style={s.boxRow}><Text style={s.boxValue}>{commessa.committente || '—'}</Text></View>
              {!!commessa.importo_contratto && (
                <View style={s.boxRow}><Text style={s.boxLabel}>Contratto</Text><Text style={s.boxValue}>€ {fi(commessa.importo_contratto)}</Text></View>
              )}
            </View>
            <View style={s.box}>
              <Text style={s.boxTitle}>SAL</Text>
              <View style={s.boxRow}><Text style={s.boxLabel}>Data emissione</Text><Text style={s.boxValue}>{fmtDate(sal.data_emissione)}</Text></View>
              <View style={s.boxRow}><Text style={s.boxLabel}>Stato</Text><Text style={s.boxValue}>{STATO_LBL[sal.stato] || sal.stato}</Text></View>
              <View style={s.boxRow}><Text style={s.boxLabel}>Data stampa</Text><Text style={s.boxValue}>{new Date().toLocaleDateString('it-IT')}</Text></View>
            </View>
          </View>

          {/* Quadro economico */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Quadro economico</Text>
            <View style={s.ecoBox}>
              <View style={s.ecoRow}>
                <Text style={{ fontSize: 8.5, color: '#374151' }}>Importo certificato nel periodo</Text>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#111827' }}>€ {fi(sal.importo_certificato)}</Text>
              </View>
              <View style={s.ecoRowAlt}>
                <Text style={{ fontSize: 8.5, color: '#374151' }}>Cumulativo SAL precedenti</Text>
                <Text style={{ fontSize: 9, color: '#6b7280' }}>€ {fi(cumulPrec)}</Text>
              </View>
              <View style={s.ecoRow}>
                <Text style={{ fontSize: 8.5, color: '#374151', fontFamily: 'Helvetica-Bold' }}>Cumulativo totale avanzamento</Text>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#111827' }}>€ {fi(sal.importo_cumulativo || 0)}</Text>
              </View>
              <View style={s.ecoRowAlt}>
                <Text style={{ fontSize: 8.5, color: '#374151' }}>Ritenuta di garanzia 5% (svincolata a collaudo)</Text>
                <Text style={{ fontSize: 9, color: '#7c3aed' }}>(€ {fi(sal.ritenuta_garanzia)})</Text>
              </View>
              <View style={s.ecoRowTot}>
                <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#14532d' }}>NETTO DA FATTURARE</Text>
                <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#059669' }}>€ {fi(sal.importo_netto)}</Text>
              </View>
            </View>
          </View>

          {/* Tabella voci */}
          {voci.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Dettaglio voci nel periodo ({voci.length} voci)</Text>
              <View style={s.table}>
                <View style={s.tableHead}>
                  <Text style={[s.tableHeadTxt, { width: 58 }]}>Codice</Text>
                  <Text style={[s.tableHeadTxt, { flex: 1 }]}>Descrizione</Text>
                  <Text style={[s.tableHeadTxt, { width: 26, textAlign: 'center' }]}>UM</Text>
                  <Text style={[s.tableHeadTxt, { width: 54, textAlign: 'right' }]}>Quantità</Text>
                  <Text style={[s.tableHeadTxt, { width: 60, textAlign: 'right' }]}>P.U. €</Text>
                  <Text style={[s.tableHeadTxt, { width: 68, textAlign: 'right' }]}>Importo €</Text>
                </View>
                {voci.map((v, i) => (
                  <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                    <Text style={{ width: 58, fontSize: 7.5, color: '#6b7280' }}>{v.codice?.slice(0, 12)}</Text>
                    <Text style={{ flex: 1, fontSize: 7.5, color: '#374151' }}>{v.descrizione}</Text>
                    <Text style={{ width: 26, fontSize: 7.5, textAlign: 'center', color: '#6b7280' }}>{v.um}</Text>
                    <Text style={{ width: 54, fontSize: 8, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: '#111827' }}>{fiq(v.quantita_periodo)}</Text>
                    <Text style={{ width: 60, fontSize: 7.5, textAlign: 'right', color: '#6b7280' }}>{fi(v.prezzo_unitario)}</Text>
                    <Text style={{ width: 68, fontSize: 8.5, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: '#1e3a5f' }}>{fi(v.importo_periodo)}</Text>
                  </View>
                ))}
                <View style={s.tableRowTot}>
                  <Text style={{ flex: 1, fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#93c5fd' }}>Totale periodo</Text>
                  <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#4ade80', width: 68, textAlign: 'right' }}>€ {fi(totVoci)}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Note */}
          {!!sal.note && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Note</Text>
              <View style={s.noteBox}>
                <Text style={s.noteText}>{sal.note}</Text>
              </View>
            </View>
          )}

          {/* Firme */}
          <View style={s.sigRow}>
            <View style={s.sigBox}>
              <Text style={s.sigLabel}>Il Direttore dei Lavori</Text>
              <View style={s.sigLine} />
            </View>
            <View style={s.sigBox}>
              <Text style={s.sigLabel}>L'Impresa Appaltatrice</Text>
              <View style={s.sigLine} />
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerTxt}>SQ360 — SAL N.{sal.numero} · {commessa.nome}</Text>
          <Text style={s.footerTxt} render={({ pageNumber, totalPages }) => `Pag. ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
