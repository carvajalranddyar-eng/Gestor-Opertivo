import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const MATERIALES_BASICOS = [
  '070008001', // CAJA
  '072002015', // PRECINTO
  '072003015'  // MEDIDOR
]

export async function GET(req: NextRequest, { params }: { params: Promise<{ odt: string }> }) {
  try {
    const { odt } = await params
    const odtCodigo = decodeURIComponent(odt)

    // Get ODT details
    const { data: odtData, error: odtError } = await supabase
      .from('odts')
      .select('*')
      .eq('codigo_barras', odtCodigo)
      .single()

    if (odtError) throw new Error(odtError.message)

    // Get consumos for this ODT - EXACT MATCH ONLY
    const { data: consumos, error: consError } = await supabase
      .from('consumos')
      .select('producto_codigo, producto_descripcion, cantidad, series, cuadrilla_descripcion, fecha_consumo')
      .eq('odt_codigo', odtCodigo)
      .order('fecha_consumo', { ascending: false })

    if (consError) throw new Error(consError.message)

    // Get verificacion if exists
    const { data: verif } = await supabase
      .from('verificaciones_odt')
      .select('*')
      .eq('odt_codigo', odtCodigo)
      .single()

    // ANALISIS DE MATERIALES
    const productosConsumidos = consumos?.map(c => c.producto_codigo) || []
    const tieneCaja = productosConsumidos.some(p => p === '070008001' || p.startsWith('0700'))
    const tienePrecinto = productosConsumidos.some(p => p === '072002015' || p.startsWith('0720'))
    const tieneMedidor = productosConsumidos.some(p => p === '072003015' || p.startsWith('0720'))
    
    // Serie del medidor en PSM
    const seriePSM = odtData?.medidor_serie
    // Series en consumos
    const seriesConsumo = consumos?.filter(c => c.series).map(c => c.series) || []
    
    // Validar serie
    let serieValida = null
    if (seriePSM) {
      serieValida = seriesConsumo.includes(seriePSM) ? 'OK' : 'NO_AUTORIZADA'
    }

    // Determinar estado del semáforo
    let estadoSemaforo = 'verde'
    let observaciones = ''
    
    const tieneBasicos = tieneCaja && tienePrecinto && tieneMedidor
    const tieneExtras = productosConsumidos.length > 3

    if (odtData?.estado === 'R11') {
      if (!tieneBasicos) {
        estadoSemaforo = 'rojo'
        const faltantes = []
        if (!tieneCaja) faltantes.push('Caja')
        if (!tienePrecinto) faltantes.push('Precinto')
        if (!tieneMedidor) faltantes.push('Medidor')
        observaciones = `Faltan: ${faltantes.join(', ')}`
      } else if (!tieneExtras) {
        estadoSemaforo = 'amarillo'
        observaciones = '⚠️ Solo kit básico: Verificar materiales en foto'
      }
    }

    // Buscar stock entregado a esta cuadrilla en Obrador
    let stockEntregado: any[] = []
    if (odtData?.cuadrilla_nombre) {
      const { data: stock } = await supabase
        .from('stock')
        .select('producto_codigo, producto_descripcion, cantidad, fecha_entrega')
        .eq('cuadrilla_nombre', odtData.cuadrilla_nombre)
        .gte('fecha_entrega', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // último mes
      
      stockEntregado = stock || []
    }

    return NextResponse.json({
      ok: true,
      odt: odtData,
      consumos: consumos || [],
      verificacion: verif,
      analisis: {
        tieneCaja,
        tienePrecinto,
        tieneMedidor,
        seriePSM,
        seriesConsumo,
        serieValida,
        estadoSemaforo,
        observaciones,
        productosConsumidos: productosConsumidos.length,
        stockEntregado
      }
    })

  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
