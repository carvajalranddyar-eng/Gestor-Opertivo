import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Get ALL unique odt_codigo from consumos in batches
    const allConsumoCodes = new Set<string>()
    let offset = 0
    const batchSize = 1000
    
    while (true) {
      const { data: batch } = await supabase
        .from('consumos')
        .select('odt_codigo')
        .range(offset, offset + batchSize - 1)
      
      if (!batch || batch.length === 0) break
      
      batch.forEach(c => {
        if (c.odt_codigo) allConsumoCodes.add(c.odt_codigo)
      })
      
      if (batch.length < batchSize) break
      offset += batchSize
    }

    const uniqueCount = allConsumoCodes.size
    
    // Get ALL unique codigo_barras from odts in batches
    const allOdtsCodes = new Set<string>()
    offset = 0
    
    while (true) {
      const { data: batch } = await supabase
        .from('odts')
        .select('codigo_barras')
        .range(offset, offset + batchSize - 1)
      
      if (!batch || batch.length === 0) break
      
      batch.forEach(o => {
        if (o.codigo_barras) allOdtsCodes.add(o.codigo_barras)
      })
      
      if (batch.length < batchSize) break
      offset += batchSize
    }

    // Find codes that exist in both
    const matchingCodes: string[] = []
    allConsumoCodes.forEach(code => {
      if (allOdtsCodes.has(code)) {
        matchingCodes.push(code)
      }
    })

    return NextResponse.json({
      ok: true,
      uniqueConsumoCodes: uniqueCount,
      uniqueOdtsCodes: allOdtsCodes.size,
      matchingCodesCount: matchingCodes.length,
      matchingCodesSample: matchingCodes.slice(0, 20)
    })

  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
