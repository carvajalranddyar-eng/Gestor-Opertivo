import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { loginPSM } from '@/lib/psm/auth'


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const odt = searchParams.get('odt') || '31305963'
    const token = await loginPSM()


    // Usar proxy si está configurado, si no usar PSM directo
    const baseUrl = process.env.PSM_PROXY_URL || process.env.PSM_BASE_URL;

    // Buscar en consumos
    const resConsumos = await axios.get(
      `${baseUrl}/consumos?odt=${odt}`,
      { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
    )


    // Buscar fotos via informePiezas con el número exacto
    const resFotos = await axios.get(
      `${baseUrl}/informePiezas/tablaFiltradaOdt?ultimaPieza=false&page=0&pageSize=50`,
      { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
    )


    const todas = resFotos.data.data || []
    const encontrada = todas.find((o: any) =>
      String(o.codigoBarras) === odt ||
      String(o.numero) === odt
    )


    return NextResponse.json({
      consumos: resConsumos.data,
      pieza: encontrada || null
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
  }
}
