import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { validarODT, contarMateriales } from '@/lib/validator'
import * as XLSX from 'xlsx'

export const maxDuration = 120

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const filtro = searchParams.get('filtro') || ''
  const filtroCuadrilla = searchParams.get('cuadrilla') || ''
  const filtroPSM = searchParams.get('psm_estado') || ''

  try {
    const allConsumosData = new Map<string, {productos: string[], cantidades: Map<string, number>, series: string[], descripciones: Map<string, string>}>()
    let offsetConsumos = 0
    const batchSize = 1000
    
    while (true) {
      const { data: consumoBatch } = await supabase
        .from('consumos')
        .select('odt_codigo, producto_codigo, cantidad, series, producto_descripcion')
        .range(offsetConsumos, offsetConsumos + batchSize - 1)
      
      if (!consumoBatch || consumoBatch.length === 0) break
      
      consumoBatch.forEach((c: any) => {
        if (c.odt_codigo) {
          if (!allConsumosData.has(c.odt_codigo)) {
            allConsumosData.set(c.odt_codigo, { productos: [], cantidades: new Map(), series: [], descripciones: new Map() })
          }
          const data = allConsumosData.get(c.odt_codigo)!
          data.productos.push(c.producto_codigo)
          
          const currentQty = data.cantidades.get(c.producto_codigo) || 0
          data.cantidades.set(c.producto_codigo, currentQty + (c.cantidad || 1))
          
          if (c.series && c.series !== 'N/A') {
            data.series.push(c.series)
          }
          
          if (c.producto_descripcion) {
            data.descripciones.set(c.producto_codigo, c.producto_descripcion)
          }
        }
      })
      
      if (consumoBatch.length < batchSize) break
      offsetConsumos += batchSize
    }

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

    const analisisAllMap = new Map<string, any>()
    const matchingCodes = [...allConsumosData.keys()]
    
    const { data: odtsConSerie } = await supabase
      .from('odts')
      .select('codigo_barras, medidor_serie')
      .in('codigo_barras', matchingCodes.length > 0 ? matchingCodes : [''])
    
    const seriePSMMap = new Map<string, string | null>()
    odtsConSerie?.forEach(o => seriePSMMap.set(o.codigo_barras, o.medidor_serie))

    const { data: odtsConEstado } = await supabase
      .from('odts')
      .select('codigo_barras, estado')
      .in('codigo_barras', matchingCodes.length > 0 ? matchingCodes : [''])
    
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
        countByCategory,
        productosCount: productos.length,
        seriesConsumo: data.series,
        serieEfectiva: result.serieEfectiva
      })
    })

    let allMatchingOdts: any[] = []
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
      filteredOdts = filteredOdts.filter((o: any) => analisisAllMap.get(o.codigo_barras)?.estadoSemaforo === 'rojo')
    } else if (filtro === 'amarillo') {
      filteredOdts = filteredOdts.filter((o: any) => analisisAllMap.get(o.codigo_barras)?.estadoSemaforo === 'amarillo')
    } else if (filtro === 'verde') {
      filteredOdts = filteredOdts.filter((o: any) => analisisAllMap.get(o.codigo_barras)?.estadoSemaforo === 'verde')
    } else if (filtro === 'purpura' || filtro === 'duplicada') {
      filteredOdts = filteredOdts.filter((o: any) => analisisAllMap.get(o.codigo_barras)?.estadoSemaforo === 'purpura')
    } else if (filtro === 'naranja') {
      filteredOdts = filteredOdts.filter((o: any) => analisisAllMap.get(o.codigo_barras)?.estadoSemaforo === 'naranja')
    }

    if (filtroCuadrilla) {
      const searchTerm = filtroCuadrilla.toLowerCase().trim()
      filteredOdts = filteredOdts.filter((o: any) => {
        if (!o.cuadrilla_nombre) return false
        return o.cuadrilla_nombre.toString().toLowerCase().includes(searchTerm)
      })
    }

    if (filtroPSM) {
      filteredOdts = filteredOdts.filter((o: any) => o.estado === filtroPSM)
    }

    // UNA FILA POR CADA MATERIAL - para表格 dinámica
    const rows: any[] = []
    
    filteredOdts.forEach((o: any) => {
      const analisis = analisisAllMap.get(o.codigo_barras)
      const consumosData = allConsumosData.get(o.codigo_barras)
      
      const materialesList: {codigo: string, descripcion: string, cantidad: number}[] = []
      consumosData?.descripciones.forEach((desc, codigo) => {
        const cantidad = consumosData.cantidades.get(codigo) || 0
        materialesList.push({ codigo, descripcion: desc, cantidad })
      })

      if (materialesList.length === 0) {
        rows.push({
          ODT: o.codigo_barras,
          Numero: o.numero,
          Cliente: o.cliente,
          Direccion: o.direccion,
          Cuadrilla: o.cuadrilla_nombre,
          Estado_PSM: o.estado,
          Fecha_Ingreso: o.fecha_ingreso,
          Estado_Semaforo: analisis?.estadoSemaforo || 'sin_datos',
          Motivo: analisis?.motivo || '',
          Medidor_Serie: analisis?.serieEfectiva || o.medidor_serie || '',
          Material_Codigo: '',
          Material_Descripcion: '',
          Material_Cantidad: 0,
          Tiene_Foto: o.foto ? 'SI' : 'NO'
        })
      } else {
        // Una fila por cada material - SIEMPRE填满所有字段
        materialesList.forEach((mat) => {
          rows.push({
            ODT: o.codigo_barras,
            Numero: o.numero,
            Cliente: o.cliente,
            Direccion: o.direccion,
            Cuadrilla: o.cuadrilla_nombre,
            Estado_PSM: o.estado,
            Fecha_Ingreso: o.fecha_ingreso,
            Estado_Semaforo: analisis?.estadoSemaforo || 'sin_datos',
            Motivo: analisis?.motivo || '',
            Medidor_Serie: analisis?.serieEfectiva || o.medidor_serie || '',
            Material_Codigo: mat.codigo,
            Material_Descripcion: mat.descripcion,
            Material_Cantidad: mat.cantidad,
            Tiene_Foto: o.foto ? 'SI' : 'NO'
          })
        })
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ODTs_Materiales')
    
    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 12 },
      { wch: 25 },
      { wch: 35 },
      { wch: 20 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
      { wch: 30 },
      { wch: 15 },
      { wch: 15 },
      { wch: 50 },
      { wch: 10 },
      { wch: 10 },
    ]
    
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="ODTs_${filtro || 'todos'}_${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    })

  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
