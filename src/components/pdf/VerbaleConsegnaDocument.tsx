import { Document, Page, View, Text, StyleSheet, Image } from '@react-pdf/renderer'
import type { AziendaDoc } from './OdaDocument'

// ─── Tipi ────────────────────────────────────────────────────────────────────

export interface VerbaleConsegnaProps {
  commessa: {
    codice: string; nome: string; committente?: string
    cig?: string; cup?: string
    data_inizio?: string
    indirizzo_cantiere?: string; comune_cantiere?: string; provincia?: string
  }
  figure?: {
    rup?: string; dl?: string; capocantiere?: string; rspp?: string; cse?: string
  }
  dataConsegna?: string
  oraConsegna?: string
  note?: string
  aziendaDoc?: AziendaDoc
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtDate = (d?: string) => {
  if (!d) return new Date().toLocaleDateString('it-IT')
  return new Date(d).toLocaleDateString('it-IT')
}

// ─── Stili ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page:        { fontFamily: 'Helvetica', fontSize: 9, color: '#111827', backgroundColor: '#fff', paddingBottom: 70 },
  header:      { backgroundColor: '#1e3a5f', padding: '18 40', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerBrand: { color: '#fff', fontSize: 20, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5 },
  headerSub:   { color: '#93c5fd', fontSize: 8, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  headerTitle: { color: '#fff', fontSize: 13, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  headerNum:   { color: '#93c5fd', fontSize: 10, marginTop: 3, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  body:        { padding: '16 40' },
  titleBar:    { backgroundColor: '#1e3a5f', padding: '14 40', textAlign: 'center', marginBottom: 16 },
  titleText:   { color: '#fff', fontSize: 15, fontFamily: 'Helvetica-Bold', letterSpacing: 2, textAlign: 'center' },
  titleSub:    { color: '#93c5fd', fontSize: 9, marginTop: 4, textAlign: 'center' },
  row2:        { flexDirection: 'row', gap: 12, marginBottom: 12 },
  box:         { flex: 1, border: '1 solid #e5e7eb', borderRadius: 4, padding: '10 12' },
  boxFull:     { border: '1 solid #e5e7eb', borderRadius: 4, padding: '10 12', marginBottom: 12 },
  boxTitle:    { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, borderBottom: '1 solid #f3f4f6', paddingBottom: 4 },
  boxRow:      { flexDirection: 'row', marginBottom: 3 },
  boxLabel:    { fontSize: 8, color: '#9ca3af', width: 110, flexShrink: 0 },
  boxValue:    { fontSize: 8.5, color: '#111827', flex: 1, fontFamily: 'Helvetica-Bold' },
  section:     { marginBottom: 12 },
  sectionTitle:{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  declBox:     { backgroundColor: '#f0fdf4', border: '1.5 solid #86efac', borderRadius: 4, padding: '10 14', marginBottom: 12 },
  declTitle:   { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#166534', marginBottom: 6 },
  declText:    { fontSize: 8.5, color: '#166534', lineHeight: 1.7 },
  noteBox:     { border: '1 solid #e5e7eb', borderRadius: 4, padding: '10 12', minHeight: 50, marginBottom: 12 },
  noteLabel:   { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  sigGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  sigBox:      { width: '48%', border: '1 solid #e5e7eb', borderRadius: 4, padding: '8 10' },
  sigLabel:    { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  sigName:     { fontSize: 8.5, color: '#1e3a5f', fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  sigSub:      { fontSize: 7.5, color: '#6b7280', marginBottom: 2 },
  sigLine:     { marginTop: 22, borderBottom: '1 solid #d1d5db' },
  sigDate:     { fontSize: 7, color: '#9ca3af', marginTop: 5, textAlign: 'right' },
  footer:      { position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTop: '1 solid #e5e7eb', paddingTop: 6 },
  footerTxt:   { fontSize: 7, color: '#9ca3af' },
  normBox:     { backgroundColor: '#fefce8', border: '1 solid #fde047', borderRadius: 3, padding: '5 10', marginBottom: 12 },
  normText:    { fontSize: 7.5, color: '#713f12', lineHeight: 1.5 },
})

// ─── Documento ────────────────────────────────────────────────────────────────

export function VerbaleConsegnaDocument({
  commessa, figure = {}, dataConsegna, oraConsegna, note, aziendaDoc
}: VerbaleConsegnaProps) {
  const oggi = dataConsegna ? fmtDate(dataConsegna) : new Date().toLocaleDateString('it-IT')
  const ora = oraConsegna || new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })

  return (
    <Document title={`Verbale Consegna Lavori — ${commessa.codice}`} author="SQ360" subject="Verbale di Consegna Lavori">
      <Page size="A4" style={s.page}>

        {/* Header */}
        {aziendaDoc?.carta_intestata_header_url ? (
          <>
            <Image src={aziendaDoc.carta_intestata_header_url} style={{ width: '100%' }} />
            {!!commessa.cig && (
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16, padding: '4 40', backgroundColor: '#f8fafc', borderBottom: '1 solid #e5e7eb' }}>
                <Text style={{ fontSize: 8, color: '#374151' }}>CIG: {commessa.cig}</Text>
                {!!commessa.cup && <Text style={{ fontSize: 8, color: '#374151' }}>CUP: {commessa.cup}</Text>}
              </View>
            )}
          </>
        ) : aziendaDoc?.logo_url ? (
          <View style={s.header}>
            <Image src={aziendaDoc.logo_url} style={{ height: 36, maxWidth: 160 }} />
            <View style={s.headerRight}>
              <Text style={s.headerTitle}>VERBALE DI CONSEGNA LAVORI</Text>
              <Text style={s.headerNum}>{commessa.codice}</Text>
              {!!commessa.cig && <Text style={{ color: '#bfdbfe', fontSize: 8, marginTop: 2 }}>CIG: {commessa.cig}</Text>}
              {!!commessa.cup && <Text style={{ color: '#bfdbfe', fontSize: 8, marginTop: 1 }}>CUP: {commessa.cup}</Text>}
            </View>
          </View>
        ) : (
          <View style={s.header}>
            <View>
              <Text style={s.headerBrand}>SQ360</Text>
              <Text style={s.headerSub}>Gestionale Edile Professionale</Text>
            </View>
            <View style={s.headerRight}>
              <Text style={s.headerTitle}>VERBALE DI CONSEGNA LAVORI</Text>
              <Text style={s.headerNum}>{commessa.codice}</Text>
              {!!commessa.cig && <Text style={{ color: '#bfdbfe', fontSize: 8, marginTop: 2 }}>CIG: {commessa.cig}</Text>}
              {!!commessa.cup && <Text style={{ color: '#bfdbfe', fontSize: 8, marginTop: 1 }}>CUP: {commessa.cup}</Text>}
            </View>
          </View>
        )}

        <View style={s.body}>

          {/* Titolo */}
          <View style={s.titleBar}>
            <Text style={s.titleText}>VERBALE DI CONSEGNA LAVORI</Text>
            <Text style={s.titleSub}>ai sensi dell'art. 5 D.M. 49/2018 e D.Lgs. 36/2023 art. 114</Text>
          </View>

          {/* Opera + Data */}
          <View style={s.row2}>
            <View style={s.box}>
              <Text style={s.boxTitle}>Opera</Text>
              <View style={s.boxRow}><Text style={s.boxLabel}>Codice commessa</Text><Text style={s.boxValue}>{commessa.codice}</Text></View>
              <View style={s.boxRow}><Text style={s.boxLabel}>Oggetto lavori</Text><Text style={s.boxValue}>{commessa.nome}</Text></View>
              {commessa.committente && <View style={s.boxRow}><Text style={s.boxLabel}>Stazione appaltante</Text><Text style={s.boxValue}>{commessa.committente}</Text></View>}
              {commessa.cig && <View style={s.boxRow}><Text style={s.boxLabel}>CIG</Text><Text style={[s.boxValue, { fontFamily: 'Helvetica' }]}>{commessa.cig}</Text></View>}
              {commessa.cup && <View style={s.boxRow}><Text style={s.boxLabel}>CUP</Text><Text style={[s.boxValue, { fontFamily: 'Helvetica' }]}>{commessa.cup}</Text></View>}
            </View>
            <View style={s.box}>
              <Text style={s.boxTitle}>Luogo e data consegna</Text>
              <View style={s.boxRow}><Text style={s.boxLabel}>Data consegna</Text><Text style={[s.boxValue, { color: '#1e3a5f' }]}>{oggi}</Text></View>
              <View style={s.boxRow}><Text style={s.boxLabel}>Ora consegna</Text><Text style={[s.boxValue, { color: '#1e3a5f' }]}>{ora}</Text></View>
              {commessa.indirizzo_cantiere && (
                <View style={s.boxRow}><Text style={s.boxLabel}>Indirizzo cantiere</Text><Text style={s.boxValue}>{commessa.indirizzo_cantiere}</Text></View>
              )}
              {(commessa.comune_cantiere || commessa.provincia) && (
                <View style={s.boxRow}>
                  <Text style={s.boxLabel}>Comune</Text>
                  <Text style={s.boxValue}>{commessa.comune_cantiere || ''}{commessa.provincia ? ` (${commessa.provincia})` : ''}</Text>
                </View>
              )}
              {commessa.data_inizio && (
                <View style={{ marginTop: 4 }}>
                  <View style={s.boxRow}><Text style={s.boxLabel}>Data contrattuale inizio</Text><Text style={s.boxValue}>{fmtDate(commessa.data_inizio)}</Text></View>
                </View>
              )}
            </View>
          </View>

          {/* Figure presenti */}
          <View style={s.boxFull}>
            <Text style={s.boxTitle}>Figure presenti alla consegna</Text>
            {figure.rup && <View style={s.boxRow}>
              <Text style={s.boxLabel}>Responsabile Unico del Progetto (RUP)</Text>
              <Text style={s.boxValue}>{figure.rup}</Text>
            </View>}
            {figure.dl && <View style={s.boxRow}>
              <Text style={s.boxLabel}>Direttore dei Lavori (DL)</Text>
              <Text style={s.boxValue}>{figure.dl}</Text>
            </View>}
            {figure.cse && <View style={s.boxRow}>
              <Text style={s.boxLabel}>Coordinatore Sicurezza Esecuzione (CSE)</Text>
              <Text style={s.boxValue}>{figure.cse}</Text>
            </View>}
            {figure.capocantiere && <View style={s.boxRow}>
              <Text style={s.boxLabel}>Capocantiere dell'Impresa</Text>
              <Text style={s.boxValue}>{figure.capocantiere}</Text>
            </View>}
            {figure.rspp && <View style={s.boxRow}>
              <Text style={s.boxLabel}>RSPP dell'Impresa</Text>
              <Text style={s.boxValue}>{figure.rspp}</Text>
            </View>}
            {!figure.rup && !figure.dl && !figure.capocantiere && (
              <Text style={{ fontSize: 8, color: '#9ca3af', fontStyle: 'italic' }}>
                Completare le figure professionali nell'anagrafica commessa prima di generare il verbale.
              </Text>
            )}
          </View>

          {/* Dichiarazione */}
          <View style={s.declBox}>
            <Text style={s.declTitle}>DICHIARAZIONE DI CONSEGNA</Text>
            <Text style={s.declText}>
              Il Direttore dei Lavori, con il presente verbale, consegna all'Impresa Esecutrice le aree e i luoghi
              destinati all'esecuzione dei lavori relativi all'appalto in oggetto, nonché copia dei disegni esecutivi,
              del capitolato speciale e di tutta la documentazione necessaria per l'avvio delle lavorazioni.
            </Text>
            <Text style={[s.declText, { marginTop: 5 }]}>
              L'Impresa, con la sottoscrizione del presente verbale, dichiara di aver preso visione dello stato dei
              luoghi, di accettare le aree consegnate nello stato in cui si trovano, e di essere in grado di dare
              immediato inizio ai lavori ai sensi dell'art. 5 del D.M. 49/2018.
            </Text>
          </View>

          {/* Nota normativa */}
          <View style={s.normBox}>
            <Text style={s.normText}>
              ⚖️ Riferimento normativo: D.Lgs. 36/2023 art. 114 — D.M. 49/2018 art. 5 — D.Lgs. 81/2008 art. 99 (notifica preliminare).
              Il presente verbale fa parte del giornale dei lavori. Copia va trasmessa alla stazione appaltante entro 5 giorni dalla consegna.
            </Text>
          </View>

          {/* Note libere */}
          <View style={s.noteBox}>
            <Text style={s.noteLabel}>Note e rilievi</Text>
            <Text style={{ fontSize: 8.5, color: '#374151', lineHeight: 1.6 }}>
              {note || ' '}
            </Text>
          </View>

          {/* Firme */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Firme per presa d'atto</Text>
            <View style={s.sigGrid}>
              {/* RUP */}
              <View style={s.sigBox}>
                <Text style={s.sigLabel}>Il Responsabile Unico del Progetto</Text>
                {figure.rup && <Text style={s.sigName}>{figure.rup}</Text>}
                <Text style={s.sigSub}>RUP — D.Lgs. 36/2023 art. 15</Text>
                <View style={s.sigLine} />
                <Text style={s.sigDate}>Data: ______/______/________</Text>
              </View>
              {/* DL */}
              <View style={s.sigBox}>
                <Text style={s.sigLabel}>Il Direttore dei Lavori</Text>
                {figure.dl && <Text style={s.sigName}>{figure.dl}</Text>}
                <Text style={s.sigSub}>DL — D.Lgs. 36/2023 art. 114</Text>
                <View style={s.sigLine} />
                <Text style={s.sigDate}>Data: ______/______/________</Text>
              </View>
              {/* CSE */}
              <View style={s.sigBox}>
                <Text style={s.sigLabel}>Il Coord. Sicurezza in Esecuzione</Text>
                {figure.cse && <Text style={s.sigName}>{figure.cse}</Text>}
                <Text style={s.sigSub}>CSE — D.Lgs. 81/2008 art. 92</Text>
                <View style={s.sigLine} />
                <Text style={s.sigDate}>Data: ______/______/________</Text>
              </View>
              {/* Impresa */}
              <View style={s.sigBox}>
                <Text style={s.sigLabel}>L'Impresa Esecutrice (Capocantiere/RC)</Text>
                {figure.capocantiere && <Text style={s.sigName}>{figure.capocantiere}</Text>}
                <Text style={s.sigSub}>Per accettazione ed inizio lavori</Text>
                <View style={s.sigLine} />
                <Text style={s.sigDate}>Data: ______/______/________</Text>
              </View>
            </View>
          </View>

        </View>

        {/* Footer */}
        {aziendaDoc?.carta_intestata_footer_url ? (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} fixed>
            <Image src={aziendaDoc.carta_intestata_footer_url} style={{ width: '100%' }} />
          </View>
        ) : (
          <View style={s.footer} fixed>
            <Text style={s.footerTxt}>SQ360 — Verbale Consegna Lavori · {commessa.codice} · {oggi}</Text>
            <Text style={s.footerTxt} render={({ pageNumber, totalPages }) => `Pag. ${pageNumber} / ${totalPages}`} />
          </View>
        )}
      </Page>
    </Document>
  )
}
