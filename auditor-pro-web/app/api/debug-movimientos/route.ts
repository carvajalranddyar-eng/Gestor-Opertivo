import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Get a sample of movimientos to see the structure
    const { data, error } = await supabase
      .from('movimientos_obrador')
      .select('*')
      .limit(3)
    
    if (error) throw error
    
    return NextResponse.json({ sample: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
