import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { loginObrador } from '@/lib/obrador/auth'
import { supabase } from '@/lib/supabase'

const PAUSA_ENTRE_REQUESTS = 300 // 0.3 segundos entre requests
const LIMITE_POR_PAGINA = 100 // máximo 100 por request

async function pausar(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

export async function GET() {
  return NextResponse.json({ status: 'sync-obrador activo', metodo: 'POST para sincronizar' })
}

export async function POST(req: NextRequest) {
  const inicio = new Date()
  let registros_procesados = 0
  let errores = 0
  const detalle: string[] = []

  try {
    const token = await loginObrador()
    detalle.push(`✅ Login exitoso, token: ${token.substring(0, 20)}...`)

    const baseUrl = process.env.OBRADOR_URL!.trim()
    detalle.push(`🔗 URL base: ${baseUrl}`)
    const headers = {
      Authorization: `Bearer ${token}`,
      'ngrok-skip-browser-warning': 'true'
    }

    // 1. Traer stock paginado con pausa entre requests
    const todoElStock: any[] = []
    let page = 1
    let hayMas = true
    const MAX_PAGINAS = 100 // ~10000 registros con 100 por página

    detalle.push('📦 Iniciando descarga de stock paginada...')

    while (hayMas && page <= MAX_PAGINAS) {
      try {
        const res = await axios.get(
          `${baseUrl}/stock?page=${page}&limit=${LIMITE_POR_PAGINA}`,
          { headers, timeout: 30000 }
        )

        const items = res.data.data || res.data.items || res.data || []

        if (Array.isArray(items) && items.length > 0) {
          todoElStock.push(...items)
          hayMas = items.length === LIMITE_POR_PAGINA
          page++
          // Pausa obligatoria entre requests para no saturar
          await pausar(PAUSA_ENTRE_REQUESTS)
        } else {
          hayMas = false
        }
      } catch (e) {
        hayMas = false
        errores++
      }
    }

    detalle.push(`📦 ${todoElStock.length} items de stock traídos`)

    // 2. Traer serializados (medidores con número de serie)
    const todosSeriales: any[] = []
    page = 1
    hayMas = true

    while (hayMas && page <= MAX_PAGINAS) {
      try {
        const res = await axios.get(
          `${baseUrl}/material_serial?page=${page}&limit=${LIMITE_POR_PAGINA}`,
          { headers, timeout: 30000 }
        )

        const items = res.data.data || res.data.items || res.data || []

        if (Array.isArray(items) && items.length > 0) {
          todosSeriales.push(...items)
          hayMas = items.length === LIMITE_POR_PAGINA
          page++
          await pausar(PAUSA_ENTRE_REQUESTS)
        } else {
          hayMas = false
        }
      } catch (e) {
        hayMas = false
        errores++
      }
    }

    detalle.push(`🔢 ${todosSeriales.length} serializados traídos`)

    // 3. Limpiar y guardar en Supabase
    if (todoElStock.length > 0 || todosSeriales.length > 0) {
      await supabase.from('stock_obrador').delete().neq('id', 0)

      // Mapear stock con la estructura correcta del API
      const stockMapeado = todoElStock.map((s: any) => ({
        cuadrilla_codigo: String(s.cuadrilla?.codigo || ''),
        cuadrilla_nombre: s.cuadrilla?.descripcion || '',
        producto_codigo: s.material?.codigo || '',
        producto_descripcion: s.material?.descripcion || '',
        cantidad: parseFloat(s.cantidad) || 0,
        serie: null,
        ubicacion: s.ubicacion?.tipo || '',
        cliente: s.cliente || '',
        es_serializado: s.es_serial || false
      }))

      // Mapear serializados
      const serializadosMapeados = todosSeriales.map((s: any) => ({
        cuadrilla_codigo: String(s.cuadrilla?.codigo || ''),
        cuadrilla_nombre: s.cuadrilla?.descripcion || '',
        producto_codigo: s.material?.codigo || '072003015',
        producto_descripcion: s.material?.descripcion || 'MEDIDOR',
        cantidad: parseFloat(s.cantidad) || 1,
        serie: s.serie || s.numero_serie || '',
        ubicacion: s.ubicacion?.tipo || '',
        cliente: s.cliente || '',
        es_serializado: true
      }))

      const stockParaGuardar = [...stockMapeado, ...serializadosMapeados] // guardar todo el stock

      // Insert in smaller batches with error handling
      const MAX_REGISTROS = 10000
      const TAMANO_BATCH = 50
      
      for (let i = 0; i < Math.min(stockParaGuardar.length, MAX_REGISTROS); i += TAMANO_BATCH) {
        const batch = stockParaGuardar.slice(i, i + TAMANO_BATCH)
        const { error: insertError } = await supabase.from('stock_obrador').insert(batch)
        if (insertError) {
          detalle.push(`⚠️ Error insertando batch ${i}: ${insertError.message}`)
        } else {
          registros_procesados += batch.length
        }
        // Pausa pequeña entre batches para no saturar
        if (i + TAMANO_BATCH < Math.min(stockParaGuardar.length, MAX_REGISTROS)) {
          await pausar(100)
        }
      }

      detalle.push(`✅ ${registros_procesados} registros guardados en Supabase`)
    }

    // 4. Detectar irregularidades cruzando Obrador vs PSM
    const { data: consumosPSM } = await supabase
      .from('consumos')
      .select('*')
      .eq('producto_codigo', '072003015')

    const { data: stockObrador } = await supabase
      .from('stock_obrador')
      .select('*')

    if (consumosPSM && stockObrador) {
      const seriesPSM = new Map<string, string>()
      consumosPSM.forEach((c: any) => {
        if (c.series) seriesPSM.set(String(c.series), String(c.odt_codigo))
      })

      const hallazgosNuevos: any[] = []

      stockObrador.forEach((s: any) => {
        if (!s.serie) return
        const serie = String(s.serie)
        const odtPSM = seriesPSM.get(serie)

        // Medidor en stock del Obrador pero ya registrado como consumido en PSM
        if (odtPSM) {
          hallazgosNuevos.push({
            odt_codigo: odtPSM,
            tipo_hallazgo: 'medidor_en_stock_y_consumido',
            descripcion: `Medidor serie ${serie} figura en stock del Obrador para cuadrilla ${s.cuadrilla_nombre} pero ya fue registrado como instalado en ODT ${odtPSM}`,
            severidad: 'critica',
            fuente_1: `Obrador stock (cuadrilla ${s.cuadrilla_nombre})`,
            fuente_2: `PSM consumos (ODT ${odtPSM})`,
            confirmado: true
          })
        }
      })

      if (hallazgosNuevos.length > 0) {
        await supabase
          .from('hallazgos')
          .delete()
          .eq('tipo_hallazgo', 'medidor_en_stock_y_consumido')

        for (let i = 0; i < hallazgosNuevos.length; i += 500) {
          await supabase.from('hallazgos').insert(hallazgosNuevos.slice(i, i + 500))
        }
        detalle.push(`🔍 ${hallazgosNuevos.length} irregularidades detectadas`)
      }
    }

    await supabase.from('sincronizaciones').insert({
      tipo: 'obrador',
      inicio: inicio.toISOString(),
      fin: new Date().toISOString(),
      odts_procesadas: registros_procesados,
      consumos_procesados: 0,
      errores,
      estado: 'exitoso',
      detalle: { pasos: detalle }
    })

    return NextResponse.json({
      ok: true,
      registros_procesados,
      errores,
      detalle
    })

  } catch (error: any) {
    await supabase.from('sincronizaciones').insert({
      tipo: 'obrador',
      inicio: inicio.toISOString(),
      fin: new Date().toISOString(),
      odts_procesadas: 0,
      consumos_procesados: 0,
      errores,
      estado: 'error',
      detalle: { error: error.message, pasos: detalle }
    })

    return NextResponse.json({
      ok: false,
      error: error.message,
      detalle,
      axiosError: error.response?.data || error.code
    }, { status: 500 })
  }
}
