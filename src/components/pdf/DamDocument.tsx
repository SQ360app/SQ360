import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

// ─── Tipi ────────────────────────────────────────────────────────────────────

export interface DamDocProps {
  dam: {
    codice: string; revisione: number; materiale: string; descrizione?: string
    quantita: number; um: string; marca_modello?: string
    norma_riferimento?: string; classe_prestazionale?: string
    cam_compliant: boolean; campione_richiesto: boolean; campione_inviato: boolean
    scheda_tecnica: boolean; dichiarazione_prestazione: boolean; certificato_ce: boolean
    stato: string; dl_nome?: string; dl_email?: string
    note_dl?: string; note_interne?: string; data_emissione?: string
    motivo_rifiuto?: string
  }
  commessa: { codice: string; nome: string; committente?: string }
  fornitore?: { ragione_sociale?: string }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fi = (n: number) =>
  Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

const STATO_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  bozza:        { label: 'BOZZA',               bg: '#fef3c7', color: '#92400e' },
  inviata_dl:   { label: 'INVIATA AL DL',       bg: '#dbeafe', color: '#1e40af' },
  approvata:    { label: 'APPROVATA',            bg: '#dcfce7', color: '#14532d' },
  rifiutata:    { label: 'RIFIUTATA',            bg: '#fee2e2', color: '#991b1b' },
  integrazione: { label: 'INTEGRAZIONE RICHIESTA', bg: '#ede9fe', color: '#4c1d95' },
}

// ─── Stili ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page:         { fontFamily: 'Helvetica', fontSize: 9, color: '#111827', backgroundColor: '#fff', paddingBottom: 60 },
  header:       { backgroundColor: '#1e3a5f', padding: '18 40', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerBrand:  { color: '#fff', fontSize: 20, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5 },
  headerSub:    { color: '#93c5fd', fontSize: 8, marginTop: 2 },
  headerRight:  { alignItems: 'flex-end' },
  headerTitle:  { color: '#fff', fontSize: 13, fontFamily: 'Helvetica-Bold' },
  headerMeta:   { color: '#93c5fd', fontSize: 9, marginTop: 3 },
  body:         { padding: '20 40' },
  row2:         { flexDirection: 'row', gap: 12, marginBottom: 12 },
  box:          { flex: 1, border: '1 solid #e5e7eb', borderRadius: 4, padding: '10 12' },
  boxFull:      { border: '1 solid #e5e7eb', borderRadius: 4, padding: '10 12', marginBottom: 12 },
  boxTitle:     { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, borderBottom: '1 solid #f3f4f6', paddingBottom: 4 },
  boxRow:       { flexDirection: 'row', marginBottom: 3 },
  boxLabel:     { fontSize: 8, color: '#9ca3af', width: 100, flexShrink: 0 },
  boxValue:     { fontSize: 8.5, color: '#111827', flex: 1, fontFamily: 'Helvetica-Bold' },
  section:      { marginBottom: 12 },
  sectionTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  chkGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6, backgroundColor: '#f9fafb', border: '1 solid #e5e7eb', borderRadius: 4, padding: '10 12', marginBottom: 12 },
  chkItem:      { flexDirection: 'row', alignItems: 'center', gap: 5, width: '48%' },
  chkBox:       { width: 12, height: 12, borderRadius: 2, border: '1 solid #d1d5db', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chkBoxOk:     { width: 12, height: 12, borderRadius: 2, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chkMark:      { color: '#fff', fontSize: 8, fontFamily: 'Helvetica-Bold', lineHeight: 1 },
  chkLabel:     { fontSize: 8.5, color: '#374151' },
  statoTag:     { padding: '4 10', borderRadius: 3, alignSelf: 'flex-start', marginBottom: 12 },
  statoText:    { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  noteBox:      { backgroundColor: '#fffbeb', border: '1 solid #fde68a', borderRadius: 4, padding: '8 12', marginBottom: 12 },
  noteText:     { fontSize: 8.5, color: '#92400e', lineHeight: 1.5 },
  rifiutoBox:   { backgroundColor: '#fef2f2', border: '1 solid #fecaca', borderRadius: 4, padding: '8 12', marginBottom: 12 },
  rifiutoText:  { fontSize: 8.5, color: '#991b1b', lineHeight: 1.5 },
  sigRow:       { flexDirection: 'row', gap: 20, marginTop: 24 },
  sigBox:       { flex: 1, borderTop: '1.5 solid #374151', paddingTop: 8 },
  sigLabel:     { fontSize: 7.5, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  sigLine:      { marginTop: 28, borderBottom: '1 solid #d1d5db' },
  footer:       { position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTop: '1 solid #e5e7eb', paddingTop: 6 },
  footerTxt:    { fontSize: 7, color: '#9ca3af' },
})

// ─── Check item ───────────────────────────────────────────────────────────────

function CheckItem({ label, ok }: { label: string; ok: boolean }) {
  return (
    <View style={s.chkItem}>
      <View style={ok ? s.chkBoxOk : s.chkBox}>
        {ok && <Text style={s.chkMark}>✓</Text>}
      </View>
      <Text style={s.chkLabel}>{label}</Text>
    </View>
  )
}

// ─── Documento ────────────────────────────────────────────────────────────────

export function DamDocument({ dam, commessa, fornitore }: DamDocProps) {
  const statoConf = STATO_CONFIG[dam.stato] || STATO_CONFIG.bozza
  const dataEmissione = dam.data_emissione
    ? new Date(dam.data_emissione).toLocaleDateString('it-IT')
    : new Date().toLocaleDateString('it-IT')

  return (
    <Document title={`SAM ${dam.codice}`} author="SQ360" subject="Scheda Approvazione Materiali">
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.headerBrand}>SQ360</Text>
            <Text style={s.headerSub}>Gestionale Edile Professionale</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerTitle}>DOSSIER ACCETTAZIONE MATERIALI</Text>
            <Text style={s.headerMeta}>{dam.codice}  ·  Rev. {dam.revisione}  ·  {dataEmissione}</Text>
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
              <Text style={s.boxTitle}>Fornitore proposto</Text>
              {fornitore?.ragione_sociale
                ? <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold' }}>{fornitore.ragione_sociale}</Text>
                : <Text style={{ fontSize: 8.5, color: '#9ca3af', fontStyle: 'italic' }}>Da definire</Text>
              }
              {dam.dl_nome && (
                <View style={{ marginTop: 8 }}>
                  <View style={s.boxRow}><Text style={s.boxLabel}>Direttore Lavori</Text><Text style={s.boxValue}>{dam.dl_nome}</Text></View>
                  {dam.dl_email && <View style={s.boxRow}><Text style={s.boxLabel}>Email DL</Text><Text style={s.boxValue}>{dam.dl_email}</Text></View>}
                </View>
              )}
            </View>
          </View>

          {/* Materiale */}
          <View style={s.boxFull}>
            <Text style={s.boxTitle}>Materiale / Lavorazione</Text>
            <View style={s.boxRow}><Text style={s.boxLabel}>Designazione</Text><Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#111827', flex: 1 }}>{dam.materiale}</Text></View>
            {dam.descrizione && <View style={s.boxRow}><Text style={s.boxLabel}>Descrizione</Text><Text style={{ fontSize: 8.5, color: '#374151', flex: 1, lineHeight: 1.5 }}>{dam.descrizione}</Text></View>}
            <View style={[s.row2, { marginTop: 8, marginBottom: 0 }]}>
              <View style={s.boxRow}><Text style={s.boxLabel}>Quantità</Text><Text style={s.boxValue}>{fi(dam.quantita)} {dam.um}</Text></View>
              {dam.marca_modello && <View style={s.boxRow}><Text style={s.boxLabel}>Marca / Modello</Text><Text style={s.boxValue}>{dam.marca_modello}</Text></View>}
            </View>
            <View style={s.row2}>
              {dam.norma_riferimento && <View style={s.boxRow}><Text style={s.boxLabel}>Norma di rif.</Text><Text style={s.boxValue}>{dam.norma_riferimento}</Text></View>}
              {dam.classe_prestazionale && <View style={s.boxRow}><Text style={s.boxLabel}>Classe prestaz.</Text><Text style={s.boxValue}>{dam.classe_prestazionale}</Text></View>}
            </View>
          </View>

          {/* Documenti */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Documenti allegati</Text>
            <View style={s.chkGrid}>
              <CheckItem label="Scheda tecnica" ok={dam.scheda_tecnica} />
              <CheckItem label="Dichiarazione di prestazione (DoP)" ok={dam.dichiarazione_prestazione} />
              <CheckItem label="Certificato CE" ok={dam.certificato_ce} />
              <CheckItem label="Conformità CAM (D.Lgs. 50/2016)" ok={dam.cam_compliant} />
              <CheckItem label="Campione richiesto" ok={dam.campione_richiesto} />
              <CheckItem label="Campione inviato" ok={dam.campione_inviato} />
            </View>
          </View>

          {/* Stato approvazione */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Stato approvazione</Text>
            <View style={[s.statoTag, { backgroundColor: statoConf.bg }]}>
              <Text style={[s.statoText, { color: statoConf.color }]}>{statoConf.label}</Text>
            </View>
            {dam.stato === 'rifiutata' && dam.motivo_rifiuto && (
              <View style={s.rifiutoBox}>
                <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#991b1b', marginBottom: 3 }}>MOTIVO RIFIUTO</Text>
                <Text style={s.rifiutoText}>{dam.motivo_rifiuto}</Text>
              </View>
            )}
            {dam.note_dl && (
              <View style={s.noteBox}>
                <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#92400e', marginBottom: 3 }}>NOTE DIREZIONE LAVORI</Text>
                <Text style={s.noteText}>{dam.note_dl}</Text>
              </View>
            )}
          </View>

          {/* Firme */}
          <View style={s.sigRow}>
            <View style={s.sigBox}>
              <Text style={s.sigLabel}>L'Impresa Appaltatrice</Text>
              <View style={s.sigLine} />
            </View>
            <View style={s.sigBox}>
              <Text style={s.sigLabel}>Il Fornitore</Text>
              <View style={s.sigLine} />
            </View>
            <View style={s.sigBox}>
              <Text style={s.sigLabel}>La Direzione Lavori</Text>
              <View style={s.sigLine} />
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerTxt}>SQ360 — Gestionale Edile · {dam.codice} Rev.{dam.revisione}</Text>
          <Text style={s.footerTxt} render={({ pageNumber, totalPages }) => `Pag. ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
