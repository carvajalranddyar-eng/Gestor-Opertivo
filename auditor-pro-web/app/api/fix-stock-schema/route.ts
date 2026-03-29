import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST() {
  try {
    const { error } = await supabase
      .from('stock_obrador')
      .insert({
        cuadrilla_codigo: 'TEST_FIX',
        producto_codigo: 'TEST',
        cantidad: 1
      })

    if (error) {
      return NextResponse.json({ 
        ok: false, 
        error: error.message,
        solucion: 'La columna cantidad aún no existe. Ejecuta en SQL Editor: ALTER TABLE stock_obrador ADD COLUMN IF NOT EXISTS cantidad NUMERIC(15,3);'
      })
    }

    await supabase.from('stock_obrador').delete().eq('cuadrilla_codigo', 'TEST_FIX')

    return NextResponse.json({ 
      ok: true, 
      message: '✅ ¡La columna cantidad ahora existe! Stock se puede sincronizar.'
    })

  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
