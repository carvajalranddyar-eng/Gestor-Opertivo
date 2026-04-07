import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  console.log('[DEBUG] ========== NEW REQUEST ==========')
  console.log('[DEBUG] URL:', req.url)
  
  try {
    const searchParams = req.nextUrl.searchParams
    const filtroCuadrilla = searchParams.get('cuadrilla') || ''
    const filtro = searchParams.get('filtro') || ''
    const filtroPSM = searchParams.get('psm_estado') || ''
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '0')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = page * limit
    
    console.log('[DEBUG] Params parsed. filtro:', filtro, 'cuadrilla:', filtroCuadrilla, 'psm:', filtroPSM)

    // 1. Cargar todos los consumos
    const batchSize = 10000
    const allConsumosData = new Map<string, any>()
    let offsetConsumos = 0
    let allSeriesUsed = new Map<string, string[]>()
    
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

    // 2. Obtener lista de ODTs únicas
    const matchingCodes = Array.from(allSeriesUsed.values()).flat()
    const uniqueMatchingCodes = [...new Set(matchingCodes)]
    console.log('[DEBUG] Unique ODTs with consumos:', uniqueMatchingCodes.length)

    // 3. Obtener medidores del PSM
    const { data: odtsConSerie } = await supabase
      .from('odts')
      .select('codigo_barras, medidor_serie')
      .in('codigo_barras', uniqueMatchingCodes)
    
    const odtSerieMap = new Map<string, string>()
    odtsConSerie?.forEach(o => {
      if (o.medidor_serie) odtSerieMap.set(o.codigo_barras, o.medidor_serie)
    })

    // 4. Calcular estadísticas
    const stats = {
      conMateriales: uniqueMatchingCodes.length,
      sinMateriales: 0,
      rojo: 0,
      amarillo: 0,
      verde: 0,
      purpura: 0,
      naranja: 0
    }

    // Simplified analysis for stats
    const analisisAllMap = new Map<string, any>()
    uniqueMatchingCodes.forEach(codigo => {
      const series = allSeriesUsed.get(codigo) || []
      const uniqueSeries = [...new Set(series)]
      const psSerie = odtSerieMap.get(codigo)
      
      let estadoSemaforo = 'sin_datos'
      if (uniqueSeries.length > 0) {
        if (psSerie) {
          estadoSemaforo = 'verde'
        } else {
          estadoSemaforo = 'naranja'
        }
      }
      
      analisisAllMap.set(codigo, {
        estadoSemaforo,
        serieEfectiva: psSerie,
        productosCount: uniqueSeries.length,
        seriesConsumo: uniqueSeries
      })
    })

    analisisAllMap.forEach(a => {
      if (a.estadoSemaforo === 'rojo') stats.rojo++
      else if (a.estadoSemaforo === 'amarillo') stats.amarillo++
      else if (a.estadoSemaforo === 'verde') stats.verde++
      else if (a.estadoSemaforo === 'purpura') stats.purpura++
      else if (a.estadoSemaforo === 'naranja') stats.naranja++
    })

    // 5. Obtener ODTs con filtros
    if ((filtro === 'con_materiales' || filtro === 'rojo' || filtro === 'amarillo' || filtro === 'verde' || filtro === 'purpura' || filtro === 'duplicada' || filtro === 'naranja') && uniqueMatchingCodes.length > 0) {
      const allMatchingOdts: any[] = []
      for (let i = 0; i < uniqueMatchingCodes.length; i += 1000) {
        const chunk = uniqueMatchingCodes.slice(i, i + 1000)
        
        const { data: chunkOdts } = await supabase
          .from('odts')
          .select('codigo_barras, numero, cliente, direccion, cuadrilla_nombre, estado, medidor_serie, foto, fecha_ingreso')
          .in('codigo_barras', chunk)
        
        if (chunkOdts) allMatchingOdts.push(...chunkOdts)
      }
      
      console.log('[DEBUG] After getting all ODTs, applying filters. Total:', allMatchingOdts.length)
      
      let filteredOdts = allMatchingOdts
      
      // Apply semaforo filter
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

      console.log('[DEBUG] After semaforo filter. Total:', filteredOdts.length)

      // Apply PSM Status Filter (Estado)
      if (filtroPSM) {
        filteredOdts = filteredOdts.filter((o: any) => o.estado === filtroPSM)
      }
      
      // Apply Cuadrilla Filter
      if (filtroCuadrilla) {
        const searchTerm = filtroCuadrilla.toLowerCase().trim()
        console.log('[DEBUG] Applying cuadrilla filter:', searchTerm, 'Total before:', filteredOdts.length)
        
        filteredOdts = filteredOdts.filter((o: any) => {
          if (!o.cuadrilla_nombre) return false
          const dbVal = o.cuadrilla_nombre.toString().toLowerCase().trim()
          return dbVal.includes(searchTerm)
        })
        
        console.log('[DEBUG] After cuadrilla filter:', filteredOdts.length)
      }
      
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
        stats: filteredStats,
        debug: {
          filtroRecibido: filtro,
          cuadrillaRecibida: filtroCuadrilla,
          psmRecibido: filtroPSM,
          totalBeforeCuadrilla: filteredOdts.length
        }
      })
    }
    
    // Sin filtro de semáforo - ruta simple
    let query = supabase
      .from('odts')
      .select('codigo_barras, numero, cliente, direccion, cuadrilla_nombre, estado, medidor_serie, foto, fecha_ingreso', { count: 'exact' })
    
    if (search) {
      query = query.or(`codigo_barras.ilike.%${search}%,numero.ilike.%${search}%`)
    }
    
    // Apply Cuadrilla Filter in SQL
    if (filtroCuadrilla) {
      const searchTerm = filtroCuadrilla.toLowerCase().trim()
      query = query.ilike('cuadrilla_nombre', `%${searchTerm}%`)
    }
    
    // Apply PSM Status Filter
    if (filtroPSM) {
      query = query.eq('estado', filtroPSM)
    }
    
    query = query.range(offset, offset + limit - 1).order('id', { ascending: false })
    
    const result = await query
    let odtsData = result.data || []
    const total = result.count || 0

    let odtsFiltrados = odtsData
    if (filtro === 'sin_materiales') {
      odtsFiltrados = odtsData.filter((o: any) => !uniqueMatchingCodes.includes(o.codigo_barras))
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
      tieneConsumos: uniqueMatchingCodes.includes(o.codigo_barras),
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
      stats,
      debug: {
        filtroRecibido: filtro,
        cuadrillaRecibida: filtroCuadrilla,
        psmRecibido: filtroPSM
      }
    })

  } catch (error: any) {
    console.error('[DEBUG] Error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

// Endpoint to get list of unique cuadrillas
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (body.action === 'getCuadrillas') {
      const { data } = await supabase
        .from('odts')
        .select('cuadrilla_nombre')
        .not('cuadrilla_nombre', 'is', null)
      
      // Return raw values from DB
      const cuadrillas = [...new Set(data?.map((o: any) => o.cuadrilla_nombre).filter(Boolean))]
      return NextResponse.json({ ok: true, cuadrillas })
    }
    return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
