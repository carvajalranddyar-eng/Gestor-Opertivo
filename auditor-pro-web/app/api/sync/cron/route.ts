import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/sync`, {
    method: 'POST'
  })
  const data = await res.json()
  return NextResponse.json(data)
}
