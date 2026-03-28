import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Get unique cuadrillas from consumos (PSM)
    const { data: consumosCuadrillas } = await supabase
      .from('consumos')
      .select('cuadrilla_descripcion')
      .limit(100)
    
    const cuadrillasPSM = [...new Set(consumosCuadrillas?.map(c => c.cuadrilla_descripcion).filter(Boolean))]
    
    // Get unique cuadrillas from movimientos (Obrador)
    const { data: movimientosCuadrillas } = await supabase
      .from('movimientos_obrador')
      .select('cuadrilla_nombre')
      .limit(100)
    
    const cuadrillasObrador = [...new Set(movimientosCuadrillas?.map(m => m.cuadrilla_nombre).filter(Boolean))]
    
    return NextResponse.json({
      psmm: cuadrillasPSM.slice(0, 10),
      obrador: cuadrillasObrador.slice(0, 10)
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
