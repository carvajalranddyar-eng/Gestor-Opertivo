import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Get sample data to see column names
    const { data, error } = await supabase
      .from('stock_obrador')
      .select('*')
      .limit(1)

    if (error) throw error

    // Get table schema (may fail if function doesn't exist)
    let schema = null
    let schemaError = null
    try {
      const result = await supabase.rpc('get_table_columns', { table_name: 'stock_obrador' })
      schema = result.data
      schemaError = result.error
    } catch (e) {
      schemaError = e
    }

    return NextResponse.json({
      columns: data && data.length > 0 ? Object.keys(data[0]) : [],
      sample: data,
      schema,
      error
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
