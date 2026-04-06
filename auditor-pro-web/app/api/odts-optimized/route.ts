import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { validarODT, contarMateriales, type ValidationResult } from '@/lib/validator'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const filtro = searchParams.get('filtro') || ''
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '0')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = page * limit

    // NEW FILTERS
    const filtroCuadrilla = searchParams.get('cuadrilla') || ''
    const filtroPSM = searchParams.get('psm_estado') || ''
    const filtroEstadoAuditoria = searchParams.get('estado') || '' // This was already there (conforme, observacion, etc)

    // 1. Cargar todos los consumos
    const allConsumosData = new Map<string, {productos: string[], cantidades: Map<string, number>, series: string[]}>()
    let offsetConsumos = 0
    const batchSize = 1000
    
    while (true) {
      const { data: consumoBatch } = await supabase
        .from('consumos')
        .select('odt_codigo, producto_codigo, cantidad, series')
        .range(offsetConsumos, offsetConsumos + batchSize - 1)
      
      if (!consumoBatch || consumoBatch.length === 0) break
      
      consumoBatch.forEach((c: any) => {
        if (c.odt_codigo) {
          if (!allConsumosData.has(c.odt_codigo)) {
            allConsumosData.set(c.odt_codigo, { productos: [], cantidades: new Map(), series: [] })
          }
          const data = allConsumosData.get(c.odt_codigo)!
          data.productos.push(c.producto_codigo)
          
          const currentQty = data.cantidades.get(c.producto_codigo) || 0
          data.cantidades.set(c.producto_codigo, currentQty + (c.cantidad || 1))
          
          if (c.series && c.series !== 'N/A') {
            data.series.push(c.series)
          }
        }
      })
      
      if (consumoBatch.length < batchSize) break
      offsetConsumos += batchSize
    }

    // 2. Cargar series usadas para detectar duplicados
    const allSeriesUsed = new Map<string, string[]>()
    offsetConsumos = 0
    while (true) {
      const { data: seriesBatch } = await supabase
        .from('consumos')
        .select('odt_codigo, series')
        .not('series', 'is', null)
        .range(offsetConsumos, offsetConsumos + batchSize - 1)
      
      if (!seriesBatch || seriesBatch.length === 0) break
      
      seriesBatch.forEach((s: any) => {
        if (s.series && s.odt_codigo) {
          if (!allSeriesUsed.has(s.series)) {
            allSeriesUsed.set(s.series, [])
          }
          allSeriesUsed.get(s.series)?.push(s.odt_codigo)
        }
      })
      
      if (seriesBatch.length < batchSize) break
      offsetConsumos += batchSize
    }

    // 3. Analizar cada ODT usando el validador modular
    const analisisAllMap = new Map<string, any>()
    const matchingCodes = Array.from(allConsumosData.keys())
    
    // Obtener ODTs con medidor_serie del PSM
    const { data: odtsConSerie } = await supabase
      .from('odts')
      .select('codigo_barras, medidor_serie')
      .in('codigo_barras', matchingCodes)
    
    const seriePSMMap = new Map<string, string | null>()
    odtsConSerie?.forEach(o => seriePSMMap.set(o.codigo_barras, o.medidor_serie))

    const { data: odtsConEstado } = await supabase
      .from('odts')
      .select('codigo_barras, estado')
      .in('codigo_barras', matchingCodes)
    
    const estadoODTMap = new Map<string, string | null>()
    odtsConEstado?.forEach(o => estadoODTMap.set(o.codigo_barras, o.estado))

    allConsumosData.forEach((data, odtCodigo) => {
      const productos = data.productos
      const countByCategory = contarMateriales(productos)
      const seriesPSM = seriePSMMap.get(odtCodigo) || null
      
      const estadoODT = estadoODTMap.get(odtCodigo) || null
      
      const result = validarODT(
        countByCategory,
        seriesPSM,
        data.series,
        allSeriesUsed,
        estadoODT
      )
      
      analisisAllMap.set(odtCodigo, {
        estadoSemaforo: result.estado,
        motivo: result.motivo,
        tipo: result.tipo,
        serieEfectiva: result.serieEfectiva,
        requiereVerificacion: result.requiereVerificacion,
        countByCategory,
        productosCount: productos.length,
        seriesConsumo: data.series
      })
    })

    // 4. Calcular estadísticas
    const stats = {
      conMateriales: matchingCodes.length,
      sinMateriales: 47528 - matchingCodes.length,
      rojo: 0,
      amarillo: 0,
      verde: 0,
      purpura: 0,
      naranja: 0
    }
    
    analisisAllMap.forEach(a => {
      if (a.estadoSemaforo === 'rojo') stats.rojo++
      else if (a.estadoSemaforo === 'amarillo') stats.amarillo++
      else if (a.estadoSemaforo === 'verde') stats.verde++
      else if (a.estadoSemaforo === 'purpura') stats.purpura++
      else if (a.estadoSemaforo === 'naranja') stats.naranja++
    })

    // 5. Obtener ODTs con filtros
    let query = supabase
      .from('odts')
      .select('codigo_barras, numero, cliente, direccion, cuadrilla_nombre, estado, medidor_serie, foto, fecha_ingreso', { count: 'exact' })
    
    // Apply filters
    if (filtroCuadrilla) {
      query = query.ilike('cuadrilla_nombre', `%${filtroCuadrilla}%`)
    }
    if (filtroPSM) {
      query = query.eq('estado', filtroPSM)
    }
    // filtroEstadoAuditoria is handled later with verification data
    
    if ((filtro === 'con_materiales' || filtro === 'rojo' || filtro === 'amarillo' || filtro === 'verde' || filtro === 'purpura' || filtro === 'duplicada' || filtro === 'naranja') && matchingCodes.length > 0) {
      const allMatchingOdts: any[] = []
      for (let i = 0; i < matchingCodes.length; i += 1000) {
        const chunk = matchingCodes.slice(i, i + 1000)
        const { data: chunkOdts } = await supabase
          .from('odts')
          .select('codigo_barras, numero, cliente, direccion, cuadrilla_nombre, estado, medidor_serie, foto, fecha_ingreso')
          .in('codigo_barras', chunk)
        
        if (chunkOdts) allMatchingOdts.push(...chunkOdts)
      }
      
      let filteredOdts = allMatchingOdts
      if (filtro === 'rojo') {
        filteredOdts = allMatchingOdts.filter((o: any) => analisisAllMap.get(o.codigo_barras)?.estadoSemaforo === 'rojo')
      } else if (filtro === 'amarillo') {
        filteredOdts = allMatchingOdts.filter((o: any) => analisisAllMap.get(o.codigo_barras)?.estadoSemaforo === 'amarillo')
      } else if (filtro === 'verde') {
        filteredOdts = allMatchingOdts.filter((o: any) => analisisAllMap.get(o.codigo_barras)?.estadoSemaforo === 'verde')
      } else if (filtro === 'purpura' || filtro === 'duplicada') {
        filteredOdts = allMatchingOdts.filter((o: any) => analisisAllMap.get(o.codigo_barras)?.estadoSemaforo === 'purpura')
      } else if (filtro === 'naranja') {
        filteredOdts = allMatchingOdts.filter((o: any) => analisisAllMap.get(o.codigo_barras)?.estadoSemaforo === 'naranja')
      }
      
      filteredOdts.sort((a: any, b: any) => b.id - a.id)
      
      const paginated = filteredOdts.slice(offset, offset + limit)
      
      // Calcular stats dinámicos
      const filteredStats = {
        conMateriales: filteredOdts.length,
        sinMateriales: 0,
        rojo: filteredOdts.filter(o => analisisAllMap.get(o.codigo_barras)?.estadoSemaforo === 'rojo').length,
        amarillo: filteredOdts.filter(o => analisisAllMap.get(o.codigo_barras)?.estadoSemaforo === 'amarillo').length,
        verde: filteredOdts.filter(o => analisisAllMap.get(o.codigo_barras)?.estadoSemaforo === 'verde').length,
        purpura: filteredOdts.filter(o => analisisAllMap.get(o.codigo_barras)?.estadoSemaforo === 'purpura').length,
        naranja: filteredOdts.filter(o => analisisAllMap.get(o.codigo_barras)?.estadoSemaforo === 'naranja').length
      }
      
      return NextResponse.json({
        ok: true,
        odts: paginated.map((o: any) => ({
          odtId: o.codigo_barras,
          numero: o.numero,
          cliente: o.cliente,
          direccion: o.direccion,
          cuadrilla: o.cuadrilla_nombre,
          estado: o.estado,
          fecha: o.fecha_ingreso,
          medidor: analisisAllMap.get(o.codigo_barras)?.serieEfectiva || o.medidor_serie,
          tieneFoto: !!o.foto,
          tieneConsumos: true,
          estadoSemaforo: analisisAllMap.get(o.codigo_barras)?.estadoSemaforo || 'sin_datos',
          analisis: analisisAllMap.get(o.codigo_barras),
          estadoAuditoria: 'pendiente',
          materialesCount: analisisAllMap.get(o.codigo_barras)?.productosCount || 0
        })),
        total: filteredOdts.length,
        page,
        limit,
        tieneMas: offset + limit < filteredOdts.length,
        stats: filteredStats
      })
    }
    
    // Sin filtro o sin_materiales
    query = query.range(offset, offset + limit - 1)
    
    if (search) {
      query = query.or(`codigo_barras.ilike.%${search}%,numero.ilike.%${search}%`)
    }
    
    const result = await query.order('id', { ascending: false })
    let odtsData = result.data || []
    const total = result.count || 0

    let odtsFiltrados = odtsData
    if (filtro === 'sin_materiales') {
      odtsFiltrados = odtsData.filter((o: any) => !matchingCodes.includes(o.codigo_barras))
    }

    const odts = odtsFiltrados.map((o: any) => ({
      odtId: o.codigo_barras,
      numero: o.numero,
      cliente: o.cliente,
      direccion: o.direccion,
      cuadrilla: o.cuadrilla_nombre,
      estado: o.estado,
      fecha: o.fecha_ingreso,
      medidor: o.medidor_serie,
      tieneFoto: !!o.foto,
      tieneConsumos: matchingCodes.includes(o.codigo_barras),
      estadoSemaforo: analisisAllMap.get(o.codigo_barras)?.estadoSemaforo || 'sin_datos',
      analisis: analisisAllMap.get(o.codigo_barras),
      estadoAuditoria: 'pendiente',
      materialesCount: analisisAllMap.get(o.codigo_barras)?.productosCount || 0
    }))

    return NextResponse.json({
      ok: true,
      odts,
      total,
      page,
      limit,
      tieneMas: odts.length === limit,
      stats
    })

  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
