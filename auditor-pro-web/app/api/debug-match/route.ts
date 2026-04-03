import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Get ALL unique odt_codigo from consumos
    const { data: allConsumos } = await supabase
      .from('consumos')
      .select('odt_codigo')

    const uniqueConsumoCodes = new Set(allConsumos?.map(c => c.odt_codigo) || [])
    const uniqueCount = uniqueConsumoCodes.size
    
    // Get ALL unique codigo_barras from odts
    const { data: allOdts } = await supabase
      .from('odts')
      .select('codigo_barras')

    const uniqueOdtsCodes = new Set(allOdts?.map(o => o.codigo_barras) || [])
    
    // Find codes that exist in consumos but NOT in odts
    const codesInConsumosOnly: string[] = []
    uniqueConsumoCodes.forEach(code => {
      if (!uniqueOdtsCodes.has(code)) {
        codesInConsumosOnly.push(code)
      }
    })

    // Check numero field as well
    const { data: allOdtsWithNumero } = await supabase
      .from('odts')
      .select('codigo_barras, numero')

    const codesInNumero: string[] = []
    allOdtsWithNumero?.forEach(o => {
      if (uniqueConsumoCodes.has(o.numero)) {
        codesInNumero.push(o.numero)
      }
    })

    return NextResponse.json({
      ok: true,
      totalConsumoRecords: allConsumos?.length || 0,
      uniqueConsumoCodes: uniqueCount,
      uniqueOdtsCodes: uniqueOdtsCodes.size,
      codesInConsumosOnly: codesInConsumosOnly.slice(0, 20), // first 20
      codesInNumero: codesInNumero.slice(0, 20), // first 20
      sampleConsumoCodes: Array.from(uniqueConsumoCodes).slice(0, 30)
    })

  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
