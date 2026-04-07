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

    // 1. Cargar todos los consumos con productos completos
    const batchSize = 10000
    const allConsumosData = new Map<string, any>()
    let offsetConsumos = 0
    
    while (true) {
      const { data: seriesBatch } = await supabase
        .from('consumos')
        .select('odt_codigo, producto_codigo, series')
        .not('series', 'is', null)
        .range(offsetConsumos, offsetConsumos + batchSize - 1)
      
      if (!seriesBatch || seriesBatch.length === 0) break
      
      seriesBatch.forEach((s: any) => {
        if (s.odt_codigo) {
          if (!allConsumosData.has(s.odt_codigo)) {
            allConsumosData.set(s.odt_codigo, [])
          }
          allConsumosData.get(s.odt_codigo)?.push({
            producto_codigo: s.producto_codigo,
            series: s.series
          })
        }
      })
      
      if (seriesBatch.length < batchSize) break
      offsetConsumos += batchSize
    }

    // 2. Obtener lista de ODTs únicas con consumos
    const uniqueMatchingCodes = [...allConsumosData.keys()]
    console.log('[DEBUG] Unique ODTs with consumos:', uniqueMatchingCodes.length)

    // 3. Obtener medidores del PSM para las ODTs
    const { data: odtsConSerie } = await supabase
      .from('odts')
      .select('codigo_barras, medidor_serie')
      .in('codigo_barras', uniqueMatchingCodes.length > 0 ? uniqueMatchingCodes : [''])
    
    const odtSerieMap = new Map<string, string>()
    odtsConSerie?.forEach(o => {
      if (o.medidor_serie) odtSerieMap.set(o.codigo_barras, o.medidor_serie)
    })

    // 4. Detectar series duplicadas en consumos
    const seriesDuplicadasMap = new Map<string, string[]>()
    allConsumosData.forEach((consumos, odtCodigo) => {
      consumos.forEach((c: any) => {
        if (c.series) {
          if (!seriesDuplicadasMap.has(c.series)) {
            seriesDuplicadasMap.set(c.series, [])
          }
          seriesDuplicadasMap.get(c.series)?.push(odtCodigo)
        }
      })
    })

    // 5. Calcular estadísticas y estado semáforo para cada ODT
    const analisisAllMap = new Map<string, any>()
    const stats = {
      conMateriales: uniqueMatchingCodes.length,
      sinMateriales: 0,
      rojo: 0,
      amarillo: 0,
      verde: 0,
      purpura: 0,
      naranja: 0
    }

    // Códigos de productosmandatorios
    const CODIGO_CAJA = '070008001'
    const CODIGO_PRECINTO = '072002015'
    const CODIGO_MEDIDOR = '072003015'

    uniqueMatchingCodes.forEach(codigo => {
      const consumos = allConsumosData.get(codigo) || []
      const psSerie = odtSerieMap.get(codigo)
      
      // Contar productos
      const productosUnicos = [...new Set(consumos.map((c: any) => c.producto_codigo))]
      const tieneCaja = productosUnicos.includes(CODIGO_CAJA)
      const tienePrecinto = productosUnicos.includes(CODIGO_PRECINTO)
      const tieneMedidor = productosUnicos.includes(CODIGO_MEDIDOR)
      
      // Verificar si hay series duplicadas para esta ODT
      let serieDuplicada = false
      consumos.forEach((c: any) => {
        if (c.series) {
          const duplicados = seriesDuplicadasMap.get(c.series) || []
          if (duplicados.length > 1) serieDuplicada = true
        }
      })

      // Determinar estado del semáforo
      let estadoSemaforo = 'sin_datos'
      let observaciones = ''

      if (serieDuplicada) {
        estadoSemaforo = 'purpura'
        stats.purpura++
      } else if (consumos.length > 0) {
        if (psSerie) {
          // Hay medidor en PSM - verificar si tiene todos los básicos
          if (tieneCaja && tienePrecinto && tieneMedidor) {
            estadoSemaforo = 'verde'
            stats.verde++
          } else {
            // Tiene medidor pero faltan algunos materiales básicos
            estadoSemaforo = 'amarillo'
            stats.amarillo++
            if (!tieneCaja) observaciones += 'Falta CAJA. '
            if (!tienePrecinto) observaciones += 'Falta PRECINTO. '
            if (!tieneMedidor) observaciones += 'Falta MEDIDOR. '
          }
        } else {
          // No hay medidor en PSM - está Pendiente de Datos
          estadoSemaforo = 'naranja'
          stats.naranja++
        }
      }

      analisisAllMap.set(codigo, {
        estadoSemaforo,
        serieEfectiva: psSerie,
        productosCount: consumos.length,
        seriesConsumo: consumos.map((c: any) => c.series).filter(Boolean),
        countByCategory: {
          caja: tieneCaja ? 1 : 0,
          precinto: tienePrecinto ? 1 : 0,
          medidor: tieneMedidor ? 1 : 0
        },
        observaciones: observaciones.trim() || null,
        serieDuplicada
      })
    })

    // Obtener total de ODTs en base de datos
    const { count: totalOdts } = await supabase
      .from('odts')
      .select('id', { count: 'exact', head: true })

    stats.sinMateriales = (totalOdts || 0) - uniqueMatchingCodes.length

    console.log('[DEBUG] Stats calculated:', stats)

    // 6. Obtener ODTs con filtros de semáforo
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

    // Calcular stats reales
    let totalStats = { ...stats }
    if (filtro === 'sin_materiales') {
      totalStats.sinMateriales = total
      totalStats.conMateriales = 0
    }

    return NextResponse.json({
      ok: true,
      odts,
      total,
      page,
      limit,
      tieneMas: odts.length === limit,
      stats: totalStats,
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
