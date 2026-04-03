import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Get sample from PSM (odts table)
    const { data: psmSample } = await supabase
      .from('odts')
      .select('codigo_barras, numero, cliente, direccion, cuadrilla_nombre, estado, fecha_ingreso, medidor_serie')
      .limit(3)

    // Get sample from Obrador (consumos table)
    const { data: obradorSample } = await supabase
      .from('consumos')
      .select('odt_codigo, producto_codigo, producto_descripcion, cantidad, cuadrilla_descripcion, fecha_consumo, series')
      .limit(3)

    // Get table row counts
    const { count: odtsCount } = await supabase.from('odts').select('id', { count: 'exact' })
    const { count: consumosCount } = await supabase.from('consumos').select('id', { count: 'exact' })

    return NextResponse.json({
      ok: true,
      psm: {
        table: 'odts',
        recordCount: odtsCount,
        sampleRecords: psmSample,
        fields: ['codigo_barras', 'numero', 'cliente', 'direccion', 'cuadrilla_nombre', 'estado', 'fecha_ingreso', 'medidor_serie']
      },
      obrador: {
        table: 'consumos',
        recordCount: consumosCount,
        sampleRecords: obradorSample,
        fields: ['odt_codigo', 'producto_codigo', 'producto_descripcion', 'cantidad', 'cuadrilla_descripcion', 'fecha_consumo', 'series']
      }
    })

  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
