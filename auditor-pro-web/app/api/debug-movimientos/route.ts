import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Get code mapping between PSM and Obrador
    // From consumos (PSM)
    const { data: consumos } = await supabase
      .from('consumos')
      .select('cuadrilla_codigo, cuadrilla_descripcion')
      .limit(10)
    
    // From movimientos (Obrador) 
    const { data: movimientos } = await supabase
      .from('movimientos_obrador')
      .select('cuadrilla_codigo, cuadrilla_nombre')
      .limit(10)
    
    return NextResponse.json({
      psm: consumos?.map(c => ({ code: c.cuadrilla_codigo, name: c.cuadrilla_descripcion })),
      obrador: movimientos?.map(m => ({ code: m.cuadrilla_codigo, name: m.cuadrilla_nombre }))
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
