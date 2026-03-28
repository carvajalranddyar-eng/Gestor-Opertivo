import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Try to get column names from stock_obrador
    const { data, error } = await supabase
      .from('stock_obrador')
      .select('*')
      .limit(1)
    
    return NextResponse.json({ 
      columns: data ? Object.keys(data[0] || {}) : [],
      sample: data,
      error: error?.message
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
