import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { loginPSM } from '@/lib/psm/auth'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const inicio = new Date()
  let odts_procesadas = 0
  let consumos_procesados = 0
  let errores = 0
  const detalle: string[] = []

  try {
    const token = await loginPSM()
    detalle.push('✅ Login PSM exitoso')

    const [resOdts, resConsumos] = await Promise.all([
      axios.get(
        `${process.env.PSM_BASE_URL}/informePiezas/tablaFiltradaOdt?ultimaPieza=false&page=0&pageSize=5000`,
        { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 }
      ),
      axios.get(
        `${process.env.PSM_BASE_URL}/consumos`,
        { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 }
      )
    ])

    const todasOdts = resOdts.data.data || []
    const todosConsumos = resConsumos.data.consumos || []
    detalle.push(`📋 ${todasOdts.length} ODTs traídas del PSM`)
    detalle.push(`📦 ${todosConsumos.length} consumos traídos del PSM`)

    // Indexar consumos por ODT
    const consumosPorOdt = new Map<string, any[]>()
    todosConsumos.forEach((c: any) => {
      const key = String(c.odt)
      if (!consumosPorOdt.has(key)) consumosPorOdt.set(key, [])
      consumosPorOdt.get(key)!.push(c)
    })

    // Detectar medidores duplicados
    const medidoresPorSerie = new Map<string, string[]>()
    todosConsumos.forEach((c: any) => {
      if (c.producto_codigo === '072003015' && c.series) {
        const key = String(c.series)
        if (!medidoresPorSerie.has(key)) medidoresPorSerie.set(key, [])
        medidoresPorSerie.get(key)!.push(String(c.odt))
      }
    })

    const S3_BASE = 'https://s3.amazonaws.com/ocrbsas-userfiles-mobilehub-94990329'

    for (const odt of todasOdts) {
      try {
        const odtId = String(odt.codigoBarras || odt.numero)
        const consumosOdt = consumosPorOdt.get(odtId) || []
        const medidorConsumo = consumosOdt.find((c: any) => c.producto_codigo === '072003015')
        const tieneFotos = odt.foto !== null || (odt.fotosAdicionales && odt.fotosAdicionales.length > 0)
        const tieneConsumos = consumosOdt.length > 0

        if (!tieneFotos && !tieneConsumos) continue

        // Guardar ODT
        const { error: errorOdt } = await supabase
          .from('odts')
          .upsert({
            codigo_barras: odtId,
            numero: String(odt.numero || ''),
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
            medidor_serie: medidorConsumo?.series || odt.medidor || null,
            actualizado_en: new Date().toISOString()
          }, { onConflict: 'codigo_barras' })

        if (errorOdt) { errores++; continue }

        // Guardar fotos
        const urlsFotos: string[] = []
        if (odt.foto) urlsFotos.push(odt.foto.startsWith('http') ? odt.foto : `${S3_BASE}/${odt.foto}`)
        odt.fotosAdicionales?.forEach((f: string) => {
          urlsFotos.push(f.startsWith('http') ? f : `${S3_BASE}/${f}`)
        })

        if (urlsFotos.length > 0) {
          await supabase.from('fotos').delete().eq('odt_codigo', odtId)
          await supabase.from('fotos').insert(
            urlsFotos.map(url => ({
              odt_codigo: odtId,
              url_s3: url,
              tipo_pieza: null,
              fecha_foto: odt.fechaIngreso || null
            }))
          )
        }

        // Detectar hallazgos
        const hallazgosNuevos: any[] = []

        if (tieneFotos && !tieneConsumos) {
          hallazgosNuevos.push({
            odt_codigo: odtId,
            tipo_hallazgo: 'sin_consumo',
            descripcion: 'Tiene fotos de instalación pero no tiene materiales registrados en el sistema',
            severidad: 'critica',
            fuente_1: 'PSM informe-piezas (foto presente)',
            fuente_2: 'PSM consumos (sin registros)',
            confirmado: true
          })
        }

        if (!tieneFotos && tieneConsumos) {
          hallazgosNuevos.push({
            odt_codigo: odtId,
            tipo_hallazgo: 'sin_fotos',
            descripcion: 'Tiene materiales registrados pero no tiene fotos de evidencia',
            severidad: 'alta',
            fuente_1: 'PSM consumos (registros presentes)',
            fuente_2: 'PSM informe-piezas (sin fotos)',
            confirmado: true
          })
        }

        if (medidorConsumo?.series) {
          const odtsConEsteMedidor = medidoresPorSerie.get(String(medidorConsumo.series)) || []
          if (odtsConEsteMedidor.length > 1) {
            hallazgosNuevos.push({
              odt_codigo: odtId,
              tipo_hallazgo: 'medidor_duplicado',
              descripcion: `Medidor serie ${medidorConsumo.series} aparece en ${odtsConEsteMedidor.length} ODTs: ${odtsConEsteMedidor.join(', ')}`,
              severidad: 'critica',
              fuente_1: 'PSM consumos (serie duplicada)',
              fuente_2: `ODTs afectadas: ${odtsConEsteMedidor.join(', ')}`,
              confirmado: true
            })
          }
        }

        consumosOdt.forEach((c: any) => {
          if (odt.cuadrilla && String(c.cuadrilla_codigo) !== String(odt.cuadrilla)) {
            hallazgosNuevos.push({
              odt_codigo: odtId,
              tipo_hallazgo: 'cuadrilla_incorrecta',
              descripcion: `Material registrado por cuadrilla ${c.cuadrilla_codigo} (${c.cuadrilla_descripcion}) pero la ODT pertenece a cuadrilla ${odt.cuadrilla} (${odt.desc_cuadrilla})`,
              severidad: 'alta',
              fuente_1: `PSM consumos (cuadrilla ${c.cuadrilla_codigo})`,
              fuente_2: `PSM informe-piezas (cuadrilla ${odt.cuadrilla})`,
              confirmado: true
            })
          }
        })

        if (hallazgosNuevos.length > 0) {
          await supabase.from('hallazgos').delete().eq('odt_codigo', odtId).eq('confirmado', true)
          await supabase.from('hallazgos').insert(hallazgosNuevos)
        }

        odts_procesadas++
      } catch (e) {
        errores++
      }
    }

    // Guardar consumos en batches
    if (todosConsumos.length > 0) {
      await supabase.from('consumos').delete().neq('id', 0)
      const batch = todosConsumos.map((c: any) => ({
        odt_codigo: String(c.odt),
        producto_codigo: c.producto_codigo || '',
        producto_descripcion: c.producto_descripcion || '',
        cantidad: c.cantidad || 0,
        series: c.series || null,
        cuadrilla_codigo: String(c.cuadrilla_codigo || ''),
        cuadrilla_descripcion: c.cuadrilla_descripcion || '',
        fecha_consumo: c.created_at || null
      }))

      for (let i = 0; i < batch.length; i += 500) {
        await supabase.from('consumos').insert(batch.slice(i, i + 500))
        consumos_procesados += Math.min(500, batch.length - i)
      }
    }

    detalle.push(`✅ ${odts_procesadas} ODTs procesadas`)
    detalle.push(`✅ ${consumos_procesados} consumos guardados`)
    detalle.push(`⚠️ ${errores} errores`)

    await supabase.from('sincronizaciones').insert({
      tipo: 'psm',
      inicio: inicio.toISOString(),
      fin: new Date().toISOString(),
      odts_procesadas,
      consumos_procesados,
      errores,
      estado: 'exitoso',
      detalle: { pasos: detalle }
    })

    return NextResponse.json({ ok: true, odts_procesadas, consumos_procesados, errores, detalle })

  } catch (error: any) {
    await supabase.from('sincronizaciones').insert({
      tipo: 'psm',
      inicio: inicio.toISOString(),
      fin: new Date().toISOString(),
      odts_procesadas,
      consumos_procesados,
      errores,
      estado: 'error',
      detalle: { error: error.message, pasos: detalle }
    })
    return NextResponse.json({ ok: false, error: error.message, detalle }, { status: 500 })
  }
}
