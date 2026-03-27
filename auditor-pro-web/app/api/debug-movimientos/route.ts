import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Get unique tipos
    const { data, error } = await supabase
      .from('movimientos_obrador')
      .select('tipo_movimiento')
      .limit(1000)
    
    if (error) throw error
    
    const tipos = [...new Set(data?.map(m => m.tipo_movimiento))]
    
    return NextResponse.json({ tipos, total: data?.length })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
