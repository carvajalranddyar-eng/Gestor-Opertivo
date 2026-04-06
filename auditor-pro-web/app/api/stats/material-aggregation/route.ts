import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { validarODT, MaterialCount } from '@/lib/validator'

const MATERIAL_MASTER: Record<string, { desc: string, priority: number }> = {
  '072003015': { desc: 'MEDIDOR DE AGUA CLASE B DN 15 - PLASTICO', priority: 1 },
  '072002015': { desc: 'PRECINTO PARA MEDIDOR TIPO (ROTO SEAL) - PLAST NUMERADO', priority: 3 },
  '070008001': { desc: 'CAJA INY CON TAPA: 400 X 200 X 165', priority: 2 },
  '050048115': { desc: 'LLAVE MAESTRA PLAST HIBRIDA (INT METAL) DN 15 PEAD 25-SALIDA TL 20X27', priority: 4 },
  '050056131': { desc: 'EMPALME PEAD 25 PLASTICO,SALIDA T.L. 20X27 PLASTICA', priority: 4 },
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const filtroGravedad = searchParams.get('gravedad') || ''

    async function fetchAll(supabase: any, table: string, select: string, batchSize: number = 1000) {
      const allData: any[] = []
      let offset = 0
      while (true) {
        const { data } = await supabase
          .from(table)
          .select(select)
          .range(offset, offset + batchSize - 1)
        
        if (!data || data.length === 0) break
        allData.push(...data)
        if (data.length < batchSize) break
        offset += batchSize
      }
      return allData
    }

    const odtsData = await fetchAll(supabase, 'odts', 'codigo_barras, numero, estado, cuadrilla_id, cuadrilla_nombre, medidor_serie')
    const consumosData = await fetchAll(supabase, 'consumos', 'odt_codigo, producto_codigo, cantidad, series')
    const movimientosData = await fetchAll(supabase, 'movimientos_obrador', 'desde_cuadrilla_codigo, desde_cuadrilla_descripcion, hacia_cuadrilla_codigo, hacia_cuadrilla_descripcion, producto_codigo, cantidad, tipo_movimiento, remito, fecha, serie')
    const stockData = await fetchAll(supabase, 'stock_obrador', 'cuadrilla_codigo, cuadrilla_nombre, producto_codigo, cantidad, ubicacion')
    const obradorControlData = await fetchAll(supabase, 'obrador_control', 'cuadrilla_codigo, cuadrilla_nombre, producto_codigo, cantidad, tipo_movimiento, fecha, serie, remito')

    const balanceMap = new Map<string, any>()

    function getBalanceEntry(key: string, nombre: string = '') {
      if (!balanceMap.has(key)) {
        balanceMap.set(key, {
          cuadrilla: key,
          cuadrilla_nombre: nombre,
          materiales: {} as Record<string, any>,
          odtsCount: 0,
          odtsVerdes: 0,
          odtsAmarillos: 0,
          odtsList: [] as any[] // Store list of ODTs for export
        })
      }
      return balanceMap.get(key)
    }

    function getMaterialData(entry: any, code: string) {
      if (!entry.materiales[code]) {
        const master = MATERIAL_MASTER[code]
        entry.materiales[code] = {
          code,
          desc: master?.desc || code,
          priority: master?.priority || 99,
          entregado: 0,
          verificado: 0,
          dudoso: 0,
          devuelto: 0,
          detalleEntregado: [] as { serie: string, remito: string, fecha: string }[]
        }
      }
      return entry.materiales[code]
    }

    // 1. Process obrador_control (Real Data)
    const useEstimatedEntregado = (obradorControlData?.length || 0) === 0
    console.log('useEstimatedEntregado:', useEstimatedEntregado, 'records:', obradorControlData?.length)

    obradorControlData?.forEach((o: any) => {
        const cuadrillaKey = o.cuadrilla_codigo
        if (!cuadrillaKey || !o.producto_codigo) return
        
        const entry = getBalanceEntry(cuadrillaKey, o.cuadrilla_nombre || '')
        const code = o.producto_codigo
        const matData = getMaterialData(entry, code)

        if (o.tipo_movimiento === 'SALIDA' || o.tipo_movimiento === 'ENVIO A OBRA' || o.tipo_movimiento === 'CONSUMO EN OBRA') {
            matData.entregado += (parseFloat(o.cantidad) || 1)
            
            if (o.serie || o.remito) {
              matData.detalleEntregado.push({
                serie: o.serie || 'N/A',
                remito: o.remito || 'SIN REMITO',
                fecha: o.fecha || ''
              })
            }
        }
    })

    // 2. Process movimientos (Devueltos)
    movimientosData?.forEach((m: any) => {
      let cuadrillaKey = m.hacia_cuadrilla_codigo
      let cuadrillaNombre = m.hacia_cuadrilla_descripcion || ''
      
      if (!cuadrillaKey) {
        cuadrillaKey = m.desde_cuadrilla_codigo
        cuadrillaNombre = m.desde_cuadrilla_descripcion || ''
      }

      if (!cuadrillaKey || !m.producto_codigo) return
      
      const entry = getBalanceEntry(cuadrillaKey, cuadrillaNombre)
      const code = m.producto_codigo
      const cantidad = parseFloat(m.cantidad) || 1
      const matData = getMaterialData(entry, code)

      if (m.tipo_movimiento === 'ENTRADA') {
        matData.devuelto += cantidad
      }
    })

    // 3. Prepare series map from consumption
    const odtSeriesMap = new Map<string, Map<string, string[]>>()
    consumosData?.forEach((c: any) => {
      if (c.odt_codigo && c.producto_codigo === '072003015' && c.series) {
        if (!odtSeriesMap.has(c.odt_codigo)) {
          odtSeriesMap.set(c.odt_codigo, new Map())
        }
        const codeMap = odtSeriesMap.get(c.odt_codigo)!
        if (!codeMap.has('072003015')) {
          codeMap.set('072003015', [])
        }
        const parts = c.series.split(',').map((s: string) => s.trim())
        codeMap.get('072003015')!.push(...parts)
      }
    })

    // 4. Process ODTs for verification
    const consumosByOdt = new Map<string, { productos: string[], series: string[] }>()
    consumosData?.forEach((c: any) => {
      if (c.odt_codigo) {
        if (!consumosByOdt.has(c.odt_codigo)) {
          consumosByOdt.set(c.odt_codigo, { productos: [], series: [] })
        }
        const entry = consumosByOdt.get(c.odt_codigo)!
        entry.productos.push(c.producto_codigo)
        if (c.series) {
          entry.series.push(c.series)
        }
      }
    })

    const odtStatusMap = new Map<string, string>()
    odtsData?.forEach((o: any) => {
      if (o.codigo_barras && o.estado) odtStatusMap.set(o.codigo_barras, o.estado)
      if (o.numero && o.estado) odtStatusMap.set(o.numero, o.estado)
    })

    const odtCuadrillaMap = new Map<string, string>()
    const odtMedidorSerieMap = new Map<string, string>()
    odtsData?.forEach((o: any) => {
      const cuadrilla = o.cuadrilla_id ? String(o.cuadrilla_id) : null
      
      if (o.codigo_barras && cuadrilla) {
        odtCuadrillaMap.set(o.codigo_barras, cuadrilla)
      }
      if (o.numero && cuadrilla) {
        odtCuadrillaMap.set(o.numero, cuadrilla)
      }
      
      if (o.codigo_barras && o.medidor_serie) {
        odtMedidorSerieMap.set(o.codigo_barras, o.medidor_serie)
      }
    })

    const allSeriesUsed = new Map<string, string[]>()

    for (const [odtCodigo, data] of consumosByOdt) {
      const { productos, series } = data
      
      const filteredProducts = productos.filter((p: string) => !!MATERIAL_MASTER[p])

      const countByCategory: MaterialCount = {
        medidor: 0,
        precinto: 0,
        caja: 0,
        llave: 0,
        empalme: 0,
        juntas: 0
      }

      filteredProducts.forEach((code: string) => {
        const master = MATERIAL_MASTER[code]
        if (master && master.priority === 1) countByCategory.medidor++
        else if (master && master.priority === 2) countByCategory.caja++
        else if (master && master.priority === 3) countByCategory.precinto++
        else if (master && master.priority === 4) {
             if (code === '050048115') countByCategory.llave++
             if (code === '050056131') countByCategory.empalme++
        }
      })

      const estadoODT = odtStatusMap.get(odtCodigo) || null
      if (!estadoODT) continue

      const medidorSerie = odtMedidorSerieMap.get(odtCodigo) || null
      
      const validation = validarODT(
        countByCategory,
        medidorSerie,
        series,
        allSeriesUsed,
        estadoODT
      )

      const cuadrilla = odtCuadrillaMap.get(odtCodigo)
      if (!cuadrilla) continue

      const entry = getBalanceEntry(cuadrilla)
      entry.odtsCount++

      const addMaterials = (code: string, type: 'verificado' | 'dudoso' | 'entregado') => {
         const matData = getMaterialData(entry, code)
         if (type === 'verificado') matData.verificado++
         if (type === 'dudoso') matData.dudoso++
         
         if (type === 'entregado') {
            matData.entregado++
            
            // Add series only if estimated (no obrador data)
            if (useEstimatedEntregado && code === '072003015') {
               const odtSeries = odtSeriesMap.get(odtCodigo)?.get('072003015')
               if (odtSeries && odtSeries.length > 0) {
                 odtSeries.forEach((s: string) => {
                    matData.detalleEntregado.push({
                      serie: s,
                      remito: 'POR CONSUMO',
                      fecha: ''
                    })
                 })
               }
            }
         }
      }

      if (validation.estado === 'verde') {
        entry.odtsVerdes++
        // Add ODT to list
        entry.odtsList.push({
          odtCodigo,
          estado: validation.estado,
          fecha: '', // We don't have date easily accessible here without extra map
          materiales: filteredProducts
        })
        filteredProducts.forEach((code: string) => addMaterials(code, 'verificado'))
        filteredProducts.forEach((code: string) => addMaterials(code, 'entregado'))
      } else if (validation.estado === 'amarillo' || validation.estado === 'rojo') {
        entry.odtsAmarillos++
        entry.odtsList.push({
          odtCodigo,
          estado: validation.estado,
          fecha: '',
          materiales: filteredProducts
        })
        filteredProducts.forEach((code: string) => addMaterials(code, 'dudoso'))
        filteredProducts.forEach((code: string) => addMaterials(code, 'entregado'))
      }
    }

    const result = Array.from(balanceMap.values()).map((entry: any) => {
      const matList = Object.values(entry.materiales || {})
      matList.sort((a: any, b: any) => a.priority - b.priority)

      const diferencia: any = {}
      let gravedad = 0

      matList.forEach((mat: any) => {
        diferencia[mat.code] = mat.entregado - mat.verificado
        if (mat.priority === 1 && diferencia[mat.code] !== 0) gravedad += Math.abs(diferencia[mat.code]) * 2
        if (mat.priority === 4 && diferencia[mat.code] !== 0) gravedad += Math.abs(diferencia[mat.code]) * 3
      })

      return {
        cuadrilla: entry.cuadrilla,
        cuadrilla_nombre: entry.cuadrilla_nombre,
        materiales: matList,
        diferencia,
        gravedad,
        odtsCount: entry.odtsCount,
        odtsVerdes: entry.odtsVerdes,
        odtsAmarillos: entry.odtsAmarillos,
        odtsList: entry.odtsList || [], // Export this
        isEstimated: useEstimatedEntregado
      }
    })

    let filteredResult = result
    if (filtroGravedad === 'rojo') {
      filteredResult = result.filter((r: any) => r.gravedad >= 10)
    } else if (filtroGravedad === 'amarillo') {
      filteredResult = result.filter((r: any) => r.gravedad > 0 && r.gravedad < 10)
    }

    filteredResult.sort((a: any, b: any) => b.gravedad - a.gravedad)

    return NextResponse.json({
      ok: true,
      balance: filteredResult,
      totalCuadrillas: filteredResult.length
    })

  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}