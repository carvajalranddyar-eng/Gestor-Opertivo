import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Get sample consumos
    const { data: consumos } = await supabase
      .from('consumos')
      .select('odt_codigo')
      .limit(10)

    // Get sample odts
    const { data: odts } = await supabase
      .from('odts')
      .select('codigo_barras, numero')
      .limit(10)

    // Check if there's ANY match
    const firstConsumo = consumos?.[0]?.odt_codigo
    let matchCheck = null
    
    if (firstConsumo) {
      const { data: matched } = await supabase
        .from('odts')
        .select('codigo_barras, numero')
        .eq('codigo_barras', firstConsumo)
        .maybeSingle()
      matchCheck = matched
    }

    // Count total
    const { count: totalConsumos } = await supabase
      .from('consumos')
      .select('id', { count: 'exact' })

    const { count: totalOdts } = await supabase
      .from('odts')
      .select('id', { count: 'exact' })

    return NextResponse.json({
      ok: true,
      sampleConsumos: consumos,
      sampleOdts: odts,
      firstConsumoCode: firstConsumo,
      matchCheck,
      totals: { consumos: totalConsumos, odts: totalOdts }
    })

  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
