import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Try simple query
    const { data: settings, error } = await supabase
      .from('settings')
      .select('key, value')
      .limit(1)
    
    return NextResponse.json({
      test: 'settings query',
      data: settings,
      error: error?.message || null
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
