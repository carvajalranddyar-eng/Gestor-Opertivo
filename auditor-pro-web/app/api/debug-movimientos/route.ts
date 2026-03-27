import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('movimientos_obrador')
      .select('tipo_movimiento')
    
    if (error) throw error
    
    const counts: Record<string, number> = {}
    data?.forEach(m => {
      counts[m.tipo_movimiento] = (counts[m.tipo_movimiento] || 0) + 1
    })
    
    return NextResponse.json({
      total: data?.length || 0,
      breakdown: counts
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
