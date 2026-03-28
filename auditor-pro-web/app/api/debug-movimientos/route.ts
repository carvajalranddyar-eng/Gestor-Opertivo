import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Check if cuadrilla_codigo exists in consumos
    const { data, error } = await supabase
      .from('consumos')
      .select('cuadrilla_codigo, cuadrilla_descripcion')
      .not('cuadrilla_codigo', 'is', null)
      .limit(10)
    
    if (error) throw error
    
    const withCode = data?.filter(c => c.cuadrilla_codigo) || []
    const withoutCode = data?.filter(c => !c.cuadrilla_codigo) || []
    
    return NextResponse.json({ 
      withCode: withCode.length,
      withoutCode: withoutCode.length,
      sampleWith: withCode.slice(0, 5),
      sampleWithout: withoutCode.slice(0, 5)
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
