import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

// ─── Tipi ────────────────────────────────────────────────────────────────────

export interface ContrattoSubDocProps {
  contratto: {
    tipo?: string; oggetto?: string; importo_netto: number; ritenuta_pct: number
    data_stipula?: string; data_inizio?: string; data_fine_prevista?: string
    percentuale_subappalto?: number; cat_soa?: string; note?: string
  }
  fornitore: { ragione_sociale: string; piva?: string }
  commessa: { codice: string; nome: string; committente?: string; importo_contratto?: number }
  lavoratori?: { nome: string; cognome: string; cf?: string }[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fi = (n: number) =>
  Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('it-IT') : '—'

const TIPO_LBL: Record<string, string> = {
  subappalto: 'Subappalto', subaffidamento: 'Subaffidamento', nolo_caldo: 'Nolo a caldo',
}

// ─── Stili ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page:        { fontFamily: 'Helvetica', fontSize: 9, color: '#111827', backgroundColor: '#fff', paddingBottom: 60 },
  header:      { backgroundColor: '#1e3a5f', padding: '18 40', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerBrand: { color: '#fff', fontSize: 20, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5 },
  headerSub:   { color: '#93c5fd', fontSize: 8, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  headerTitle: { color: '#fff', fontSize: 14, fontFamily: 'Helvetica-Bold' },
  headerSub2:  { color: '#93c5fd', fontSize: 9, marginTop: 3, fontFamily: 'Helvetica-Bold' },
  body:        { padding: '20 40' },
  row2:        { flexDirection: 'row', gap: 12, marginBottom: 12 },
  box:         { flex: 1, border: '1 solid #e5e7eb', borderRadius: 4, padding: '10 12' },
  boxTitle:    { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, borderBottom: '1 solid #f3f4f6', paddingBottom: 4 },
  boxRow:      { flexDirection: 'row', marginBottom: 3 },
  boxLabel:    { fontSize: 8, color: '#9ca3af', width: 95, flexShrink: 0 },
  boxValue:    { fontSize: 8.5, color: '#111827', flex: 1, fontFamily: 'Helvetica-Bold' },
  section:     { marginBottom: 14 },
  sectionTitle:{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, borderBottom: '1 solid #f3f4f6', paddingBottom: 4 },
  objBox:      { backgroundColor: '#f8fafc', border: '1 solid #e5e7eb', borderRadius: 4, padding: '10 12', marginTop: 6 },
  objText:     { fontSize: 10, color: '#111827', fontFamily: 'Helvetica-Bold', lineHeight: 1.5 },
  ecoBox:      { border: '1 solid #e5e7eb', borderRadius: 4, overflow: 'hidden', marginTop: 6 },
  ecoRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '7 12', borderBottom: '1 solid #f3f4f6' },
  ecoRowAlt:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '7 12', borderBottom: '1 solid #f3f4f6', backgroundColor: '#f9fafb' },
  ecoRowTot:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '9 12', backgroundColor: '#1e3a5f' },
  table:       { border: '1 solid #e5e7eb', borderRadius: 4, overflow: 'hidden', marginTop: 6 },
  tableHead:   { flexDirection: 'row', backgroundColor: '#374151', padding: '6 8' },
  tableHeadTxt:{ color: '#f3f4f6', fontSize: 7.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  tableRow:    { flexDirection: 'row', padding: '6 8', borderBottom: '1 solid #f3f4f6' },
  tableRowAlt: { flexDirection: 'row', padding: '6 8', borderBottom: '1 solid #f3f4f6', backgroundColor: '#f9fafb' },
  noteBox:     { backgroundColor: '#fffbeb', border: '1 solid #fde68a', borderRadius: 4, padding: '8 12', marginTop: 6 },
  noteText:    { fontSize: 8.5, color: '#92400e', lineHeight: 1.5 },
  legalBox:    { marginTop: 14, padding: '8 12', backgroundColor: '#f8fafc', border: '1 solid #e5e7eb', borderRadius: 4 },
  legalText:   { fontSize: 7, color: '#9ca3af', lineHeight: 1.5 },
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

export function ContrattoSubDocument({ contratto, fornitore, commessa, lavoratori = [] }: ContrattoSubDocProps) {
  const ritenuta    = (contratto.importo_netto || 0) * ((contratto.ritenuta_pct || 5) / 100)
  const daLiquidare = (contratto.importo_netto || 0) - ritenuta

  return (
    <Document title={`Contratto Sub — ${fornitore.ragione_sociale}`} author="SQ360" subject="Contratto di Subappalto">
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.headerBrand}>SQ360</Text>
            <Text style={s.headerSub}>Gestionale Edile Professionale</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerTitle}>CONTRATTO DI SUBAPPALTO</Text>
            <Text style={s.headerSub2}>{TIPO_LBL[contratto.tipo || ''] || contratto.tipo || 'Subappalto'} · {new Date().toLocaleDateString('it-IT')}</Text>
          </View>
        </View>

        <View style={s.body}>

          {/* Commessa + riferimento */}
          <View style={s.row2}>
            <View style={s.box}>
              <Text style={s.boxTitle}>Commessa</Text>
              <View style={s.boxRow}><Text style={s.boxLabel}>Codice</Text><Text style={s.boxValue}>{commessa.codice}</Text></View>
              <View style={s.boxRow}><Text style={s.boxLabel}>Nome lavori</Text><Text style={s.boxValue}>{commessa.nome}</Text></View>
              {!!commessa.committente && <View style={s.boxRow}><Text style={s.boxLabel}>Committente</Text><Text style={s.boxValue}>{commessa.committente}</Text></View>}
            </View>
            <View style={s.box}>
              <Text style={s.boxTitle}>Riferimenti contrattuali</Text>
              {!!commessa.importo_contratto && (
                <View style={s.boxRow}><Text style={s.boxLabel}>Importo contratto</Text><Text style={s.boxValue}>€ {fi(commessa.importo_contratto)}</Text></View>
              )}
              {!!contratto.percentuale_subappalto && (
                <View style={s.boxRow}><Text style={s.boxLabel}>% subappalto</Text><Text style={s.boxValue}>{contratto.percentuale_subappalto}% (max 40% ex D.Lgs. 36/2023)</Text></View>
              )}
              {!!contratto.cat_soa && (
                <View style={s.boxRow}><Text style={s.boxLabel}>Cat. SOA richiesta</Text><Text style={s.boxValue}>{contratto.cat_soa}</Text></View>
              )}
            </View>
          </View>

          {/* Le parti */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Le parti</Text>
            <View style={s.row2}>
              <View style={s.box}>
                <Text style={s.boxTitle}>Appaltante</Text>
                <Text style={{ fontSize: 8.5, color: '#374151', lineHeight: 1.6 }}>
                  L'impresa appaltatrice, nella persona del proprio legale rappresentante pro-tempore, di seguito denominata «Appaltante».
                </Text>
              </View>
              <View style={s.box}>
                <Text style={s.boxTitle}>Subappaltatore</Text>
                <View style={s.boxRow}><Text style={s.boxLabel}>Ragione sociale</Text><Text style={s.boxValue}>{fornitore.ragione_sociale}</Text></View>
                {!!fornitore.piva && <View style={s.boxRow}><Text style={s.boxLabel}>P.IVA</Text><Text style={s.boxValue}>{fornitore.piva}</Text></View>}
              </View>
            </View>
          </View>

          {/* Oggetto */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Oggetto del contratto</Text>
            <View style={s.objBox}>
              <Text style={s.objText}>{contratto.oggetto || '—'}</Text>
            </View>
          </View>

          {/* Condizioni economiche */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Condizioni economiche</Text>
            <View style={s.ecoBox}>
              <View style={s.ecoRow}>
                <Text style={{ fontSize: 8.5, color: '#374151' }}>Importo netto contrattuale</Text>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#111827' }}>€ {fi(contratto.importo_netto)}</Text>
              </View>
              <View style={s.ecoRowAlt}>
                <Text style={{ fontSize: 8.5, color: '#374151' }}>Ritenuta di garanzia {contratto.ritenuta_pct || 5}% (svincolata a collaudo)</Text>
                <Text style={{ fontSize: 9, color: '#7c3aed' }}>(€ {fi(ritenuta)})</Text>
              </View>
              <View style={s.ecoRowTot}>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#bfdbfe' }}>Da liquidare a SAL</Text>
                <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#4ade80' }}>€ {fi(daLiquidare)}</Text>
              </View>
            </View>
          </View>

          {/* Tempistiche */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Tempistiche</Text>
            <View style={s.row2}>
              <View style={s.box}>
                <Text style={s.boxTitle}>Date contrattuali</Text>
                <View style={s.boxRow}><Text style={s.boxLabel}>Data stipula</Text><Text style={s.boxValue}>{fmtDate(contratto.data_stipula)}</Text></View>
                <View style={s.boxRow}><Text style={s.boxLabel}>Inizio lavori</Text><Text style={s.boxValue}>{fmtDate(contratto.data_inizio)}</Text></View>
                <View style={s.boxRow}><Text style={s.boxLabel}>Fine prevista</Text><Text style={s.boxValue}>{fmtDate(contratto.data_fine_prevista)}</Text></View>
              </View>
            </View>
          </View>

          {/* Personale impiegato */}
          {lavoratori.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Personale impiegato ({lavoratori.length} lavoratori)</Text>
              <View style={s.table}>
                <View style={s.tableHead}>
                  <Text style={[s.tableHeadTxt, { flex: 1 }]}>Nome e Cognome</Text>
                  <Text style={[s.tableHeadTxt, { width: 130 }]}>Codice Fiscale</Text>
                </View>
                {lavoratori.map((l, i) => (
                  <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                    <Text style={{ flex: 1, fontSize: 8.5, color: '#374151', fontFamily: 'Helvetica-Bold' }}>{l.cognome} {l.nome}</Text>
                    <Text style={{ width: 130, fontSize: 8, color: '#6b7280' }}>{l.cf || '—'}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Note */}
          {!!contratto.note && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Note</Text>
              <View style={s.noteBox}>
                <Text style={s.noteText}>{contratto.note}</Text>
              </View>
            </View>
          )}

          {/* Nota legale */}
          <View style={s.legalBox}>
            <Text style={s.legalText}>
              Il presente contratto è redatto ai sensi del D.Lgs. 36/2023. Il subappaltatore è tenuto ad applicare le stesse condizioni normative e retributive previste per i lavoratori dell'appaltatore. La ritenuta del {contratto.ritenuta_pct || 5}% sarà svincolata a collaudo dei lavori. La cessione del subappalto è vietata senza preventiva autorizzazione scritta dell'appaltatore e della stazione appaltante.
            </Text>
          </View>

          {/* Firme */}
          <View style={s.sigRow}>
            <View style={s.sigBox}>
              <Text style={s.sigLabel}>Per l'Appaltante</Text>
              <Text style={s.sigSubLabel}>Luogo e data:</Text>
              <View style={s.sigLine2} />
              <Text style={s.sigSubLabel}>Firma e timbro:</Text>
              <View style={s.sigLine} />
            </View>
            <View style={s.sigBox}>
              <Text style={s.sigLabel}>Per il Subappaltatore</Text>
              <Text style={s.sigSubLabel}>{fornitore.ragione_sociale}</Text>
              <Text style={s.sigSubLabel}>Luogo e data:</Text>
              <View style={s.sigLine2} />
              <Text style={s.sigSubLabel}>Firma e timbro:</Text>
              <View style={s.sigLine} />
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerTxt}>SQ360 — Contratto Sub · {commessa.codice} · {fornitore.ragione_sociale}</Text>
          <Text style={s.footerTxt} render={({ pageNumber, totalPages }) => `Pag. ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
