import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const cuadrilla = searchParams.get('cuadrilla')
    const desde = searchParams.get('desde')
    const hasta = searchParams.get('hasta')

    // Obtener consumos
    let queryConsumos = supabase
      .from('consumos')
      .select('*')

    if (cuadrilla) {
      queryConsumos = queryConsumos.ilike('cuadrilla_descripcion', `%${cuadrilla}%`)
    }

    if (desde) {
      queryConsumos = queryConsumos.gte('fecha_consumo', desde)
    }

    if (hasta) {
      queryConsumos = queryConsumos.lte('fecha_consumo', hasta + 'T23:59:59')
    }

    const { data: consumos, error: errorConsumos } = await queryConsumos

    if (errorConsumos) throw errorConsumos

    // Obtener movimientos (entradas = entregados)
    let queryMovimientos = supabase
      .from('movimientos_obrador')
      .select('*')
      .eq('tipo_movimiento', 'Entrada')

    if (cuadrilla) {
      queryMovimientos = queryMovimientos.ilike('cuadrilla', `%${cuadrilla}%`)
    }

    if (desde) {
      queryMovimientos = queryMovimientos.gte('fecha', desde)
    }

    if (hasta) {
      queryMovimientos = queryMovimientos.lte('fecha', hasta + 'T23:59:59')
    }

    const { data: movimientos, error: errorMovimientos } = await queryMovimientos

    if (errorMovimientos) throw errorMovimientos

    // Obtener stock actual
    const { data: stock, error: errorStock } = await supabase
      .from('stock_obrador')
      .select('*')
      .order('descripcion')

    if (errorStock) throw errorStock

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
      const cuadrillaKey = m.cuadrilla || 'Sin cuadrilla'
      
      if (!movimientosPorCuadrilla.has(cuadrillaKey)) {
        movimientosPorCuadrilla.set(cuadrillaKey, {
          cuadrilla: cuadrillaKey,
          totalEntregado: 0,
          materiales: new Map()
        })
      }

      const data = movimientosPorCuadrilla.get(cuadrillaKey)!
      data.totalEntregado += m.cantidad || 0

      const matKey = m.codigo_producto
      if (!data.materiales.has(matKey)) {
        data.materiales.set(matKey, {
          codigo: m.codigo_producto,
          descripcion: m.descripcion_producto || m.descripcion,
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
      stock: stock || []
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
