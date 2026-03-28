import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Try to get column names from stock_obrador by inserting a test record
    const { data, error } = await supabase
      .from('stock_obrador')
      .insert({
        cuadrilla_codigo: 'TEST',
        producto_codigo: 'TEST',
        cantidad: 1
      })
      .select()
    
    return NextResponse.json({ 
      result: data,
      error: error?.message
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
