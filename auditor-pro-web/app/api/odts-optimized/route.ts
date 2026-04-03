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

    // Get all unique ODT codes from consumos - get ALL for matching
    const { data: consumosRaw } = await supabase
      .from('consumos')
      .select('odt_codigo')
    
    // Build a more flexible matching - try to extract numeric IDs
    const odtsConConsumos = new Set<string>()
    const odtsConConsumosNumerico = new Map<string, string[]>() // numericId -> original codes
    
    consumosRaw?.forEach(c => {
      const code = c.odt_codigo
      if (code) {
        odtsConConsumos.add(code)
        // Extract numeric ID for flexible matching
        const match = code.match(/(\d+)/)
        if (match) {
          const numericId = match[1]
          if (!odtsConConsumosNumerico.has(numericId)) {
            odtsConConsumosNumerico.set(numericId, [])
          }
          odtsConConsumosNumerico.get(numericId)!.push(code)
        }
      }
    })
    
    const arrayConConsumos = Array.from(odtsConConsumos)

    // Get ODTs
    let query = supabase
      .from('odts')
      .select('codigo_barras, numero, cliente, direccion, cuadrilla_nombre, estado, medidor_serie, foto', { count: 'exact' })
      .range(offset, offset + limit - 1)
    
    if (search) {
      query = query.or(`codigo_barras.ilike.%${search}%,numero.ilike.%${search}%`)
    }
    
    const result = await query.order('id', { ascending: false })
    let odtsData = result.data || []
    const total = result.count || 0

    // Check if ODT has consumos (by codigo_barras OR by numero OR by numeric ID extraction)
    const odtsDataConInfo = odtsData.map(o => {
      const codigoBarras = o.codigo_barras || ''
      const numero = o.numero || ''
      
      // Direct match
      let tieneConsumos = odtsConConsumos.has(codigoBarras) || odtsConConsumos.has(numero)
      
      // Try numeric ID extraction matching
      if (!tieneConsumos) {
        const matchBarras = codigoBarras.match(/(\d+)/)
        const matchNumero = numero.match(/(\d+)/)
        
        if (matchBarras && odtsConConsumosNumerico.has(matchBarras[1])) {
          tieneConsumos = true
        } else if (matchNumero && odtsConConsumosNumerico.has(matchNumero[1])) {
          tieneConsumos = true
        }
      }
      
      return { ...o, tieneConsumos }
    })

    // Apply filtro con_materiales / sin_materiales
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
        conMateriales: arrayConConsumos.length,
        sinMateriales: total - arrayConConsumos.length
      }
    })

  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
