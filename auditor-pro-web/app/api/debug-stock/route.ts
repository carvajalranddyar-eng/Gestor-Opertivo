import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Get ALL data from stock_obrador to see what's there
    const { data, error } = await supabase
      .from('stock_obrador')
      .select('*')
      .limit(5)

    return NextResponse.json({
      count: data?.length || 0,
      error: error?.message || null,
      sample: data
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
