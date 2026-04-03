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
    
    // Get all ODTs that have consumos - fetch in batches
    const odtsConConsumosSet = new Set<string>()
    let offsetOdts = 0
    const odtBatchSize = 1000
    
    while (true) {
      // Get batch of ODT codes that match consumos
      const { data: odtBatch } = await supabase
        .from('odts')
        .select('codigo_barras, numero')
        .range(offsetOdts, offsetOdts + odtBatchSize - 1)
      
      if (!odtBatch || odtBatch.length === 0) break
      
      // Check each ODT if it has consumos
      odtBatch.forEach(o => {
        if (allConsumoCodes.has(o.codigo_barras) || allConsumoCodes.has(o.numero)) {
          odtsConConsumosSet.add(o.codigo_barras)
        }
      })
      
      if (odtBatch.length < odtBatchSize) break
      offsetOdts += odtBatchSize
    }
    
    const matchingCodes = Array.from(odtsConConsumosSet)

    // Get ODTs - paginate ALL, filter in memory based on matching codes
    let query = supabase
      .from('odts')
      .select('codigo_barras, numero, cliente, direccion, cuadrilla_nombre, estado, medidor_serie, foto', { count: 'exact' })
    
    // When filtering by con_materiales, we need to search differently
    // Since matching ODTs are likely at the end (older), search by codes directly
    if (filtro === 'con_materiales' && matchingCodes.length > 0) {
      // Fetch matching ODTs by their codes - need to do multiple queries due to 1000 limit
      const allMatchingOdts: any[] = []
      for (let i = 0; i < matchingCodes.length; i += 1000) {
        const chunk = matchingCodes.slice(i, i + 1000)
        const { data: chunkOdts } = await supabase
          .from('odts')
          .select('codigo_barras, numero, cliente, direccion, cuadrilla_nombre, estado, medidor_serie, foto')
          .in('codigo_barras', chunk)
        
        if (chunkOdts) allMatchingOdts.push(...chunkOdts)
      }
      
      // Sort by id descending to match expected order
      allMatchingOdts.sort((a, b) => b.id - a.id)
      
      // Apply pagination to filtered results
      const paginated = allMatchingOdts.slice(offset, offset + limit)
      
      return NextResponse.json({
        ok: true,
        odts: paginated.map(o => ({
          odtId: o.codigo_barras,
          numero: o.numero,
          cliente: o.cliente,
          direccion: o.direccion,
          cuadrilla: o.cuadrilla_nombre,
          estado: o.estado,
          medidor: o.medidor_serie,
          tieneFoto: !!o.foto,
          tieneConsumos: true,
          estadoAuditoria: 'pendiente',
          materialesCount: 0 // Would need another query to get this
        })),
        total: allMatchingOdts.length,
        page,
        limit,
        tieneMas: offset + limit < allMatchingOdts.length,
        stats: {
          conMateriales: matchingCodes.length,
          sinMateriales: 47507 - matchingCodes.length
        }
      })
    }
    
    // Regular pagination for other cases
    query = query.range(offset, offset + limit - 1)
    
    if (search) {
      query = query.or(`codigo_barras.ilike.%${search}%,numero.ilike.%${search}%`)
    }
    
    const result = await query.order('id', { ascending: false })
    let odtsData = result.data || []
    const total = result.count || 0

    // Filter in memory based on matching codes
    let odtsFiltrados = odtsData
    if (filtro === 'sin_materiales') {
      odtsFiltrados = odtsData.filter(o => !matchingCodes.includes(o.codigo_barras))
    }

    // All filtered ODTs have consumos
    const odtsDataConInfo = odtsFiltrados.map(o => ({
      ...o,
      tieneConsumos: true
    }))

    // Get verifications
    const odtIds = odtsDataConInfo.map(o => o.codigo_barras)
    
    // Skip verification query if no ODTs
    const verifMap = new Map<string, string>()
    if (odtIds.length > 0) {
      const { data: verifData } = await supabase
        .from('verificaciones_odt')
        .select('odt_codigo, estado_auditoria')
        .in('odt_codigo', odtIds)

      verifData?.forEach(v => verifMap.set(v.odt_codigo, v.estado_auditoria))
    }

    // Get consumos counts
    const consumosMap = new Map<string, number>()
    if (odtIds.length > 0) {
      const { data: consumosCounts } = await supabase
        .from('consumos')
        .select('odt_codigo')
        .in('odt_codigo', odtIds)

      consumosCounts?.forEach(c => {
        consumosMap.set(c.odt_codigo, (consumosMap.get(c.odt_codigo) || 0) + 1)
      })
    }

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
        conMateriales: matchingCodes.length,
        sinMateriales: 47507 - matchingCodes.length
      }
    })

  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
