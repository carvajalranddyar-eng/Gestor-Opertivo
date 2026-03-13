import { NextResponse } from 'next/server'
import axios from 'axios'
import { loginPSM } from '@/lib/psm/auth'

export async function GET() {
  try {
    const proxyUrl = process.env.PSM_PROXY_URL || process.env.PSM_BASE_URL
    const token = await loginPSM()

    // Get consumos for today
    const today = new Date().toISOString().split('T')[0]
    const consumosUrl = `${proxyUrl}/api/consumos?fechaDesde=${today}&fechaHasta=${today}`
    const consumosRes = await axios.get(consumosUrl, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30000
    })
    
    const consumos = consumosRes.data.consumos || consumosRes.data.data || consumosRes.data
    const odtsWithConsumos = new Set(consumos.map((c: any) => String(c.odt)))

    // Get all ODTs (just the IDs to save memory)
    const odtsUrl = `${proxyUrl}/api/informePiezas/tablaFiltradaOdt?ultimaPieza=false&page=0&pageSize=500`
    const odtsRes = await axios.get(odtsUrl, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30000
    })
    
    const allOdts = odtsRes.data.data || odtsRes.data
    // Extract just the ODT IDs to save memory
    const allOdtIds = new Set<string>()
    for (const o of allOdts) {
      const id = String(o.odt || o.numero || o.id)
      if (id && id !== 'undefined') {
        allOdtIds.add(id)
      }
    }

    const allOdtArray = Array.from(allOdtIds)
    return NextResponse.json({
      consumosDelDia: consumos.length,
      odtsConConsumos: odtsWithConsumos.size,
      totalOdtDisponibles: allOdtIds.size,
      odtIdsConConsumos: Array.from(odtsWithConsumos).slice(0, 10),
      ejemploOdtSinConsumo: allOdtArray.slice(0, 100).find((id) => !odtsWithConsumos.has(id)) || null
    })
  } catch (error: any) {
    console.error('Error stats:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
