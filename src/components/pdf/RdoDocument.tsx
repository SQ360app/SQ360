import { Document, Page, View, Text, StyleSheet, Image } from '@react-pdf/renderer'
import type { AziendaDoc } from './OdaDocument'

// ─── Tipi ────────────────────────────────────────────────────────────────────

export interface RdoDocProps {
  rdo: {
    codice: string; oggetto?: string; fornitore: string; email_fornitore?: string
    data_scadenza?: string; note?: string; token_offerta?: string; wbs_ref?: string
  }
  commessa: { codice: string; nome: string; committente?: string; cig?: string; cup?: string }
  voci?: { descrizione: string; um: string; quantita: number }[]
  aziendaDoc?: AziendaDoc
  portalUrl?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fiq = (n: number) =>
  Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('it-IT') : '—'

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
  table:       { border: '1 solid #e5e7eb', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  tableHead:   { flexDirection: 'row', backgroundColor: '#1e3a5f', padding: '7 8' },
  tableHeadTxt:{ color: '#93c5fd', fontSize: 7, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow:    { flexDirection: 'row', padding: '6 8', borderBottom: '1 solid #f3f4f6' },
  tableRowAlt: { flexDirection: 'row', padding: '6 8', borderBottom: '1 solid #f3f4f6', backgroundColor: '#f9fafb' },
  noteBox:     { backgroundColor: '#fffbeb', border: '1 solid #fde68a', borderRadius: 4, padding: '8 12', marginBottom: 12 },
  noteText:    { fontSize: 8.5, color: '#92400e', lineHeight: 1.5 },
  istrBox:     { backgroundColor: '#eff6ff', border: '1 solid #bfdbfe', borderRadius: 4, padding: '10 14', marginBottom: 12 },
  istrTitle:   { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1e40af', marginBottom: 6 },
  istrText:    { fontSize: 8, color: '#374151', lineHeight: 1.6, marginBottom: 2 },
  sigRow:      { flexDirection: 'row', gap: 16, marginTop: 20 },
  sigBox:      { flex: 1, border: '1 solid #e5e7eb', borderRadius: 4, padding: '10 12' },
  sigLabel:    { fontSize: 7.5, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  sigLine:     { marginTop: 22, borderBottom: '1 solid #d1d5db' },
  footer:      { position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTop: '1 solid #e5e7eb', paddingTop: 6 },
  footerTxt:   { fontSize: 7, color: '#9ca3af' },
})

// ─── Documento ────────────────────────────────────────────────────────────────

export function RdoDocument({ rdo, commessa, voci = [], aziendaDoc, portalUrl }: RdoDocProps) {
  const qrUrl = portalUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(portalUrl)}`
    : null

  return (
    <Document title={`RDO ${rdo.codice}`} author="SQ360" subject="Richiesta di Offerta">
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
              <Text style={s.headerTitle}>RICHIESTA DI OFFERTA</Text>
              <Text style={s.headerNum}>{rdo.codice}</Text>
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
              <Text style={s.headerTitle}>RICHIESTA DI OFFERTA</Text>
              <Text style={s.headerNum}>{rdo.codice}</Text>
              {!!commessa.cig && <Text style={{ color: '#bfdbfe', fontSize: 8, marginTop: 2 }}>CIG: {commessa.cig}</Text>}
              {!!commessa.cup && <Text style={{ color: '#bfdbfe', fontSize: 8, marginTop: 1 }}>CUP: {commessa.cup}</Text>}
            </View>
          </View>
        )}

        <View style={s.body}>

          {/* Commessa + Destinatario */}
          <View style={s.row2}>
            <View style={s.box}>
              <Text style={s.boxTitle}>Commessa</Text>
              <View style={s.boxRow}><Text style={s.boxLabel}>Codice</Text><Text style={s.boxValue}>{commessa.codice}</Text></View>
              <View style={s.boxRow}><Text style={s.boxLabel}>Nome</Text><Text style={s.boxValue}>{commessa.nome}</Text></View>
              {commessa.committente && <View style={s.boxRow}><Text style={s.boxLabel}>Committente</Text><Text style={s.boxValue}>{commessa.committente}</Text></View>}
            </View>
            <View style={s.box}>
              <Text style={s.boxTitle}>Destinatario</Text>
              <View style={s.boxRow}><Text style={s.boxLabel}>Fornitore</Text><Text style={s.boxValue}>{rdo.fornitore}</Text></View>
              {rdo.email_fornitore && <View style={s.boxRow}><Text style={s.boxLabel}>Email</Text><Text style={s.boxValue}>{rdo.email_fornitore}</Text></View>}
              {rdo.data_scadenza && (
                <View style={s.boxRow}>
                  <Text style={s.boxLabel}>Scadenza</Text>
                  <Text style={[s.boxValue, { color: '#dc2626' }]}>{fmtDate(rdo.data_scadenza)}</Text>
                </View>
              )}
              {rdo.wbs_ref && <View style={s.boxRow}><Text style={s.boxLabel}>WBS</Text><Text style={s.boxValue}>{rdo.wbs_ref}</Text></View>}
            </View>
          </View>

          {/* Oggetto */}
          {!!rdo.oggetto && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Oggetto della richiesta</Text>
              <View style={s.objBox}>
                <Text style={s.objText}>{rdo.oggetto}</Text>
              </View>
            </View>
          )}

          {/* Voci */}
          {voci.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Lavorazioni / Forniture richieste — {voci.length} voci</Text>
              <View style={s.table}>
                <View style={s.tableHead}>
                  <Text style={[s.tableHeadTxt, { width: 22, textAlign: 'center' }]}>#</Text>
                  <Text style={[s.tableHeadTxt, { flex: 1 }]}>Descrizione</Text>
                  <Text style={[s.tableHeadTxt, { width: 28, textAlign: 'center' }]}>UM</Text>
                  <Text style={[s.tableHeadTxt, { width: 56, textAlign: 'right' }]}>Quantità</Text>
                  <Text style={[s.tableHeadTxt, { width: 84, textAlign: 'right' }]}>P.U. offerto €</Text>
                </View>
                {voci.map((v, i) => (
                  <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                    <Text style={{ width: 22, fontSize: 7, color: '#9ca3af', textAlign: 'center' }}>{i + 1}</Text>
                    <Text style={{ flex: 1, fontSize: 7.5, color: '#374151' }}>{v.descrizione}</Text>
                    <Text style={{ width: 28, fontSize: 7.5, textAlign: 'center', color: '#6b7280' }}>{v.um}</Text>
                    <Text style={{ width: 56, fontSize: 8, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: '#111827' }}>{fiq(v.quantita)}</Text>
                    <Text style={{ width: 84, fontSize: 7.5, textAlign: 'right', color: '#9ca3af' }}>___________</Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 7.5, color: '#6b7280', fontStyle: 'italic', marginBottom: 10 }}>
                Compilare i prezzi unitari IVA esclusa. L'importo totale sarà calcolato automaticamente.
              </Text>
            </View>
          )}

          {/* Note */}
          {!!rdo.note && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Note e condizioni</Text>
              <View style={s.noteBox}>
                <Text style={s.noteText}>{rdo.note}</Text>
              </View>
            </View>
          )}

          {/* Istruzioni + QR */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Istruzioni per il fornitore</Text>
            <View style={s.istrBox}>
              {qrUrl ? (
                <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
                  <Image src={qrUrl} style={{ width: 72, height: 72, border: '1 solid #bfdbfe', borderRadius: 4 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.istrTitle}>COMPILARE E INVIARE L'OFFERTA TRAMITE IL PORTALE SICURO</Text>
                    <Text style={s.istrText}>1. Inquadrare il QR code con lo smartphone oppure aprire il link sottostante nel browser.</Text>
                    <Text style={s.istrText}>2. Compilare i prezzi unitari IVA esclusa per ogni voce richiesta.</Text>
                    <Text style={s.istrText}>3. Indicare le condizioni di pagamento e i tempi di disponibilità.</Text>
                    <Text style={s.istrText}>4. Inviare l'offerta tramite il portale entro la scadenza indicata.</Text>
                    <Text style={{ fontSize: 7.5, color: '#2563eb', marginTop: 5 }}>{portalUrl}</Text>
                  </View>
                </View>
              ) : (
                <View>
                  <Text style={s.istrTitle}>ISTRUZIONI PER LA COMPILAZIONE</Text>
                  <Text style={s.istrText}>1. Compilare i prezzi unitari IVA esclusa per ogni voce richiesta.</Text>
                  <Text style={s.istrText}>2. Indicare le condizioni di pagamento (giorni, anticipo %) e i tempi di disponibilità.</Text>
                  <Text style={s.istrText}>3. Restituire l'offerta firmata per posta elettronica entro la scadenza indicata.</Text>
                </View>
              )}
            </View>
          </View>

          {/* Spazio firma fornitore */}
          <View style={s.sigRow}>
            <View style={s.sigBox}>
              <Text style={s.sigLabel}>Importo totale offerto (IVA esclusa)</Text>
              <Text style={{ fontSize: 9, color: '#374151', marginBottom: 4, marginTop: 4 }}>€ ___________________________</Text>
              <View style={s.sigLine} />
            </View>
            <View style={s.sigBox}>
              <Text style={s.sigLabel}>Condizioni di pagamento</Text>
              <Text style={{ fontSize: 9, color: '#374151', marginBottom: 4, marginTop: 4 }}>gg ____ / anticipo ____% / note ________</Text>
              <View style={s.sigLine} />
            </View>
            <View style={s.sigBox}>
              <Text style={s.sigLabel}>Firma e timbro del Fornitore</Text>
              <View style={s.sigLine} />
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
            <Text style={s.footerTxt}>SQ360 — RDO {rdo.codice} · {commessa.nome}</Text>
            <Text style={s.footerTxt} render={({ pageNumber, totalPages }) => `Pag. ${pageNumber} / ${totalPages}`} />
          </View>
        )}
      </Page>
    </Document>
  )
}
