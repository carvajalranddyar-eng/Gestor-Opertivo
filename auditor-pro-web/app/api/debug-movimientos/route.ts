import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Count records in each table
    const { count: odts } = await supabase.from('odts').select('*', { count: 'exact', head: true })
    const { count: consumos } = await supabase.from('consumos').select('*', { count: 'exact', head: true })
    const { count: movimientos } = await supabase.from('movimientos_obrador').select('*', { count: 'exact', head: true })
    const { count: stock } = await supabase.from('stock_obrador').select('*', { count: 'exact', head: true })
    
    // Sample stock data
    const { data: stockSample } = await supabase.from('stock_obrador').select('*').limit(3)
    
    // Sample movimientos
    const { data: movimientosSample } = await supabase.from('movimientos_obrador').select('*').limit(3)
    
    return NextResponse.json({
      tables: {
        odts: odts || 0,
        consumos: consumos || 0,
        movimientos_obrador: movimientos || 0,
        stock_obrador: stock || 0
      },
      stockSample,
      movimientosSample
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
