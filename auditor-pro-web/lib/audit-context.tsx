'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'

export interface Consumo {
  odt: string
  producto_codigo: string
  producto_descripcion: string
  cantidad: number
  cuadrilla_codigo: string
  cuadrilla_descripcion: string
  created_at: string
  series: string | null
  series_text: string | null
}

export interface ODTPieza {
  codigoBarras: string
  numero: string
  cliente: string
  direccionTitular: string
  nombreTitular: string
  localidad: string
  estado: string
  fechaIngreso: string
  fechaAsignacion: string | null
  cuadrilla: number | null
  desc_cuadrilla: string | null
  foto: string | null
  fotosAdicionales: string[]
  medidor: string | null
  tipoServicio: string
  materiales: any
}

export interface ResultadoAuditoria {
  odtId: string
  pieza: ODTPieza
  consumos: Consumo[]
  urlsFotos: string[]
  estado: 'conforme' | 'observacion' | 'no_conforme' | 'pendiente' | 'procesando'
  confianza: number | null
  medidor_serie_foto: string | null
  medidor_serie_sistema: string | null
  medidor_coincide: boolean | null
  caja_presente: boolean | null
  precinto_presente: boolean | null
  hallazgos: { tipo: 'ok' | 'warn' | 'error'; descripcion: string }[]
  requiere_humano: boolean
  motivo_humano: string | null
}

interface AuditContextType {
  odts: ResultadoAuditoria[]
  loading: boolean
  fechaSeleccionada: string
  busqueda: string
  filtroEstado: string
  filtroCuadrilla: string
  filtroProblemas: string
  setFechaSeleccionada: (v: string) => void
  setBusqueda: (v: string) => void
  setFiltroEstado: (v: string) => void
  setFiltroCuadrilla: (v: string) => void
  setFiltroProblemas: (v: string) => void
  odtsFiltradas: ResultadoAuditoria[]
  stats: {
    total: number
    conforme: number
    observacion: number
    no_conforme: number
    pendiente: number
    conErrores: number
    conAlertas: number
    sinProblemas: number
  }
  cuadrillas: string[]
  sincronizar: () => Promise<void>
  auditarODT: (odtId: string) => Promise<void>
  auditarTodas: () => Promise<void>
}

const S3_BASE = 'https://s3.amazonaws.com/ocrbsas-userfiles-mobilehub-94990329'

const AuditContext = createContext<AuditContextType | null>(null)

export function AuditProvider({ children }: { children: React.ReactNode }) {
  const [odts, setOdts] = useState<ResultadoAuditoria[]>([])
  const [loading, setLoading] = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const [fechaSeleccionada, setFechaSeleccionada] = useState(today)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroCuadrilla, setFiltroCuadrilla] = useState('')
  const [filtroProblemas, setFiltroProblemas] = useState('')

  const sincronizar = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (busqueda) params.set('busqueda', busqueda)

      const resOdts = await fetch(`/api/odts?${params}`)
      const dataOdts = await resOdts.json()
      const items = dataOdts.data || []

      const nuevasOdts: ResultadoAuditoria[] = items.map((item: any) => {
        const S3_BASE = 'https://s3.amazonaws.com/ocrbsas-userfiles-mobilehub-94990329'
        const urlsFotos: string[] = []
        if (item.pieza.foto) {
          urlsFotos.push(item.pieza.foto.startsWith('http') ? item.pieza.foto : `${S3_BASE}/${item.pieza.foto}`)
        }
        item.pieza.fotosAdicionales?.forEach((f: string) => {
          urlsFotos.push(f.startsWith('http') ? f : `${S3_BASE}/${f}`)
        })

        // Convertir problemas detectados en hallazgos
        const hallazgos = item.problemas.map((p: any) => ({
          tipo: p.severidad === 'alta' ? 'error' : 'warn',
          descripcion: p.descripcion
        }))

        return {
          odtId: item.odtId,
          pieza: item.pieza,
          consumos: item.consumos,
          urlsFotos,
          estado: item.estadoInicial as any,
          confianza: null,
          medidor_serie_foto: null,
          medidor_serie_sistema: item.medidor_serie_sistema,
          medidor_coincide: null,
          caja_presente: null,
          precinto_presente: null,
          hallazgos,
          requiere_humano: item.problemas.length > 0,
          motivo_humano: item.problemas.length > 0
            ? item.problemas.map((p: any) => p.tipo).join(', ')
            : null
        }
      })

      setOdts(nuevasOdts)
    } catch (error) {
      console.error('Error sincronizando:', error)
    } finally {
      setLoading(false)
    }
  }, [busqueda])

  const auditarODT = useCallback(async (odtId: string) => {
    setOdts(prev => prev.map(o =>
      o.odtId === odtId ? { ...o, estado: 'procesando' } : o
    ))

    try {
      const odt = odts.find(o => o.odtId === odtId)
      if (!odt) throw new Error('ODT no encontrada')

      const resIA = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          odtId,
          urlsFotos: odt.urlsFotos,
          consumos: odt.consumos
        })
      })

      const resultado = await resIA.json()

      setOdts(prev => prev.map(o =>
        o.odtId === odtId
          ? { ...o, ...resultado, estado: resultado.estado || 'observacion' }
          : o
      ))
    } catch (error) {
      console.error(`Error auditando ${odtId}:`, error)
      setOdts(prev => prev.map(o =>
        o.odtId === odtId ? {
          ...o,
          estado: 'observacion',
          hallazgos: [{ tipo: 'error', descripcion: 'Error al procesar' }],
          requiere_humano: true,
          motivo_humano: 'Error técnico'
        } : o
      ))
    }
  }, [odts])

  const auditarTodas = useCallback(async () => {
    const pendientes = odts.filter(o => o.estado === 'pendiente')
    for (const odt of pendientes) {
      await auditarODT(odt.odtId)
      await new Promise(r => setTimeout(r, 500))
    }
  }, [odts, auditarODT])

  const odtsFiltradas = React.useMemo(() => 
    odts.filter(o => {
      if (filtroEstado && o.estado !== filtroEstado) return false
      if (filtroCuadrilla && String(o.pieza.cuadrilla) !== filtroCuadrilla) return false
      if (busqueda && 
          !o.odtId.includes(busqueda) && 
          !o.pieza.nombreTitular?.toLowerCase().includes(busqueda.toLowerCase()) &&
          !o.pieza.direccionTitular?.toLowerCase().includes(busqueda.toLowerCase())
      ) return false
      
      // Filtro por problemas
      if (filtroProblemas) {
        const tieneErrores = o.hallazgos.some(h => h.tipo === 'error')
        const tieneAlertas = o.hallazgos.some(h => h.tipo === 'warn')
        const sinProblemas = o.hallazgos.length === 0
        
        if (filtroProblemas === 'errores' && !tieneErrores) return false
        if (filtroProblemas === 'alertas' && !tieneAlertas) return false
        if (filtroProblemas === 'sin-problemas' && !sinProblemas) return false
      }
      
      return true
    }), [odts, filtroEstado, filtroCuadrilla, busqueda, filtroProblemas])

  const stats = {
    total: odts.length,
    conforme: odts.filter(o => o.estado === 'conforme').length,
    observacion: odts.filter(o => o.estado === 'observacion').length,
    no_conforme: odts.filter(o => o.estado === 'no_conforme').length,
    pendiente: odts.filter(o =>
      o.estado === 'pendiente' || o.estado === 'procesando'
    ).length,
    conErrores: odts.filter(o => o.hallazgos.some(h => h.tipo === 'error')).length,
    conAlertas: odts.filter(o => o.hallazgos.some(h => h.tipo === 'warn')).length,
    sinProblemas: odts.filter(o => o.hallazgos.length === 0).length,
  }

  const cuadrillas = [...new Set(
    odts.map(o => String(o.pieza.cuadrilla)).filter(Boolean)
  )].sort()

  return (
    <AuditContext.Provider value={{
      odts, loading,
      fechaSeleccionada, busqueda, filtroEstado, filtroCuadrilla, filtroProblemas,
      setFechaSeleccionada, setBusqueda, setFiltroEstado, setFiltroCuadrilla, setFiltroProblemas,
      odtsFiltradas, stats, cuadrillas,
      sincronizar, auditarODT, auditarTodas
    }}>
      {children}
    </AuditContext.Provider>
  )
}

export function useAudit() {
  const ctx = useContext(AuditContext)
  if (!ctx) throw new Error('useAudit debe usarse dentro de AuditProvider')
  return ctx
}
