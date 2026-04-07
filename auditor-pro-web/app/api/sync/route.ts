import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { supabase } from '@/lib/supabase'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  console.log('[SYNC] Starting sync...')
  const inicio = Date.now()
  let odtsGuardadas = 0
  let consumosGuardados = 0
  const detalle: string[] = []

  try {
    let body: { psmUrl?: string } = {}
    try {
      body = await req.json()
    } catch (e) {}
    
    const baseUrl = body?.psmUrl || 'https://psm.emaservicios.com.ar'
    detalle.push(`🔗 PSM: ${baseUrl}`)
    
    // Login
    const loginRes = await fetch(baseUrl + '/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'referer': baseUrl + '/informe-piezas-odt' },
      body: JSON.stringify({ nombreUsuario: 'rcarvajal@emaservicios.com.ar', password: '10003' })
    })
    
    if (!loginRes.ok) throw new Error(`Login falló: ${loginRes.status}`)
    
    const loginData = await loginRes.json()
    const token = loginData.access_token || loginData.token
    if (!token) throw new Error('No se obtuvo token')
    
    detalle.push('✅ Login OK')
    detalle.push(`⏱️ Tiempo: ${Date.now() - inicio}ms`)

    // Traer ODTs - usar pageSize más grande para menos requests
    const todasOdts: any[] = []
    let page = 0
    let hasMore = true
    const MAX_PAGES = 25
    const PAGE_SIZE = 500
    
    while (hasMore && page < MAX_PAGES) {
      const t0 = Date.now()
      const resOdts = await axios.get(
        `${baseUrl}/api/informePiezas/tablaFiltradaOdt?ultimaPieza=false&page=${page}&pageSize=${PAGE_SIZE}`,
        { headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }, timeout: 60000 }
      )
      
      const odtsPage = resOdts.data.data || []
      todasOdts.push(...odtsPage)
      detalle.push(`📋 Página ${page}: ${odtsPage.length} ODTs (${Date.now() - t0}ms)`)
      
      hasMore = odtsPage.length === PAGE_SIZE
      page++
    }

    detalle.push(`📋 Total ODTs: ${todasOdts.length}`)
    detalle.push(`⏱️ Tiempo: ${Date.now() - inicio}ms`)

    // Crear mapeo numero -> codigoBarras
    const numeroACodigoBarras = new Map<string, string>()
    const numeroAOdtData = new Map<string, any>()
    
    todasOdts.forEach((odt: any) => {
      const codigoBarras = String(odt.codigoBarras || '')
      const numero = String(odt.numero || '')
      
      if (numero) {
        numeroACodigoBarras.set(numero, codigoBarras)
        numeroAOdtData.set(numero, odt)
      }
      if (codigoBarras && codigoBarras !== numero) {
        numeroACodigoBarras.set(codigoBarras, codigoBarras)
        numeroAOdtData.set(codigoBarras, odt)
      }
    })
    
    detalle.push(`🔗 Mapeo: ${numeroACodigoBarras.size} ODTs indexadas`)

    // Traer consumos
    const t0 = Date.now()
    const resConsumos = await axios.get(`${baseUrl}/api/consumos`, {
      headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }, 
      timeout: 120000 
    })

    const todosConsumosRaw = resConsumos.data.consumos || resConsumos.data || []
    detalle.push(`📦 Consumos: ${todosConsumosRaw.length} (${Date.now() - t0}ms)`)
    detalle.push(`⏱️ Tiempo: ${Date.now() - inicio}ms`)

    // Transformar consumos: reemplazar numero con codigoBarras
    const consumosTransformados: any[] = []
    let sinOdt = 0
    
    for (const c of todosConsumosRaw) {
      const codigoBarras = numeroACodigoBarras.get(String(c.odt))
      
      if (codigoBarras) {
        consumosTransformados.push({
          odt_codigo: codigoBarras,
          producto_codigo: c.producto_codigo || '',
          producto_descripcion: c.producto_descripcion || '',
          cantidad: c.cantidad || 0,
          series: c.series || null,
          cuadrilla_codigo: String(c.cuadrilla_codigo || ''),
          cuadrilla_descripcion: c.cuadrilla_descripcion || '',
          fecha_consumo: c.created_at || null
        })
      } else {
        sinOdt++
      }
    }
    
    if (sinOdt > 0) detalle.push(`⚠️ ${sinOdt} consumos sin ODT`)
    detalle.push(`✅ ${consumosTransformados.length} consumos transformados`)

    // Guardar ODTs en batch
    const t1 = Date.now()
    const odtsBatch = todasOdts.map((odt: any) => ({
      codigo_barras: String(odt.codigoBarras || odt.numero || ''),
      numero: String(odt.numero || odt.codigoBarras || ''),
      cliente: odt.cliente || '',
      direccion: odt.direccionTitular || '',
      titular: odt.nombreTitular || '',
      localidad: odt.localidad || '',
      estado: odt.estado || '',
      tipo_servicio: odt.tipoServicio || '',
      cuadrilla_id: String(odt.cuadrilla || ''),
      cuadrilla_nombre: odt.desc_cuadrilla || '',
      fecha_ingreso: odt.fechaIngreso || '',
      fecha_asignacion: odt.fechaAsignacion || '',
      medidor_serie: odt.medidor || null,
      foto: odt.foto || null,
      fotos_adicionales: JSON.stringify(odt.fotosAdicionales || []),
      actualizado_en: new Date().toISOString()
    }))
    
    // Guardar ODTs en batches de 200
    for (let i = 0; i < odtsBatch.length; i += 200) {
      await supabase.from('odts').upsert(odtsBatch.slice(i, i + 200), { onConflict: 'codigo_barras' })
      odtsGuardadas += Math.min(200, odtsBatch.length - i)
    }
    
    detalle.push(`✅ ${odtsGuardadas} ODTs guardadas (${Date.now() - t1}ms)`)
    detalle.push(`⏱️ Tiempo: ${Date.now() - inicio}ms`)

    // Guardar consumos - eliminar primero para evitar duplicados
    const t2 = Date.now()
    await supabase.from('consumos').delete().neq('id', 0)
    
    for (let i = 0; i < consumosTransformados.length; i += 200) {
      await supabase.from('consumos').insert(consumosTransformados.slice(i, i + 200))
      consumosGuardados += Math.min(200, consumosTransformados.length - i)
    }
    
    detalle.push(`✅ ${consumosGuardados} consumos guardados (${Date.now() - t2}ms)`)
    detalle.push(`⏱️ Tiempo total: ${Date.now() - inicio}ms`)
    console.log('[SYNC] Completed:', detalle)

    return NextResponse.json({ 
      ok: true, 
      odts: odtsGuardadas, 
      consumos: consumosGuardados, 
      tiempo: Date.now() - inicio,
      detalle 
    })

  } catch (error: any) {
    detalle.push(`❌ Error: ${error.message}`)
    detalle.push(`⏱️ Tiempo: ${Date.now() - inicio}ms`)
    
    return NextResponse.json({ 
      ok: false, 
      error: error.message, 
      odts_procesadas: odtsGuardadas,
      consumos_procesados: consumosGuardados,
      tiempo: Date.now() - inicio,
      detalle 
    }, { status: 500 })
  }
}
