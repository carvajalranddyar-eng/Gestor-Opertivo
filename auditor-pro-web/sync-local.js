// Script de sincronización local - ejecutar con: node sync-local.js
// Esto evita el timeout de Vercel

const axios = require('axios')
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://dffhvutwwqeumyikinkc.supabase.co'
const SUPABASE_KEY = 'sb_publishable_-7TkTn8iJfsFfo-4lfhMqA_XrW8ItnM'

// URL del PSM - cambiar por tu ngrok si es diferente
const PSM_URL = process.argv[2] || 'https://unsquashable-corruptly-colin.ngrok-free.dev'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function login() {
  console.log('🔗 Login PSM...')
  const res = await axios.post(PSM_URL + '/api/login', {
    nombreUsuario: 'rcarvajal@emaservicios.com.ar',
    password: '10003'
  }, {
    headers: { 
      'Content-Type': 'application/json', 
      'referer': PSM_URL + '/informe-piezas-odt',
      'ngrok-skip-browser-warning': 'true'
    }
  })
  return res.data.access_token || res.data.token
}

async function sync() {
  const inicio = Date.now()
  console.log('⏱️ Iniciando sincronización...')
  console.log('🔗 PSM URL:', PSM_URL)
  
  const token = await login()
  console.log('✅ Login OK')
  
  // Traer ODTs
  console.log('📋 Trayendo ODTs...')
  const todasOdts = []
  let page = 0
  let hasMore = true
  const PAGE_SIZE = 200
  
  while (hasMore && page < 50) {
    const t0 = Date.now()
    const res = await axios.get(
      `${PSM_URL}/api/informePiezas/tablaFiltradaOdt?ultimaPieza=false&page=${page}&pageSize=${PAGE_SIZE}`,
      { headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }, timeout: 180000 }
    )
    const odtsPage = res.data.data || []
    todasOdts.push(...odtsPage)
    console.log(`   Página ${page}: ${odtsPage.length} ODTs (${Date.now() - t0}ms)`)
    hasMore = odtsPage.length === PAGE_SIZE
    page++
  }
  console.log(`✅ ${todasOdts.length} ODTs en ${Date.now() - inicio}ms`)
  
  // Crear mapeo
  const numeroACodigoBarras = new Map()
  const numeroAOdtData = new Map()
  
  todasOdts.forEach(odt => {
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
  console.log(`🔗 Mapeo: ${numeroACodigoBarras.size} ODTs indexadas`)
  
  // Traer consumos
  console.log('📦 Trayendo consumos...')
  const t0 = Date.now()
  const resConsumos = await axios.get(`${PSM_URL}/api/consumos`, {
    headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }, timeout: 120000
  })
  const todosConsumosRaw = resConsumos.data.consumos || resConsumos.data || []
  console.log(`✅ ${todosConsumosRaw.length} consumos en ${Date.now() - t0}ms`)
  
  // Transformar consumos
  const consumosTransformados = []
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
  console.log(`✅ ${consumosTransformados.length} consumos transformados (${sinOdt} sin ODT)`)
  
  // Guardar ODTs
  console.log('💾 Guardando ODTs...')
  const t1 = Date.now()
  const odtsBatch = todasOdts.map(odt => ({
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
  
  for (let i = 0; i < odtsBatch.length; i += 200) {
    await supabase.from('odts').upsert(odtsBatch.slice(i, i + 200), { onConflict: 'codigo_barras' })
    console.log(`   ODTs: ${Math.min(i + 200, odtsBatch.length)}/${odtsBatch.length}`)
  }
  console.log(`✅ ${odtsBatch.length} ODTs guardadas en ${Date.now() - t1}ms`)
  
  // Guardar consumos
  console.log('💾 Guardando consumos...')
  const t2 = Date.now()
  await supabase.from('consumos').delete().neq('id', 0)
  console.log('   Consumos eliminados')
  
  for (let i = 0; i < consumosTransformados.length; i += 200) {
    await supabase.from('consumos').insert(consumosTransformados.slice(i, i + 200))
    console.log(`   Consumos: ${Math.min(i + 200, consumosTransformados.length)}/${consumosTransformados.length}`)
  }
  console.log(`✅ ${consumosTransformados.length} consumos guardados en ${Date.now() - t2}ms`)
  
  console.log(`\n✅ Sincronización completada en ${Date.now() - inicio}ms`)
  console.log(`   ODTs: ${odtsBatch.length}`)
  console.log(`   Consumos: ${consumosTransformados.length}`)
}

sync().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
