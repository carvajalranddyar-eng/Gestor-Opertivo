import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { loginPSM } from '@/lib/psm/auth'

export async function GET(req: NextRequest) {
  try {
    const token = await loginPSM()

    // Traer ODTs y consumos en paralelo
    const [resOdts, resConsumos] = await Promise.all([
      axios.get(
        `${process.env.PSM_BASE_URL}/informePiezas/tablaFiltradaOdt?ultimaPieza=false&page=0&pageSize=5000`,
        { headers: { Authorization: `Bearer ${token}` } }
      ),
      axios.get(
        `${process.env.PSM_BASE_URL}/consumos`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
    ])

    const todasOdts = resOdts.data.data || []
    const todosConsumos = resConsumos.data.consumos || []

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

    // Procesar cada ODT y detectar problemas
    const resultado = todasOdts
      .map((odt: any) => {
        const odtId = String(odt.codigoBarras || odt.numero)
        const consumos = consumosPorOdt.get(odtId) || []
        const tieneFotos = odt.foto !== null || (odt.fotosAdicionales && odt.fotosAdicionales.length > 0)
        const tieneConsumos = consumos.length > 0
        const cuadrillaOdt = String(odt.cuadrilla || '')

        // Detectar problemas
        const problemas: { tipo: string; descripcion: string; severidad: 'alta' | 'media' }[] = []

        // 1. Fotos sin consumos
        if (tieneFotos && !tieneConsumos) {
          problemas.push({
            tipo: 'sin_consumo',
            descripcion: 'Tiene fotos de instalación pero no tiene materiales registrados',
            severidad: 'alta'
          })
        }

        // 2. Consumos sin fotos
        if (!tieneFotos && tieneConsumos) {
          problemas.push({
            tipo: 'sin_fotos',
            descripcion: 'Tiene materiales registrados pero no tiene fotos de evidencia',
            severidad: 'alta'
          })
        }

        // 3. Material consumido no corresponde a la cuadrilla
        consumos.forEach((c: any) => {
          if (cuadrillaOdt && String(c.cuadrilla_codigo) !== cuadrillaOdt) {
            problemas.push({
              tipo: 'cuadrilla_incorrecta',
              descripcion: `Material registrado por cuadrilla ${c.cuadrilla_codigo} pero la ODT pertenece a cuadrilla ${cuadrillaOdt}`,
              severidad: 'alta'
            })
          }
        })

        // 4. Medidor duplicado
        const medidorConsumo = consumos.find((c: any) => c.producto_codigo === '072003015')
        if (medidorConsumo?.series) {
          const odtsConEsteMedidor = medidoresPorSerie.get(String(medidorConsumo.series)) || []
          if (odtsConEsteMedidor.length > 1) {
            problemas.push({
              tipo: 'medidor_duplicado',
              descripcion: `Medidor serie ${medidorConsumo.series} aparece en ${odtsConEsteMedidor.length} ODTs: ${odtsConEsteMedidor.join(', ')}`,
              severidad: 'alta'
            })
          }
        }

        // Determinar estado inicial
        let estadoInicial = 'pendiente'
        if (problemas.length > 0) estadoInicial = 'observacion'
        if (!tieneFotos && !tieneConsumos) return null // Sin actividad, ignorar

        return {
          odtId,
          pieza: odt,
          consumos,
          problemas,
          estadoInicial,
          tieneFotos,
          tieneConsumos,
          medidor_serie_sistema: medidorConsumo?.series || odt.medidor || null
        }
      })
      .filter(Boolean) // Eliminar las que no tienen actividad

    return NextResponse.json({ data: resultado, total: resultado.length })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
