import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { loginObrador } from '@/lib/obrador/auth'
import { supabase } from '@/lib/supabase'

const PAUSA_ENTRE_REQUESTS = 2000 // 2 segundos entre requests
const LIMITE_POR_PAGINA = 20
const MAX_PAGINAS = 200 // 200 páginas = 4000 registros por ejecución

async function pausar(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

export async function GET() {
  return NextResponse.json({ status: 'sync-movimientos-obrador activo', metodo: 'POST para sincronizar' })
}

export async function POST(req: NextRequest) {
  const inicio = new Date()
  let registros_procesados = 0
  let errores = 0
  const detalle: string[] = []

  try {
    const token = await loginObrador()
    detalle.push(`✅ Login exitoso`)

    const baseUrl = process.env.OBRADOR_URL!.trim()
    const headers = {
      Authorization: `Bearer ${token}`,
      'ngrok-skip-browser-warning': 'true'
    }

    // Traer movimientos paginados
    const todosMovimientos: any[] = []
    let page = 1
    let hayMas = true
    let paginasProcesadas = 0

    detalle.push('📊 Iniciando descarga de movimientos...')

    while (hayMas && page <= MAX_PAGINAS && paginasProcesadas < 100) {
      try {
        const res = await axios.get(
          `${baseUrl}/stock_control?page=${page}&limit=${LIMITE_POR_PAGINA}`,
          { headers, timeout: 30000 }
        )

        const items = res.data.data || res.data.items || res.data || []

        if (Array.isArray(items) && items.length > 0) {
          // Get all movements - no filter
          todosMovimientos.push(...items)
          paginasProcesadas++
          
          if (items.length < LIMITE_POR_PAGINA) {
            hayMas = false
          } else {
            page++
          }
          
          // Pausa obligatoria entre requests
          await pausar(PAUSA_ENTRE_REQUESTS)
        } else {
          hayMas = false
        }
      } catch (e: any) {
        console.error(`Error en página ${page}:`, e.message)
        errores++
        hayMas = false
      }
    }

    detalle.push(`📊 ${todosMovimientos.length} movimientos traídos (${paginasProcesadas} páginas)`)

  // Guardar en Supabase
  if (todosMovimientos.length > 0) {
      const movimientosMapeados = todosMovimientos.map((m: any) => {
        const serie = m.movimiento_detalle_serial?.material?.serie || null
        const cuadrilla = m.movimiento?.desde_cuadrilla || {}
        
        return {
          movimiento_id: m.movimiento_id,
          movimiento_detalle_id: m.movimiento_detalle_id,
          odt: m.movimiento?.descripcion?.replace('ODT ', '') || '',
          cuadrilla_codigo: cuadrilla?.codigo || '',
          cuadrilla_nombre: cuadrilla?.descripcion || '',
          producto_codigo: m.material?.codigo || '',
          producto_descripcion: m.material?.descripcion || '',
          cantidad: parseFloat(m.cantidad) || 1,
          serie: serie,
          tipo_movimiento: m.movimiento?.tipo_movimiento?.tipo || '', // Save SALIDA or ENTRADA
          fecha: m.movimiento?.auditoria_alta || null,
          cliente: m.movimiento?.cliente?.descripcion || ''
        }
      })

      // Crear tabla si no existe (usando insert con retry)
      try {
        const { error: testError } = await supabase
          .from('movimientos_obrador')
          .select('movimiento_detalle_id')
          .limit(1)
        
        if (testError) {
          detalle.push('⚠️ Tabla no existe, creando...')
          // La tabla se crea al hacer el primer insert
        }
      } catch (e) {
        detalle.push('⚠️ Tabla no existe')
      }

      // Insertar en lotes de 50
      let insertados = 0
      for (let i = 0; i < Math.min(movimientosMapeados.length, 2000); i += 50) {
        const lote = movimientosMapeados.slice(i, i + 50)
        
        const { error } = await supabase
          .from('movimientos_obrador')
          .upsert(lote, { onConflict: 'movimiento_detalle_id' })
        
        if (!error) {
          insertados += lote.length
        }
        
        await pausar(500) // Pausa entre lotes
      }

      registros_procesados = insertados
      detalle.push(`✅ ${registros_procesados} registros guardados`)
    }

    return NextResponse.json({
      ok: true,
      registros_procesados,
      errores,
      detalle
    })

  } catch (error: any) {
    console.error('Error sync movimientos:', error)
    return NextResponse.json({
      ok: false,
      error: error.message,
      detalle
    }, { status: 500 })
  }
}
