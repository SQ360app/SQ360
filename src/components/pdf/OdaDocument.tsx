import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

// ─── Tipi ────────────────────────────────────────────────────────────────────

export interface OdaDocProps {
  oda: {
    numero: string; tipo: string; oggetto: string
    importo_netto: number; iva_pct: number; ritenuta_pct: number
    condizioni_pagamento?: string; data_consegna_prevista?: string
    note?: string; stato: string; rdo_id?: string
  }
  commessa: { codice: string; nome: string; committente?: string }
  fornitore?: { ragione_sociale?: string; piva?: string }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fi = (n: number) =>
  Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const TIPO_LBL: Record<string, string> = {
  SUBAPPALTO: 'Subappalto', SUBAFFIDAMENTO: 'Subaffidamento',
  MATERIALE: 'Acquisto materiali', SERVIZIO: 'Servizio / Professionale',
}

const STATO_LBL: Record<string, string> = {
  EMESSO: 'Emesso', CONFERMATO: 'Confermato', PARZ_EVASO: 'Parzialmente evaso',
  EVASO: 'Evaso', ANNULLATO: 'Annullato',
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
  boxLabel:    { fontSize: 8, color: '#9ca3af', width: 90, flexShrink: 0 },
  boxValue:    { fontSize: 8.5, color: '#111827', flex: 1, fontFamily: 'Helvetica-Bold' },
  section:     { marginBottom: 12 },
  sectionTitle:{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  objBox:      { backgroundColor: '#f8fafc', border: '1 solid #e5e7eb', borderRadius: 4, padding: '10 12', marginBottom: 12 },
  objText:     { fontSize: 10, color: '#111827', fontFamily: 'Helvetica-Bold', lineHeight: 1.5 },
  table:       { border: '1 solid #e5e7eb', borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  tableHead:   { flexDirection: 'row', backgroundColor: '#1e3a5f', padding: '7 12' },
  tableHeadTxt:{ color: '#93c5fd', fontSize: 7.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow:    { flexDirection: 'row', padding: '8 12', borderBottom: '1 solid #f3f4f6' },
  tableRowAlt: { flexDirection: 'row', padding: '8 12', borderBottom: '1 solid #f3f4f6', backgroundColor: '#f9fafb' },
  tableRowTotal:{ flexDirection: 'row', padding: '10 12', backgroundColor: '#1e3a5f' },
  tableLbl:    { flex: 1, fontSize: 8.5, color: '#374151' },
  tableVal:    { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#111827', textAlign: 'right', width: 110 },
  tableTotalLbl:{ flex: 1, fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#bfdbfe' },
  tableTotalVal:{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#4ade80', textAlign: 'right', width: 110 },
  noteBox:     { backgroundColor: '#fffbeb', border: '1 solid #fde68a', borderRadius: 4, padding: '8 12', marginBottom: 12 },
  noteText:    { fontSize: 8.5, color: '#92400e', lineHeight: 1.5 },
  condBox:     { backgroundColor: '#eff6ff', border: '1 solid #bfdbfe', borderRadius: 4, padding: '8 12', marginBottom: 12 },
  condText:    { fontSize: 8.5, color: '#1e40af', lineHeight: 1.5 },
  sigRow:      { flexDirection: 'row', gap: 20, marginTop: 30 },
  sigBox:      { flex: 1, borderTop: '1.5 solid #374151', paddingTop: 8 },
  sigLabel:    { fontSize: 7.5, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  sigLine:     { marginTop: 30, borderBottom: '1 solid #d1d5db' },
  footer:      { position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTop: '1 solid #e5e7eb', paddingTop: 6 },
  footerTxt:   { fontSize: 7, color: '#9ca3af' },
  stato:       { fontSize: 8, fontFamily: 'Helvetica-Bold', padding: '3 8', borderRadius: 3, alignSelf: 'flex-start' },
})

// ─── Documento ────────────────────────────────────────────────────────────────

export function OdaDocument({ oda, commessa, fornitore }: OdaDocProps) {
  const importoNetto = oda.importo_netto || 0
  const iva = importoNetto * (oda.iva_pct || 0) / 100
  const totale = importoNetto + iva
  const ritenuta = importoNetto * (oda.ritenuta_pct || 0) / 100
  const daLiquidare = importoNetto - ritenuta
  const dataOggi = new Date().toLocaleDateString('it-IT')

  return (
    <Document title={`ODA ${oda.numero}`} author="SQ360" subject="Ordine di Acquisto">
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.headerBrand}>SQ360</Text>
            <Text style={s.headerSub}>Gestionale Edile Professionale</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerTitle}>ORDINE DI ACQUISTO</Text>
            <Text style={s.headerNum}>{oda.numero}</Text>
          </View>
        </View>

        <View style={s.body}>

          {/* Commessa + Fornitore */}
          <View style={s.row2}>
            <View style={s.box}>
              <Text style={s.boxTitle}>Commessa</Text>
              <View style={s.boxRow}><Text style={s.boxLabel}>Codice</Text><Text style={s.boxValue}>{commessa.codice}</Text></View>
              <View style={s.boxRow}><Text style={s.boxLabel}>Nome</Text><Text style={s.boxValue}>{commessa.nome}</Text></View>
              {commessa.committente && <View style={s.boxRow}><Text style={s.boxLabel}>Committente</Text><Text style={s.boxValue}>{commessa.committente}</Text></View>}
            </View>
            <View style={s.box}>
              <Text style={s.boxTitle}>Fornitore</Text>
              {fornitore?.ragione_sociale
                ? <>
                    <View style={s.boxRow}><Text style={s.boxLabel}>Ragione sociale</Text><Text style={s.boxValue}>{fornitore.ragione_sociale}</Text></View>
                    {fornitore.piva && <View style={s.boxRow}><Text style={s.boxLabel}>P.IVA</Text><Text style={s.boxValue}>{fornitore.piva}</Text></View>}
                  </>
                : <Text style={{ fontSize: 8.5, color: '#9ca3af', fontStyle: 'italic' }}>Fornitore non specificato</Text>
              }
              <View style={{ marginTop: 6 }}>
                <View style={s.boxRow}><Text style={s.boxLabel}>Tipo fornitura</Text><Text style={s.boxValue}>{TIPO_LBL[oda.tipo] || oda.tipo}</Text></View>
                <View style={s.boxRow}><Text style={s.boxLabel}>Data emissione</Text><Text style={s.boxValue}>{dataOggi}</Text></View>
                {oda.data_consegna_prevista && <View style={s.boxRow}><Text style={s.boxLabel}>Consegna prevista</Text><Text style={s.boxValue}>{new Date(oda.data_consegna_prevista).toLocaleDateString('it-IT')}</Text></View>}
              </View>
            </View>
          </View>

          {/* Oggetto */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Oggetto dell'ordine</Text>
            <View style={s.objBox}>
              <Text style={s.objText}>{oda.oggetto}</Text>
            </View>
          </View>

          {/* Importi */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Riepilogo economico</Text>
            <View style={s.table}>
              <View style={s.tableHead}>
                <Text style={[s.tableHeadTxt, { flex: 1 }]}>Voce</Text>
                <Text style={[s.tableHeadTxt, { textAlign: 'right', width: 110 }]}>Importo EUR</Text>
              </View>
              <View style={s.tableRow}>
                <Text style={s.tableLbl}>Importo netto</Text>
                <Text style={s.tableVal}>{fi(importoNetto)}</Text>
              </View>
              <View style={s.tableRowAlt}>
                <Text style={s.tableLbl}>IVA {oda.iva_pct || 0}%</Text>
                <Text style={s.tableVal}>{fi(iva)}</Text>
              </View>
              <View style={s.tableRow}>
                <Text style={[s.tableLbl, { fontFamily: 'Helvetica-Bold' }]}>Totale fattura</Text>
                <Text style={[s.tableVal, { fontSize: 10 }]}>{fi(totale)}</Text>
              </View>
              {oda.ritenuta_pct > 0 && <>
                <View style={s.tableRowAlt}>
                  <Text style={s.tableLbl}>Ritenuta di garanzia {oda.ritenuta_pct}% (svincolata a collaudo)</Text>
                  <Text style={[s.tableVal, { color: '#7c3aed' }]}>- {fi(ritenuta)}</Text>
                </View>
                <View style={s.tableRowTotal}>
                  <Text style={s.tableTotalLbl}>Da liquidare a SAL</Text>
                  <Text style={s.tableTotalVal}>{fi(daLiquidare)}</Text>
                </View>
              </>}
            </View>
          </View>

          {/* Condizioni pagamento */}
          {oda.condizioni_pagamento && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Condizioni di pagamento</Text>
              <View style={s.condBox}>
                <Text style={s.condText}>{oda.condizioni_pagamento}</Text>
              </View>
            </View>
          )}

          {/* Note */}
          {oda.note && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Note</Text>
              <View style={s.noteBox}>
                <Text style={s.noteText}>{oda.note}</Text>
              </View>
            </View>
          )}

          {/* Firme */}
          <View style={s.sigRow}>
            <View style={s.sigBox}>
              <Text style={s.sigLabel}>Il Committente / Appaltatore</Text>
              <View style={s.sigLine} />
            </View>
            <View style={s.sigBox}>
              <Text style={s.sigLabel}>Il Fornitore / Subappaltatore</Text>
              <View style={s.sigLine} />
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerTxt}>SQ360 — Gestionale Edile · {oda.numero}</Text>
          <Text style={s.footerTxt} render={({ pageNumber, totalPages }) => `Pag. ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
