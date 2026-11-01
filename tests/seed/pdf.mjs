// ─── PDF sintetici minimi (una pagina A4, testo Helvetica), senza dipendenze ──
// Ogni documento riporta in alto "DOCUMENTO DI PROVA — DATI INVENTATI".

const esc = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '?').replace(/([\\()])/g, '\\$1')

/** righe: array di stringhe o { t, size, bold } */
export function creaPdf(titolo, righe) {
  const tutte = [
    { t: 'DOCUMENTO DI PROVA - DATI INVENTATI - SQ360 TEST', size: 9, bold: true },
    { t: '' }, { t: titolo, size: 16, bold: true }, { t: '' },
    ...righe.map(r => (typeof r === 'string' ? { t: r } : r)),
  ]
  let y = 800
  const testo = tutte.map(r => {
    const size = r.size || 11
    const op = `BT /${r.bold ? 'F2' : 'F1'} ${size} Tf 50 ${y} Td (${esc(r.t)}) Tj ET`
    y -= size + 7
    return op
  }).join('\n')
  const oggetti = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${Buffer.byteLength(testo)} >>\nstream\n${testo}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offs = []
  oggetti.forEach((o, i) => { offs.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${oggetti.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')
  pdf += `trailer\n<< /Size ${oggetti.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}
