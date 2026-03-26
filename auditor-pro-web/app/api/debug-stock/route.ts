import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Check if we can connect to Supabase at all
    const { data: version, error } = await supabase.rpc('version')
    
    // Try to list tables
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE')
    
    return NextResponse.json({
      supabaseConnected: !error,
      rpcError: error?.message || null,
      tables: tables?.map(t => t.table_name) || [],
      tablesError: tablesError?.message || null
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
