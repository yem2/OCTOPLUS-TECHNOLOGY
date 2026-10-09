// CSV compatible Excel (France / Cameroun) : séparateur « ; », UTF-8 avec BOM.
const cell = (value: unknown) => {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}` // neutralise les formules injectées
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
export const toCsv = (header: string[], rows: unknown[][]) => '\uFEFF' + [header, ...rows].map((row) => row.map(cell).join(';')).join('\r\n')
export const csvResponse = (name: string, body: string) => new Response(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'private, no-store' } })
