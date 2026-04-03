import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const filtro = searchParams.get('filtro') || ''
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '0')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = page * limit

    // Get ALL unique ODT codes from consumos - need to fetch in batches due to Supabase 1000 limit
    const allConsumoCodes = new Set<string>()
    let offsetConsumos = 0
    const batchSize = 1000
    
    while (true) {
      const { data: consumoBatch } = await supabase
        .from('consumos')
        .select('odt_codigo')
        .range(offsetConsumos, offsetConsumos + batchSize - 1)
      
      if (!consumoBatch || consumoBatch.length === 0) break
      
      consumoBatch.forEach(c => {
        if (c.odt_codigo) allConsumoCodes.add(c.odt_codigo)
      })
      
      if (consumoBatch.length < batchSize) break
      offsetConsumos += batchSize
    }
    
    const odtsConConsumos = allConsumoCodes
    const matchingCodes = Array.from(odtsConConsumos)

    // Get ODTs - if filtro is con_materiales, fetch all and filter in memory
    let query = supabase
      .from('odts')
      .select('codigo_barras, numero, cliente, direccion, cuadrilla_nombre, estado, medidor_serie, foto', { count: 'exact' })
    
    // Apply pagination first (for performance)
    query = query.range(offset, offset + limit - 1)
    
    if (search) {
      query = query.or(`codigo_barras.ilike.%${search}%,numero.ilike.%${search}%`)
    }
    
    const result = await query.order('id', { ascending: false })
    let odtsData = result.data || []
    const total = result.count || 0

    // Check if ODT has consumos - EXACT MATCH ONLY (by codigo_barras OR by numero)
    const odtsDataConInfo = odtsData.map(o => {
      const tieneConsumos = odtsConConsumos.has(o.codigo_barras) || odtsConConsumos.has(o.numero)
      return { ...o, tieneConsumos }
    })

    // NOW apply the filtro - filter in memory AFTER pagination
    let odtsFiltrados = odtsDataConInfo
    if (filtro === 'con_materiales') {
      odtsFiltrados = odtsDataConInfo.filter(o => o.tieneConsumos)
    } else if (filtro === 'sin_materiales') {
      odtsFiltrados = odtsDataConInfo.filter(o => !o.tieneConsumos)
    }

    // Get verifications
    const odtIds = odtsFiltrados.map(o => o.codigo_barras)
    const { data: verifData } = await supabase
      .from('verificaciones_odt')
      .select('odt_codigo, estado_auditoria')
      .in('odt_codigo', odtIds)

    const verifMap = new Map<string, string>()
    verifData?.forEach(v => verifMap.set(v.odt_codigo, v.estado_auditoria))

    // Get consumos counts
    const { data: consumosCounts } = await supabase
      .from('consumos')
      .select('odt_codigo')
      .in('odt_codigo', odtIds)

    const consumosMap = new Map<string, number>()
    consumosCounts?.forEach(c => {
      consumosMap.set(c.odt_codigo, (consumosMap.get(c.odt_codigo) || 0) + 1)
    })

    const odts = odtsFiltrados.map(o => ({
      odtId: o.codigo_barras,
      numero: o.numero,
      cliente: o.cliente,
      direccion: o.direccion,
      cuadrilla: o.cuadrilla_nombre,
      estado: o.estado,
      medidor: o.medidor_serie,
      tieneFoto: !!o.foto,
      tieneConsumos: o.tieneConsumos,
      estadoAuditoria: verifMap.get(o.codigo_barras) || 'pendiente',
      materialesCount: consumosMap.get(o.codigo_barras) || consumosMap.get(o.numero) || 0
    }))

    return NextResponse.json({
      ok: true,
      odts,
      total,
      page,
      limit,
      tieneMas: odts.length === limit,
      stats: {
        conMateriales: matchingCodes.length,
        sinMateriales: 47507 - matchingCodes.length
      }
    })

  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
