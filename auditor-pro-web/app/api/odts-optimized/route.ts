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

    // Get all unique ODT codes from consumos - EXACT MATCH ONLY
    const { data: consumosRaw } = await supabase
      .from('consumos')
      .select('odt_codigo')
    
    const odtsConConsumos = new Set(consumosRaw?.map(c => c.odt_codigo) || [])
    const arrayConConsumos = Array.from(odtsConConsumos)

    // Get ODTs - if filtro is con_materiales, we need to filter at DB level
    let query = supabase
      .from('odts')
      .select('codigo_barras, numero, cliente, direccion, cuadrilla_nombre, estado, medidor_serie, foto', { count: 'exact' })
    
    // If filtering by con_materiales, we need to get matching ODTs first
    if (filtro === 'con_materiales') {
      // Get ODT codes that have consumos
      const matchingCodes = Array.from(odtsConConsumos)
      if (matchingCodes.length > 0) {
        query = query.in('codigo_barras', matchingCodes)
      }
    }
    
    // Apply pagination after filtering
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

    // Get verifications
    const odtIds = odtsDataConInfo.map(o => o.codigo_barras)
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

    const odts = odtsDataConInfo.map(o => ({
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
        conMateriales: arrayConConsumos.length,
        sinMateriales: total - arrayConConsumos.length
      }
    })

  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
