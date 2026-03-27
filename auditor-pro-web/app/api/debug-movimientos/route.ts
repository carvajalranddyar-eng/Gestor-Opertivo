import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Get sample of all tipos
    const { data, error } = await supabase
      .from('movimientos_obrador')
      .select('tipo_movimiento, cantidad, cuadrilla_nombre')
      .limit(20)
    
    if (error) throw error
    
    return NextResponse.json({ sample: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
