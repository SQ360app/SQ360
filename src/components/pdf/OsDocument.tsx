import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

// ─── Tipi ────────────────────────────────────────────────────────────────────

export interface OsDocProps {
  os: {
    numero: number; data_emissione: string; oggetto: string
    tipo: string; descrizione?: string; stato: string
    riserva?: boolean; testo_riserva?: string
    importo_riserva?: number; scadenza_riserva?: string; note?: string
  }
  commessa: { codice: string; nome: string }
  variante?: { numero: number; descrizione: string }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fi = (n: number) =>
  Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('it-IT') : '—'

const TIPO_LBL: Record<string, string> = {
  disposizione: 'Disposizione esecutiva',
  sospensione:  'Sospensione lavori',
  ripresa:      'Ripresa lavori',
  nuovo_prezzo: 'Nuovo prezzo',
  variante:     "Variante in corso d'opera",
}

const STATO_LBL: Record<string, string> = {
  emesso: 'Emesso', firmato: 'Firmato',
  firmato_con_riserva: 'Firmato con Riserva', chiuso: 'Chiuso',
}

// ─── Stili ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page:        { fontFamily: 'Helvetica', fontSize: 9, color: '#111827', backgroundColor: '#fff', paddingBottom: 60 },
  header:      { backgroundColor: '#1e3a5f', padding: '18 40', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerBrand: { color: '#fff', fontSize: 20, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5 },
  headerSub:   { color: '#93c5fd', fontSize: 8, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  headerTitle: { color: '#fff', fontSize: 14, fontFamily: 'Helvetica-Bold' },
  headerNum:   { color: '#93c5fd', fontSize: 10, marginTop: 3, fontFamily: 'Helvetica-Bold' },
  body:        { padding: '20 40' },
  row2:        { flexDirection: 'row', gap: 12, marginBottom: 12 },
  box:         { flex: 1, border: '1 solid #e5e7eb', borderRadius: 4, padding: '10 12' },
  boxTitle:    { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, borderBottom: '1 solid #f3f4f6', paddingBottom: 4 },
  boxRow:      { flexDirection: 'row', marginBottom: 3 },
  boxLabel:    { fontSize: 8, color: '#9ca3af', width: 80, flexShrink: 0 },
  boxValue:    { fontSize: 8.5, color: '#111827', flex: 1, fontFamily: 'Helvetica-Bold' },
  section:     { marginBottom: 14 },
  sectionTitle:{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  oggBox:      { borderLeft: '4 solid #2563eb', backgroundColor: '#f8fafc', border: '1 solid #e5e7eb', borderRadius: 4, padding: '12 14 12 14', marginBottom: 14 },
  oggText:     { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#111827', lineHeight: 1.4 },
  descBox:     { border: '1 solid #e5e7eb', borderRadius: 4, padding: '10 12', backgroundColor: '#f9fafb', marginBottom: 12 },
  descText:    { fontSize: 9, color: '#374151', lineHeight: 1.6 },
  varBox:      { flexDirection: 'row', alignItems: 'center', gap: 8, border: '1 solid #c4b5fd', borderRadius: 4, padding: '8 12', backgroundColor: '#faf5ff', marginBottom: 12 },
  riservaBox:  { border: '1.5 solid #fca5a5', borderRadius: 4, padding: '12 14', backgroundColor: '#fef2f2', marginBottom: 12 },
  riservaTitle:{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#dc2626', marginBottom: 8 },
  riservaRow:  { flexDirection: 'row', marginBottom: 4 },
  riservaLabel:{ fontSize: 8, color: '#9ca3af', width: 90, flexShrink: 0 },
  riservaValue:{ fontSize: 8.5, color: '#7f1d1d', flex: 1, fontFamily: 'Helvetica-Bold' },
  riservaText: { fontSize: 8.5, color: '#7f1d1d', lineHeight: 1.5, marginTop: 6, borderTop: '1 solid #fecaca', paddingTop: 6 },
  noteBox:     { backgroundColor: '#fffbeb', border: '1 solid #fde68a', borderRadius: 4, padding: '8 12', marginBottom: 12 },
  noteText:    { fontSize: 8.5, color: '#92400e', lineHeight: 1.5 },
  sigRow:      { flexDirection: 'row', gap: 20, marginTop: 30 },
  sigBox:      { flex: 1, borderTop: '1.5 solid #374151', paddingTop: 8 },
  sigLabel:    { fontSize: 7.5, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  sigSubLabel: { fontSize: 7, color: '#9ca3af', marginTop: 3 },
  sigLine:     { marginTop: 30, borderBottom: '1 solid #d1d5db' },
  sigLine2:    { marginTop: 12, borderBottom: '1 solid #d1d5db' },
  footer:      { position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTop: '1 solid #e5e7eb', paddingTop: 6 },
  footerTxt:   { fontSize: 7, color: '#9ca3af' },
})

// ─── Documento ────────────────────────────────────────────────────────────────

export function OsDocument({ os, commessa, variante }: OsDocProps) {
  return (
    <Document title={`OS ${os.numero} — ${commessa.nome}`} author="SQ360" subject="Ordine di Servizio">
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.headerBrand}>SQ360</Text>
            <Text style={s.headerSub}>Gestionale Edile Professionale</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerTitle}>ORDINE DI SERVIZIO</Text>
            <Text style={s.headerNum}>N. {os.numero}</Text>
          </View>
        </View>

        <View style={s.body}>

          {/* Box info */}
          <View style={s.row2}>
            <View style={s.box}>
              <Text style={s.boxTitle}>Commessa</Text>
              <View style={s.boxRow}><Text style={s.boxLabel}>Codice</Text><Text style={s.boxValue}>{commessa.codice}</Text></View>
              <View style={s.boxRow}><Text style={s.boxLabel}>Nome</Text><Text style={s.boxValue}>{commessa.nome}</Text></View>
            </View>
            <View style={s.box}>
              <Text style={s.boxTitle}>Ordine di Servizio</Text>
              <View style={s.boxRow}><Text style={s.boxLabel}>Data emissione</Text><Text style={s.boxValue}>{fmtDate(os.data_emissione)}</Text></View>
              <View style={s.boxRow}><Text style={s.boxLabel}>Tipo</Text><Text style={s.boxValue}>{TIPO_LBL[os.tipo] || os.tipo}</Text></View>
              <View style={s.boxRow}><Text style={s.boxLabel}>Stato</Text><Text style={s.boxValue}>{STATO_LBL[os.stato] || os.stato}</Text></View>
              {os.riserva && <View style={s.boxRow}><Text style={[s.boxValue, { color: '#dc2626' }]}>⚠ RISERVA ISCRITTA</Text></View>}
            </View>
          </View>

          {/* Oggetto */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Oggetto</Text>
            <View style={s.oggBox}>
              <Text style={s.oggText}>{os.oggetto}</Text>
            </View>
          </View>

          {/* Descrizione estesa */}
          {!!os.descrizione && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Descrizione estesa</Text>
              <View style={s.descBox}>
                <Text style={s.descText}>{os.descrizione}</Text>
              </View>
            </View>
          )}

          {/* Variante collegata */}
          {variante && (
            <View style={s.varBox}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#7c3aed' }}>Variante collegata:</Text>
              <Text style={{ fontSize: 9, color: '#4c1d95', flex: 1 }}>Var. {variante.numero} — {variante.descrizione?.slice(0, 90)}</Text>
            </View>
          )}

          {/* Riserva */}
          {os.riserva && (
            <View style={s.riservaBox}>
              <Text style={s.riservaTitle}>⚠  RISERVA ISCRITTA</Text>
              {!!os.importo_riserva && (
                <View style={s.riservaRow}>
                  <Text style={s.riservaLabel}>Importo richiesto</Text>
                  <Text style={s.riservaValue}>€ {fi(os.importo_riserva)}</Text>
                </View>
              )}
              {!!os.scadenza_riserva && (
                <View style={s.riservaRow}>
                  <Text style={s.riservaLabel}>Scadenza iscrizione</Text>
                  <Text style={s.riservaValue}>{fmtDate(os.scadenza_riserva)}</Text>
                </View>
              )}
              {!!os.testo_riserva && <Text style={s.riservaText}>{os.testo_riserva}</Text>}
            </View>
          )}

          {/* Note */}
          {!!os.note && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Note</Text>
              <View style={s.noteBox}>
                <Text style={s.noteText}>{os.note}</Text>
              </View>
            </View>
          )}

          {/* Firme */}
          <View style={s.sigRow}>
            <View style={s.sigBox}>
              <Text style={s.sigLabel}>La Direzione Lavori emette</Text>
              <Text style={s.sigSubLabel}>Luogo e data:</Text>
              <View style={s.sigLine2} />
              <Text style={s.sigSubLabel}>Firma e timbro:</Text>
              <View style={s.sigLine} />
            </View>
            <View style={s.sigBox}>
              <Text style={s.sigLabel}>L'Impresa riceve</Text>
              <Text style={s.sigSubLabel}>Luogo e data:</Text>
              <View style={s.sigLine2} />
              <Text style={s.sigSubLabel}>Firma e timbro:</Text>
              <View style={s.sigLine} />
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerTxt}>SQ360 — OS N.{os.numero} · {commessa.nome} · {fmtDate(os.data_emissione)}</Text>
          <Text style={s.footerTxt} render={({ pageNumber, totalPages }) => `Pag. ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
