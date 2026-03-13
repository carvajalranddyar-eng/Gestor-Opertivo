import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { loginPSM } from '@/lib/psm/auth'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const odt = searchParams.get('odt')
    const fecha = searchParams.get('fecha')
    const token = await loginPSM()

    let url = `${process.env.PSM_BASE_URL}/consumos?`
    if (odt) url += `odt=${odt}`
    else if (fecha) url += `fechaDesde=${fecha}&fechaHasta=${fecha}`
    else url += `fechaDesde=${new Date().toISOString().split('T')[0]}&fechaHasta=${new Date().toISOString().split('T')[0]}`

    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` }
    })

    return NextResponse.json(res.data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
