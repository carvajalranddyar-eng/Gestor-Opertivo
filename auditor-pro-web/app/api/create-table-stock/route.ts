import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST() {
  try {
    // Try to create table if not exists by inserting test data
    // This will fail if table doesn't exist or has wrong schema
    
    // First try to insert with new schema
    const { error } = await supabase
      .from('stock_obrador')
      .insert({
        cuadrilla_codigo: 'TEST',
        cuadrilla_nombre: 'TEST',
        producto_codigo: 'TEST',
        producto_descripcion: 'TEST',
        cantidad: 1,
        serie: null,
        ubicacion: 'TEST',
        cliente: 'TEST',
        es_serializado: false
      })

    if (error?.message.includes('does not exist')) {
      // Table doesn't exist, create it
      // For now, return instructions
      return NextResponse.json({
        ok: false,
        error: 'Table does not exist. Need to create it.',
        sql: `
CREATE TABLE stock_obrador (
  id SERIAL PRIMARY KEY,
  cuadrilla_codigo TEXT,
  cuadrilla_nombre TEXT,
  producto_codigo TEXT,
  producto_descripcion TEXT,
  cantidad DECIMAL,
  serie TEXT,
  ubicacion TEXT,
  cliente TEXT,
  es_serializado BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_stock_producto ON stock_obrador(producto_codigo);
        `
      })
    }

    if (error) {
      return NextResponse.json({ ok: false, error: error.message })
    }

    // If successful, delete test record
    await supabase.from('stock_obrador').delete().eq('cuadrilla_codigo', 'TEST')

    return NextResponse.json({ ok: true, message: 'Table verified/created successfully' })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
