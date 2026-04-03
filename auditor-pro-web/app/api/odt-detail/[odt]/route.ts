import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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

    // Get consumos for this ODT (try both codigo_barras and numero)
    const { data: consumos, error: consError } = await supabase
      .from('consumos')
      .select('producto_codigo, producto_descripcion, cantidad, series, cuadrilla_descripcion, fecha_consumo')
      .or(`odt_codigo.eq.${odtCodigo},odt_codigo.like.%${odtCodigo}%`)
      .order('fecha_consumo', { ascending: false })

    if (consError) throw new Error(consError.message)

    // Get verificacion if exists
    const { data: verif } = await supabase
      .from('verificaciones_odt')
      .select('*')
      .eq('odt_codigo', odtCodigo)
      .single()

    return NextResponse.json({
      ok: true,
      odt: odtData,
      consumos: consumos || [],
      verificacion: verif
    })

  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
