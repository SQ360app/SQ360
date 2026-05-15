const base = (content: string) => `
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  body{margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;color:#1e293b}
  .wrap{max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .hdr{background:#1d4ed8;padding:20px 28px;display:flex;align-items:center;gap:10px}
  .hdr-title{color:#fff;font-size:16px;font-weight:700;margin:0}
  .hdr-sub{color:#bfdbfe;font-size:12px;margin:4px 0 0}
  .body{padding:28px}
  .alert-box{border-radius:8px;padding:16px 20px;margin-bottom:20px}
  .kv{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
  .kv:last-child{border-bottom:none}
  .kv-lbl{color:#64748b}
  .kv-val{font-weight:600;color:#1e293b}
  .cta{display:inline-block;padding:11px 24px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin-top:16px}
  .footer{background:#f8fafc;padding:14px 28px;font-size:11px;color:#94a3b8;border-top:1px solid #f1f5f9}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <div>
      <p class="hdr-title">SQ360 — Gestionale Edile</p>
      <p class="hdr-sub">Notifica automatica</p>
    </div>
  </div>
  <div class="body">${content}</div>
  <div class="footer">Questo messaggio è stato generato automaticamente da SQ360. Non rispondere a questa email.</div>
</div>
</body>
</html>`

export function emailDurcScadenza(params: {
  fornitore: string
  dataScadenza: string
  commessa: string
  giorniRimanenti: number
}): { subject: string; html: string } {
  const urgente = params.giorniRimanenti <= 7
  const colore = urgente ? '#dc2626' : '#d97706'
  const sfondo = urgente ? '#fef2f2' : '#fffbeb'
  const bordo = urgente ? '#fecaca' : '#fde68a'
  return {
    subject: `⚠ DURC in scadenza — ${params.fornitore} (${params.giorniRimanenti}gg)`,
    html: base(`
      <div class="alert-box" style="background:${sfondo};border:1px solid ${bordo}">
        <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:${colore}">
          ${urgente ? '🚨 DURC in scadenza imminente' : '⚠ DURC in scadenza'}
        </p>
        <p style="margin:0;font-size:13px;color:#64748b">Azione richiesta: rinnovare il DURC prima della scadenza</p>
      </div>
      <div>
        <div class="kv"><span class="kv-lbl">Fornitore</span><span class="kv-val">${params.fornitore}</span></div>
        <div class="kv"><span class="kv-lbl">Data scadenza DURC</span><span class="kv-val" style="color:${colore}">${params.dataScadenza}</span></div>
        <div class="kv"><span class="kv-lbl">Giorni rimanenti</span><span class="kv-val" style="color:${colore}">${params.giorniRimanenti} giorni</span></div>
        <div class="kv"><span class="kv-lbl">Commessa</span><span class="kv-val">${params.commessa}</span></div>
      </div>
      <a href="https://sq360.app/dashboard" class="cta" style="background:#1d4ed8;color:#fff">Apri SQ360</a>
    `),
  }
}

export function emailOdaCreato(params: {
  codiceOda: string
  oggetto: string
  fornitore: string
  importo: string
  commessa: string
}): { subject: string; html: string } {
  return {
    subject: `✅ Nuovo ODA ${params.codiceOda} — ${params.commessa}`,
    html: base(`
      <div class="alert-box" style="background:#eff6ff;border:1px solid #bfdbfe">
        <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#1d4ed8">📋 Nuovo Ordine di Acquisto emesso</p>
        <p style="margin:0;font-size:13px;color:#64748b">L'ODA è stato creato e inviato al fornitore</p>
      </div>
      <div>
        <div class="kv"><span class="kv-lbl">Codice ODA</span><span class="kv-val" style="font-family:monospace">${params.codiceOda}</span></div>
        <div class="kv"><span class="kv-lbl">Oggetto</span><span class="kv-val">${params.oggetto}</span></div>
        <div class="kv"><span class="kv-lbl">Fornitore</span><span class="kv-val">${params.fornitore}</span></div>
        <div class="kv"><span class="kv-lbl">Importo netto</span><span class="kv-val">€ ${params.importo}</span></div>
        <div class="kv"><span class="kv-lbl">Commessa</span><span class="kv-val">${params.commessa}</span></div>
      </div>
      <a href="https://sq360.app/dashboard" class="cta" style="background:#1d4ed8;color:#fff">Apri SQ360</a>
    `),
  }
}

export function emailDamApprovato(params: {
  materiale: string
  codice: string
  commessa: string
  dlNome?: string
}): { subject: string; html: string } {
  return {
    subject: `✅ DAM approvato — ${params.materiale} — ${params.commessa}`,
    html: base(`
      <div class="alert-box" style="background:#f0fdf4;border:1px solid #bbf7d0">
        <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#16a34a">✅ DAM approvato dalla DL</p>
        <p style="margin:0;font-size:13px;color:#64748b">Il materiale è stato approvato dalla Direzione Lavori</p>
      </div>
      <div>
        <div class="kv"><span class="kv-lbl">Codice DAM</span><span class="kv-val" style="font-family:monospace">${params.codice}</span></div>
        <div class="kv"><span class="kv-lbl">Materiale</span><span class="kv-val">${params.materiale}</span></div>
        ${params.dlNome ? `<div class="kv"><span class="kv-lbl">Approvato da DL</span><span class="kv-val">${params.dlNome}</span></div>` : ''}
        <div class="kv"><span class="kv-lbl">Commessa</span><span class="kv-val">${params.commessa}</span></div>
      </div>
      <a href="https://sq360.app/dashboard/dam" class="cta" style="background:#16a34a;color:#fff">Apri DAM</a>
    `),
  }
}

export function emailFatturaScadenza(params: {
  numeroFattura: string
  dataScadenza: string
  importo: string
  commessa: string
  giorniRimanenti: number
}): { subject: string; html: string } {
  const urgente = params.giorniRimanenti <= 7
  const colore = urgente ? '#dc2626' : '#d97706'
  const sfondo = urgente ? '#fef2f2' : '#fffbeb'
  const bordo = urgente ? '#fecaca' : '#fde68a'
  return {
    subject: `⚠ Fattura ${params.numeroFattura} in scadenza (${params.giorniRimanenti}gg) — €${params.importo}`,
    html: base(`
      <div class="alert-box" style="background:${sfondo};border:1px solid ${bordo}">
        <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:${colore}">
          ${urgente ? '🚨 Fattura in scadenza imminente' : '⚠ Fattura in scadenza'}
        </p>
        <p style="margin:0;font-size:13px;color:#64748b">Verificare il pagamento entro la scadenza</p>
      </div>
      <div>
        <div class="kv"><span class="kv-lbl">Numero fattura</span><span class="kv-val" style="font-family:monospace">${params.numeroFattura}</span></div>
        <div class="kv"><span class="kv-lbl">Data scadenza</span><span class="kv-val" style="color:${colore}">${params.dataScadenza}</span></div>
        <div class="kv"><span class="kv-lbl">Importo</span><span class="kv-val">€ ${params.importo}</span></div>
        <div class="kv"><span class="kv-lbl">Giorni rimanenti</span><span class="kv-val" style="color:${colore}">${params.giorniRimanenti} giorni</span></div>
        <div class="kv"><span class="kv-lbl">Commessa</span><span class="kv-val">${params.commessa}</span></div>
      </div>
      <a href="https://sq360.app/dashboard" class="cta" style="background:#1d4ed8;color:#fff">Apri SQ360</a>
    `),
  }
}

export function emailDurcReport(scadenze: Array<{
  fornitore: string
  dataScadenza: string
  commessa: string
  giorniRimanenti: number
}>): { subject: string; html: string } {
  const righe = scadenze.map(s => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px">${s.fornitore}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:${s.giorniRimanenti <= 7 ? '#dc2626' : '#d97706'};font-weight:600">${s.dataScadenza}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;text-align:right;color:${s.giorniRimanenti <= 7 ? '#dc2626' : '#d97706'};font-weight:700">${s.giorniRimanenti}gg</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#64748b">${s.commessa}</td>
    </tr>
  `).join('')
  return {
    subject: `📋 Report settimanale DURC — ${scadenze.length} scadenz${scadenze.length === 1 ? 'a' : 'e'} in arrivo`,
    html: base(`
      <div class="alert-box" style="background:#fffbeb;border:1px solid #fde68a">
        <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#d97706">📋 Report settimanale DURC</p>
        <p style="margin:0;font-size:13px;color:#64748b">${scadenze.length} DURC in scadenza nei prossimi 30 giorni</p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;border-bottom:2px solid #e2e8f0">Fornitore</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;border-bottom:2px solid #e2e8f0">Scadenza</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;border-bottom:2px solid #e2e8f0">Giorni</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;border-bottom:2px solid #e2e8f0">Commessa</th>
          </tr>
        </thead>
        <tbody>${righe}</tbody>
      </table>
      <a href="https://sq360.app/dashboard" class="cta" style="background:#1d4ed8;color:#fff">Apri SQ360</a>
    `),
  }
}
