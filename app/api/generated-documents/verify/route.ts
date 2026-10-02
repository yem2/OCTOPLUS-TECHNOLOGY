import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { sign } from '@/lib/docsign'

// Vérification publique d'un document : code lu sur le PDF (ou via le QR code) → authentique ou non.
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('code')?.trim().toUpperCase()
  if (!code || !/^OCT-[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(code)) return NextResponse.json({ valid: false }, { status: 400 })
  const { rows } = await pool.query(`select g.code, g.employee_id, g.kind, g.issued_at, g.signature, e.name from generated_documents g left join employees e on e.id = g.employee_id where g.code = $1 and g.status = 'Générée'`, [code])
  const doc = rows[0]
  if (!doc || !doc.signature || sign(doc.code, doc.employee_id, doc.kind, doc.issued_at) !== doc.signature) return NextResponse.json({ valid: false })
  return NextResponse.json({ valid: true, kind: doc.kind, employee: doc.name, issuedAt: doc.issued_at })
}
