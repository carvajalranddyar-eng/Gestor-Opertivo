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

    // Get table schema
    const { data: schema, error: schemaError } = await supabase
      .rpc('get_table_columns', { table_name: 'stock_obrador' })
      .catch(() => ({ data: null, error: null }))

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
