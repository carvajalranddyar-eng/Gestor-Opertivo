import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const debug: any = { step: 'start' }

  try {
    const { searchParams } = new URL(req.url)
    const cuadrilla = searchParams.get('cuadrilla')
    const desde = searchParams.get('desde')
    const hasta = searchParams.get('hasta')

    debug.step = 'getting_consumos'

    // Obtener consumos
    let queryConsumos = supabase
      .from('consumos')
      .select('odt_codigo, producto_codigo, producto_descripcion, cantidad, cuadrilla_descripcion, cuadrilla_codigo, fecha_consumo, series')

    if (cuadrilla) {
      queryConsumos = queryConsumos.ilike('cuadrilla_descripcion', `%${cuadrilla}%`)
    }

    const { data: consumos, error: errorConsumos } = await queryConsumos

    debug.consumosError = errorConsumos?.message || null
    debug.consumosCount = consumos?.length || 0

    if (errorConsumos) throw errorConsumos

    // Obtener movimientos (entradas = entregados) - hacer opcional
    let movimientos: any[] = []
    debug.step = 'getting_movimientos'
    try {
      let queryMovimientos = supabase
        .from('movimientos_obrador')
        .select('cuadrilla_nombre, producto_codigo, cantidad, tipo_movimiento, fecha')
        .in('tipo_movimiento', ['SALIDA', 'ENTRADA'])

      if (cuadrilla) {
        queryMovimientos = queryMovimientos.ilike('cuadrilla_nombre', `%${cuadrilla}%`)
      }

      const { data: movimientosData, error: errorMovimientos } = await queryMovimientos
      debug.movimientosError = errorMovimientos?.message || null
      debug.movimientosCount = movimientosData?.length || 0
      debug.movimientosSample = movimientosData?.slice(0, 2)

      if (!errorMovimientos && movimientosData) {
        movimientos = movimientosData
      }
    } catch (e: any) {
      debug.movimientosError = e.message
    }

    // Obtener stock actual - hacer opcional
    let stock: any[] = []
    debug.step = 'getting_stock'
    try {
      const { data: stockData, error: errorStock } = await supabase
        .from('stock_obrador')
        .select('producto_codigo, producto_descripcion, cantidad')
      
      debug.stockError = errorStock?.message || null
      debug.stockCount = stockData?.length || 0

      if (!errorStock && stockData) {
        stock = stockData
      }
    } catch (e: any) {
      debug.stockError = e.message
    }

    // Agrupar consumos por cuadrilla
    const consumosPorCuadrilla = new Map<string, {
      cuadrilla: string
      totalMateriales: number
      odts: Set<string>
      materiales: Map<string, { codigo: string, descripcion: string, cantidad: number }>
    }>()

    consumos?.forEach(c => {
      const cuadrillaKey = c.cuadrilla_descripcion || c.cuadrilla_codigo || 'Sin cuadrilla'
      
      if (!consumosPorCuadrilla.has(cuadrillaKey)) {
        consumosPorCuadrilla.set(cuadrillaKey, {
          cuadrilla: cuadrillaKey,
          totalMateriales: 0,
          odts: new Set(),
          materiales: new Map()
        })
      }

      const data = consumosPorCuadrilla.get(cuadrillaKey)!
      data.odts.add(String(c.odt_codigo))
      data.totalMateriales += c.cantidad || 1

      const matKey = c.producto_codigo
      if (!data.materiales.has(matKey)) {
        data.materiales.set(matKey, {
          codigo: c.producto_codigo,
          descripcion: c.producto_descripcion,
          cantidad: 0
        })
      }
      data.materiales.get(matKey)!.cantidad += c.cantidad || 1
    })

    // Agrupar movimientos por cuadrilla
    const movimientosPorCuadrilla = new Map<string, {
      cuadrilla: string
      totalEntregado: number
      materiales: Map<string, { codigo: string, descripcion: string, cantidad: number }>
    }>()

    movimientos?.forEach(m => {
      const cuadrillaKey = m.cuadrilla_nombre || 'Sin cuadrilla'
      
      if (!movimientosPorCuadrilla.has(cuadrillaKey)) {
        movimientosPorCuadrilla.set(cuadrillaKey, {
          cuadrilla: cuadrillaKey,
          totalEntregado: 0,
          materiales: new Map()
        })
      }

      const data = movimientosPorCuadrilla.get(cuadrillaKey)!
      
      // Only count ENTRADA as delivered
      if (m.tipo_movimiento === 'ENTRADA') {
        data.totalEntregado += m.cantidad || 0
      }

      const matKey = m.producto_codigo
      if (!data.materiales.has(matKey)) {
        data.materiales.set(matKey, {
          codigo: m.producto_codigo,
          descripcion: '',
          cantidad: 0
        })
      }
      data.materiales.get(matKey)!.cantidad += m.cantidad || 0
    })

    // Construir resumen por cuadrilla
    const resumenCuadrillas: any[] = []
    const todasCuadrillas = new Set([
      ...consumosPorCuadrilla.keys(),
      ...movimientosPorCuadrilla.keys()
    ])

    todasCuadrillas.forEach(c => {
      const consumido = consumosPorCuadrilla.get(c)?.totalMateriales || 0
      const entregado = movimientosPorCuadrilla.get(c)?.totalEntregado || 0
      
      resumenCuadrillas.push({
        cuadrilla: c,
        entregado,
        consumido,
        balance: entregado - consumido,
        odts: consumosPorCuadrilla.get(c)?.odts?.size || 0
      })
    })

    // Construir detalle por ODT
    const detallePorOdt: any[] = []
    const odtsAgrupadas = new Map<string, any>()

    consumos?.forEach(c => {
      const odtKey = String(c.odt_codigo)
      if (!odtsAgrupadas.has(odtKey)) {
        odtsAgrupadas.set(odtKey, {
          odt: odtKey,
          cuadrilla: c.cuadrilla_descripcion || c.cuadrilla_codigo || '',
          fecha: c.fecha_consumo,
          materiales: []
        })
      }
      const odtData = odtsAgrupadas.get(odtKey)!
      odtData.materiales.push({
        codigo: c.producto_codigo,
        descripcion: c.producto_descripcion,
        cantidad: c.cantidad || 1,
        serie: c.series || null
      })
    })

    odtsAgrupadas.forEach(v => detallePorOdt.push(v))

    return NextResponse.json({
      resumenCuadrillas: resumenCuadrillas.sort((a, b) => b.consumido - a.consumido),
      detallePorOdt: detallePorOdt.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
      stock: stock,
      debug: {
        step: debug.step,
        movimientosCount: debug.movimientosCount,
        movimientosError: debug.movimientosError,
        movimientosSample: debug.movimientosSample
      }
    })

  } catch (error: any) {
    // Return empty data instead of error for robustness
    return NextResponse.json({
      resumenCuadrillas: [],
      detallePorOdt: [],
      stock: [],
      error: error.message
    })
  }
}
