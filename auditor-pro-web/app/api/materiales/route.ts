import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const materialCode = searchParams.get('codigo')
    const cuadrillaFilter = searchParams.get('cuadrilla')
    const desde = searchParams.get('desde')
    const hasta = searchParams.get('hasta')

    // 1. OBTENER CONSUMOS (PSM)
    let queryConsumos = supabase
      .from('consumos')
      .select('*')
      .order('fecha_consumo', { ascending: false })

    if (materialCode) queryConsumos = queryConsumos.eq('producto_codigo', materialCode)
    if (cuadrillaFilter) queryConsumos = queryConsumos.or(`cuadrilla_descripcion.ilike.%${cuadrillaFilter}%,cuadrilla_codigo.eq.${cuadrillaFilter}`)
    if (desde) queryConsumos = queryConsumos.gte('fecha_consumo', desde)
    if (hasta) queryConsumos = queryConsumos.lte('fecha_consumo', hasta + 'T23:59:59')

    const { data: consumos, error: errorConsumos } = await queryConsumos

    if (errorConsumos) throw errorConsumos

    // 2. OBTENER MOVIMIENTOS/ENTREGAS (OBRADOR)
    let movimientos: any[] = []
    const BATCH_SIZE = 1000
    let offset = 0
    let hasMore = true
    
    while (hasMore) {
      let queryMovimientos = supabase
        .from('movimientos_obrador')
        .select('*')
        .order('fecha', { ascending: false })
        .range(offset, offset + BATCH_SIZE - 1)

      if (materialCode) queryMovimientos = queryMovimientos.eq('producto_codigo', materialCode)
      if (cuadrillaFilter) queryMovimientos = queryMovimientos.or(`cuadrilla_nombre.ilike.%${cuadrillaFilter}%,cuadrilla_codigo.eq.${cuadrillaFilter}`)
      if (desde) queryMovimientos = queryMovimientos.gte('fecha', desde)
      if (hasta) queryMovimientos = queryMovimientos.lte('fecha', hasta + 'T23:59:59')

      const { data: batch } = await queryMovimientos
      
      if (batch && batch.length > 0) {
        movimientos.push(...batch)
        offset += BATCH_SIZE
      } else {
        hasMore = false
      }
    }

    // 3. OBTENER STOCK ACTUAL (OBRADOR)
    let stockObrador: any[] = []
    if (!materialCode) {
      // Get all stock if not filtering by material
      const { data: stockData } = await supabase
        .from('stock_obrador')
        .select('*')
        .order('producto_descripcion')
      stockObrador = stockData || []
    } else {
      // Get stock for specific material
      const { data: stockData } = await supabase
        .from('stock_obrador')
        .select('*')
        .eq('producto_codigo', materialCode)
      stockObrador = stockData || []
    }

    // 4. DETECTAR DUPLICIDADES en consumos (mismo material, misma ODT, misma cuadrilla)
    const duplicados: any[] = []
    const consumosAgrupados = new Map<string, any[]>()
    
    consumos?.forEach(c => {
      const key = `${c.odt_codigo}-${c.producto_codigo}-${c.cuadrilla_codigo || c.cuadrilla_descripcion}`
      if (!consumosAgrupados.has(key)) {
        consumosAgrupados.set(key, [])
      }
      consumosAgrupados.get(key)!.push(c)
    })

    consumosAgrupados.forEach((regs, key) => {
      if (regs.length > 1) {
        duplicados.push({
          tipo: 'CONSUMO_DUPLICADO',
          key,
          cantidad_duplicados: regs.length,
          registros: regs.map(r => ({
            odt: r.odt_codigo,
            material: r.producto_codigo,
            cuadrilla: r.cuadrilla_descripcion || r.cuadrilla_codigo,
            cantidad: r.cantidad,
            fecha: r.fecha_consumo
          }))
        })
      }
    })

    // 5. CONSTRUIR RESPUESTA DETALLADA
    // Por cada material: entregados, consumidos, stock, por cuadrilla
    const materialesMap = new Map<string, any>()

    // Procesar movimientos (entregas)
    movimientos.forEach(m => {
      const cod = m.producto_codigo
      if (!materialesMap.has(cod)) {
        materialesMap.set(cod, {
          codigo: cod,
          descripcion: m.producto_descripcion || '',
          entregas: [],
          consumos: [],
          stock_odt: [],
          por_cuadrilla: new Map()
        })
      }
      
      const mat = materialesMap.get(cod)
      const esConsumo = m.tipo_movimiento?.includes('CONSUMO') || m.tipo_movimiento?.includes('SALIDA')
      
      const entregaInfo = {
        id: m.movimiento_detalle_id,
        odt: m.odt,
        cuadrilla_codigo: m.cuadrilla_codigo,
        cuadrilla_nombre: m.cuadrilla_nombre,
        cantidad: m.cantidad,
        fecha: m.fecha,
        tipo: m.tipo_movimiento,
        cliente: m.cliente
      }
      
      if (!esConsumo) {
        // Es entrega
        mat.entregas.push(entregaInfo)
        
        // Agregar a por_cuadrilla
        const cuadKey = m.cuadrilla_codigo || m.cuadrilla_nombre || 'Sin cuadrilla'
        if (!mat.por_cuadrilla.has(cuadKey)) {
          mat.por_cuadrilla.set(cuadKey, {
            cuadrilla_codigo: m.cuadrilla_codigo,
            cuadrilla_nombre: m.cuadrilla_nombre,
            entregas_cantidad: 0,
            consumos_cantidad: 0,
            balance: 0,
            entregas_detalle: [],
            consumos_detalle: []
          })
        }
        const cuad = mat.por_cuadrilla.get(cuadKey)!
        cuad.entregas_cantidad += m.cantidad || 0
        cuad.entregas_detalle.push(entregaInfo)
      } else {
        // Es consumo en movimientos (menos común)
        mat.consumos.push(entregaInfo)
      }
    })

    // Procesar consumos (PSM)
    consumos?.forEach(c => {
      const cod = c.producto_codigo
      if (!materialesMap.has(cod)) {
        materialesMap.set(cod, {
          codigo: cod,
          descripcion: c.producto_descripcion || '',
          entregas: [],
          consumos: [],
          stock_odt: [],
          por_cuadrilla: new Map()
        })
      }
      
      const mat = materialesMap.get(cod)
      
      const consumoInfo = {
        odt: c.odt_codigo,
        cuadrilla_codigo: c.cuadrilla_codigo,
        cuadrilla_nombre: c.cuadrilla_descripcion,
        cantidad: c.cantidad,
        fecha: c.fecha_consumo,
        series: c.series
      }
      
      mat.consumos.push(consumoInfo)
      
      // Agregar a por_cuadrilla
      const cuadKey = c.cuadrilla_codigo || c.cuadrilla_descripcion || 'Sin cuadrilla'
      if (!mat.por_cuadrilla.has(cuadKey)) {
        mat.por_cuadrilla.set(cuadKey, {
          cuadrilla_codigo: c.cuadrilla_codigo,
          cuadrilla_nombre: c.cuadrilla_descripcion,
          entregas_cantidad: 0,
          consumos_cantidad: 0,
          balance: 0,
          entregas_detalle: [],
          consumos_detalle: []
        })
      }
      const cuad = mat.por_cuadrilla.get(cuadKey)!
      cuad.consumos_cantidad += c.cantidad || 1
      cuad.consumos_detalle.push(consumoInfo)
    })

    // Agregar stock
    stockObrador.forEach(s => {
      const cod = s.producto_codigo
      if (materialesMap.has(cod)) {
        materialesMap.get(cod).stock_odt.push({
          cantidad: s.cantidad,
          ubicacion: s.ubicacion
        })
      }
    })

    // Calcular balances y convertir a array
    const materiales = Array.from(materialesMap.values()).map(m => {
      // Calcular totals
      const total_entregado = m.entregas.reduce((sum: number, e: any) => sum + (e.cantidad || 0), 0)
      const total_consumido = m.consumos.reduce((sum: number, c: any) => sum + (c.cantidad || 0), 0)
      const stock_real = m.stock_odt.reduce((sum: number, s: any) => sum + (s.cantidad || 0), 0)
      
      // Por cuadrilla
      m.por_cuadrilla.forEach((cuad: any, key: any) => {
        cuad.balance = cuad.entregas_cantidad - cuad.consumos_cantidad
      })
      
      return {
        ...m,
        total_entregado,
        total_consumido,
        stock_real,
        balance_total: total_entregado - total_consumido,
        por_cuadrilla: Array.from(m.por_cuadrilla.values()).sort((a: any, b: any) => 
          b.consumos_cantidad - a.consumos_cantidad
        )
      }
    }).sort((a: any, b: any) => b.total_consumido - a.total_consumido)

    // 6. RESUMEN GLOBAL
    const resumen = {
      total_materiales: materiales.length,
      total_entregas: movimientos.filter(m => !m.tipo_movimiento?.includes('CONSUMO') && !m.tipo_movimiento?.includes('SALIDA')).length,
      total_consumos_psm: consumos?.length || 0,
      duplicados_encontrados: duplicados.length,
      stock_items: stockObrador.length
    }

    return NextResponse.json({
      resumen,
      materiales,
      duplicados,
      stock_general: stockObrador.map(s => ({
        codigo: s.producto_codigo,
        descripcion: s.producto_descripcion,
        cantidad: s.cantidad,
        ubicacion: s.ubicacion
      })),
      movimientos: movimientos.slice(0, 100), // Primeros 100 para debug
      consumos: consumos?.slice(0, 100)
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
