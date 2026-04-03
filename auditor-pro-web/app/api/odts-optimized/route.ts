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

    // Get ALL consumos data (producto_codigo) for ALL ODTs that have consumos
    const allConsumosData = new Map<string, string[]>() // odt -> list of producto_codigos
    let offsetConsumos = 0
    const batchSize = 1000
    
    while (true) {
      const { data: consumoBatch } = await supabase
        .from('consumos')
        .select('odt_codigo, producto_codigo')
        .range(offsetConsumos, offsetConsumos + batchSize - 1)
      
      if (!consumoBatch || consumoBatch.length === 0) break
      
      consumoBatch.forEach(c => {
        if (c.odt_codigo) {
          if (!allConsumosData.has(c.odt_codigo)) {
            allConsumosData.set(c.odt_codigo, [])
          }
          allConsumosData.get(c.odt_codigo)?.push(c.producto_codigo)
        }
      })
      
      if (consumoBatch.length < batchSize) break
      offsetConsumos += batchSize
    }
    
    // Now analyze ALL ODTs that have consumos for semaphore status
    const analisisAllMap = new Map<string, any>()
    
    allConsumosData.forEach((productos, odtCodigo) => {
      const tieneCaja = productos.some(p => p === '070008001' || p.startsWith('0700'))
      const tienePrecinto = productos.some(p => p === '072002015' || p.startsWith('0720'))
      const tieneMedidor = productos.some(p => p === '072003015' || p.startsWith('0720'))
      
      const tieneBasicos = tieneCaja && tienePrecinto && tieneMedidor
      const tieneExtras = productos.length > 3
      
      let estadoSemaforo = 'sin_datos'
      if (!tieneBasicos) {
        estadoSemaforo = 'rojo'
      } else if (!tieneExtras) {
        estadoSemaforo = 'amarillo'
      } else {
        estadoSemaforo = 'verde'
      }
      
      analisisAllMap.set(odtCodigo, {
        tieneCaja,
        tienePrecinto,
        tieneMedidor,
        productosCount: productos.length,
        estadoSemaforo
      })
    })
    
    const matchingCodes = Array.from(allConsumosData.keys())

    // Get ODTs - handle filters by fetching matching codes
    let query = supabase
      .from('odts')
      .select('codigo_barras, numero, cliente, direccion, cuadrilla_nombre, estado, medidor_serie, foto, fecha_ingreso', { count: 'exact' })
    
    // When filtering by semaphore status, we need to get ALL matching ODTs first
    if ((filtro === 'con_materiales' || filtro === 'rojo' || filtro === 'amarillo' || filtro === 'verde') && matchingCodes.length > 0) {
      // Fetch matching ODTs by their codes
      const allMatchingOdts: any[] = []
      for (let i = 0; i < matchingCodes.length; i += 1000) {
        const chunk = matchingCodes.slice(i, i + 1000)
        const { data: chunkOdts } = await supabase
          .from('odts')
          .select('codigo_barras, numero, cliente, direccion, cuadrilla_nombre, estado, medidor_serie, foto, fecha_ingreso')
          .in('codigo_barras', chunk)
        
        if (chunkOdts) allMatchingOdts.push(...chunkOdts)
      }
      
      // Apply semaphore filter BEFORE pagination
      let filteredOdts = allMatchingOdts
      if (filtro === 'rojo') {
        filteredOdts = allMatchingOdts.filter(o => analisisAllMap.get(o.codigo_barras)?.estadoSemaforo === 'rojo')
      } else if (filtro === 'amarillo') {
        filteredOdts = allMatchingOdts.filter(o => analisisAllMap.get(o.codigo_barras)?.estadoSemaforo === 'amarillo')
      } else if (filtro === 'verde') {
        filteredOdts = allMatchingOdts.filter(o => analisisAllMap.get(o.codigo_barras)?.estadoSemaforo === 'verde')
      }
      
      // Sort by id descending
      filteredOdts.sort((a, b) => b.id - a.id)
      
      // Apply pagination
      const paginated = filteredOdts.slice(offset, offset + limit)
      
      return NextResponse.json({
        ok: true,
        odts: paginated.map(o => ({
          odtId: o.codigo_barras,
          numero: o.numero,
          cliente: o.cliente,
          direccion: o.direccion,
          cuadrilla: o.cuadrilla_nombre,
          estado: o.estado,
          fecha: o.fecha_ingreso,
          medidor: o.medidor_serie,
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
        stats: {
          conMateriales: matchingCodes.length,
          sinMateriales: 47507 - matchingCodes.length,
          rojo: Array.from(analisisAllMap.values()).filter(a => a.estadoSemaforo === 'rojo').length,
          amarillo: Array.from(analisisAllMap.values()).filter(a => a.estadoSemaforo === 'amarillo').length,
          verde: Array.from(analisisAllMap.values()).filter(a => a.estadoSemaforo === 'verde').length
        }
      })
    }
    
    // Regular path for no filter or sin_materiales
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

    // Get consumos for ALL filtered ODTs to analyze basic materials
    const allOdtIds = odtsFiltrados.map(o => o.codigo_barras)
    const consumosAllMap = new Map<string, string[]>()
    
    if (allOdtIds.length > 0) {
      for (let i = 0; i < allOdtIds.length; i += 100) {
        const chunk = allOdtIds.slice(i, i + 100)
        const { data: consumosChunk } = await supabase
          .from('consumos')
          .select('odt_codigo, producto_codigo, series')
          .in('odt_codigo', chunk)
        
        consumosChunk?.forEach(c => {
          if (!consumosAllMap.has(c.odt_codigo)) {
            consumosAllMap.set(c.odt_codigo, [])
          }
          consumosAllMap.get(c.odt_codigo)?.push(c.producto_codigo)
        })
      }
    }

    // Analyze each ODT for ALL validations
    const analisisMap = new Map<string, any>()
    
    // First, build a map of all series used for duplicate detection
    const seriesUsageMap = new Map<string, string[]>() // series -> list of odt_codigos
    allConsumosData.forEach((productos, odtCodigo) => {
      productos.forEach(p => {
        // Check if this product has a series (medidor)
        const match = p.match(/^072003015/) // MEDIDOR code
        if (match) {
          // Get the series from consumos - need to query
        }
      })
    })
    
    // Get series data for all ODTs
    const allSeriesData: {odt_codigo: string, series: string | null}[] = []
    offsetConsumos = 0
    while (true) {
      const { data: seriesBatch } = await supabase
        .from('consumos')
        .select('odt_codigo, series')
        .not('series', 'is', null)
        .range(offsetConsumos, offsetConsumos + batchSize - 1)
      
      if (!seriesBatch || seriesBatch.length === 0) break
      allSeriesData.push(...seriesBatch)
      
      if (seriesBatch.length < batchSize) break
      offsetConsumos += batchSize
    }
    
    // Build series usage map for duplicate detection
    const seriesUsedMap = new Map<string, string[]>()
    allSeriesData.forEach(s => {
      if (s.series && s.odt_codigo) {
        if (!seriesUsedMap.has(s.series)) {
          seriesUsedMap.set(s.series, [])
        }
        seriesUsedMap.get(s.series)?.push(s.odt_codigo)
      }
    })
    
    // Get cuadrilla data for all ODTs
    const allCuadrillasData: {odt_codigo: string, cuadrilla_descripcion: string | null}[] = []
    offsetConsumos = 0
    while (true) {
      const { data: cuadrillaBatch } = await supabase
        .from('consumos')
        .select('odt_codigo, cuadrilla_descripcion')
        .range(offsetConsumos, offsetConsumos + batchSize - 1)
      
      if (!cuadrillaBatch || cuadrillaBatch.length === 0) break
      allCuadrillasData.push(...cuadrillaBatch)
      
      if (cuadrillaBatch.length < batchSize) break
      offsetConsumos += batchSize
    }
    
    // Build cuadrilla map forPSM comparison
    const cuadrillasObradorMap = new Map<string, string>()
    allCuadrillasData.forEach(c => {
      if (c.odt_codigo && c.cuadrilla_descripcion) {
        cuadrillasObradorMap.set(c.odt_codigo, c.cuadrilla_descripcion)
      }
    })
    
    // Now analyze each ODT with all validations
    odtsFiltrados.forEach(o => {
      const productos = allConsumosData.get(o.codigo_barras) || []
      const tieneCaja = productos.some(p => p === '070008001' || p.startsWith('0700'))
      const tienePrecinto = productos.some(p => p === '072002015' || p.startsWith('0720'))
      const tieneMedidor = productos.some(p => p === '072003015' || p.startsWith('0720'))
      
      const tieneBasicos = tieneCaja && tienePrecinto && tieneMedidor
      const tieneExtras = productos.length > 3
      
      // MODULO 1: Check if medidor_serie exists in PSM
      const seriePSM = o.medidor_serie
      let estadoSemaforo = 'sin_datos'
      let estadoDetalle = ''
      
      if (!seriePSM) {
        // NARANJA - Pendiente de datos de origen
        estadoSemaforo = 'naranja'
        estadoDetalle = 'Pendiente de Serie en PSM'
      } else if (matchingCodes.includes(o.codigo_barras)) {
        if (o.estado === 'R11') {
          if (!tieneBasicos) {
            estadoSemaforo = 'rojo'
            estadoDetalle = 'Faltan básicos'
          } else if (!tieneExtras) {
            estadoSemaforo = 'amarillo'
            estadoDetalle = 'Solo kit básico'
          } else {
            estadoSemaforo = 'verde'
            estadoDetalle = 'Completa'
          }
        } else {
          estadoSemaforo = 'verde'
          estadoDetalle = 'Estado no R11'
        }
      }
      
      // MODULO 2: Check for duplicate series
      let serieDuplicada = null
      if (seriePSM && seriesUsedMap.has(seriePSM)) {
        const odtsConEstaSerie = seriesUsedMap.get(seriePSM) || []
        if (odtsConEstaSerie.length > 1) {
          serieDuplicada = odtsConEstaSerie
        }
      }
      
      // MODULO 3: Check cuadrilla match
      const cuadrillaObrador = cuadrillasObradorMap.get(o.codigo_barras)
      const cuadrillaPSM = o.cuadrilla_nombre
      let cuadrillaNoCoincide = false
      if (cuadrillaPSM && cuadrillaObrador && cuadrillaPSM !== cuadrillaObrador) {
        cuadrillaNoCoincide = true
      }
      
      analisisMap.set(o.codigo_barras, {
        tieneCaja,
        tienePrecinto,
        tieneMedidor,
        productosCount: productos.length,
        estadoSemaforo,
        estadoDetalle,
        seriePSM,
        serieDuplicada,
        cuadrillaPSM,
        cuadrillaObrador,
        cuadrillaNoCoincide
      })
    })

    // Apply semaphore filters
    if (filtro === 'rojo') {
      odtsFiltrados = odtsFiltrados.filter(o => analisisMap.get(o.codigo_barras)?.estadoSemaforo === 'rojo')
    } else if (filtro === 'amarillo') {
      odtsFiltrados = odtsFiltrados.filter(o => analisisMap.get(o.codigo_barras)?.estadoSemaforo === 'amarillo')
    }

    // All filtered ODTs have consumos
    const odtsDataConInfo = odtsFiltrados.map(o => ({
      ...o,
      tieneConsumos: matchingCodes.includes(o.codigo_barras)
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
      fecha: o.fecha_ingreso,
      medidor: o.medidor_serie,
      tieneFoto: !!o.foto,
      tieneConsumos: o.tieneConsumos,
      estadoSemaforo: analisisMap.get(o.codigo_barras)?.estadoSemaforo || 'sin_datos',
      analisis: analisisMap.get(o.codigo_barras),
      estadoAuditoria: verifMap.get(o.codigo_barras) || 'pendiente',
      materialesCount: consumosMap.get(o.codigo_barras) || 0
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
