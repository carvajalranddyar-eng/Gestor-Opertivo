'use client'

import React, { useState, useEffect } from 'react'
import { useAudit } from '@/lib/audit-context'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { RefreshCw, Play, ChevronRight, Search, CheckCircle, XCircle, Clock, X, Wifi, WifiOff, Settings, TrendingDown } from 'lucide-react'

interface ProxyStatus {
  connected: boolean
  proxyControlUrl: string | null
  psmUrl: string | null
  psmRunning: boolean
  psmConnected: boolean
  message: string
}

type Estado = 'conforme' | 'observacion' | 'no_conforme' | 'pendiente' | 'procesando'

function EstadoBadge({ estado }: { estado: Estado }) {
  const map = {
    conforme: { label: 'Conforme', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    observacion: { label: 'Observación', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    no_conforme: { label: 'No conforme', color: 'bg-rose-100 text-rose-700 border-rose-200' },
    pendiente: { label: 'Pendiente', color: 'bg-slate-100 text-slate-600 border-slate-200' },
    procesando: { label: 'Analizando...', color: 'bg-blue-100 text-blue-600 border-blue-200 animate-pulse' },
  }
  const e = map[estado] || map.pendiente
  return <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${e.color}`}>{e.label}</span>
}

function DetalleODT({ odt, detailData, loadingDetail, onClose, onBuscar }: { odt: any; detailData: any; loadingDetail: boolean; onClose: () => void; onBuscar?: (odt: string) => void }) {
  const [copied, setCopied] = useState<string | null>(null)

  const copiar = (texto: string, tipo: string) => {
    navigator.clipboard.writeText(texto)
    setCopied(tipo)
    setTimeout(() => setCopied(null), 1500)
  }

  const consumos = detailData?.consumos || []
  const verificacion = detailData?.verificacion
  const analisis = detailData?.analisis || {}
  const estado = verificacion?.estado_auditoria || 'pendiente'
  
  // Semáforo
  const semaforo = (analisis?.estadoSemaforo || 'sin_datos') as 'verde' | 'amarillo' | 'rojo' | 'sin_datos'
  const semaforoColors: Record<string, string> = {
    verde: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    amarillo: 'bg-amber-100 text-amber-700 border-amber-200',
    rojo: 'bg-rose-100 text-rose-700 border-rose-200',
    sin_datos: 'bg-slate-100 text-slate-600 border-slate-200'
  }

  return (
    <>
    <style jsx global>{`
      @keyframes slideIn {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }
      .animate-slide-in {
        animation: slideIn 0.3s ease-out forwards;
      }
    `}</style>
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-end">
      <div
        className="modal-panel bg-white w-full max-w-2xl h-full shadow-2xl overflow-hidden flex flex-col animate-slide-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-shrink-0 bg-slate-800 px-3 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => copiar(odt.odtId, 'odt')}
              className="font-bold text-white text-lg font-mono hover:text-blue-300 transition-colors flex items-center gap-1"
              title="Click para copiar"
            >
              {odt.odtId}
              {copied === 'odt' ? <span className="text-green-400 text-xs">✓</span> : <span className="text-slate-500 text-[10px]">📋</span>}
            </button>
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${semaforoColors[semaforo]}`}>
              {semaforo === 'verde' ? '✅ Completa' : semaforo === 'amarillo' ? '⚠️ Básico' : semaforo === 'rojo' ? '❌ Incompleta' : 'Sin análisis'}
            </span>
          </div>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-700 text-slate-300">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
          {/* Observaciones del semáforo */}
          {analisis?.observaciones && (
            <div className={`p-3 rounded-lg border text-sm ${
              semaforo === 'rojo' ? 'bg-rose-50 border-rose-300 text-rose-800' :
              semaforo === 'amarillo' ? 'bg-amber-50 border-amber-300 text-amber-800' :
              'bg-emerald-50 border-emerald-300 text-emerald-800'
            }`}>
              {analisis.observaciones}
            </div>
          )}

          {/* Serie validation */}
          {analisis?.seriePSM && (
            <div className={`p-3 rounded-lg border text-sm ${
              analisis.serieValida === 'OK' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' :
              'bg-rose-50 border-rose-300 text-rose-800'
            }`}>
              Serie medidor: <strong>{analisis.seriePSM}</strong> - {
                analisis.serieValida === 'OK' ? '✅ Autorizada' : '❌ NO AUTORIZADA'
              }
            </div>
          )}

          {/* Info básica */}
          <div className="flex items-center gap-2">
            <div className="bg-white rounded px-3 py-2 border border-slate-200 flex-1">
              <span className="text-slate-400 text-[10px] uppercase font-semibold">Cuadrilla</span>
              <div className="font-medium text-slate-800 text-sm truncate">{odt.cuadrilla || '—'}</div>
            </div>
            <div className="bg-white rounded px-3 py-2 border border-slate-200 w-24">
              <span className="text-slate-400 text-[10px] uppercase font-semibold">Estado</span>
              <div className="font-medium text-slate-800 text-sm">{odt.estado || '—'}</div>
            </div>
          </div>

          {/* Panel PSM vs Obrador */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-xs font-bold text-blue-700 uppercase mb-2">📋 PSM (Declarado)</div>
              <div className="text-xs text-blue-600 space-y-1">
                <div>Estado: {odt.estado}</div>
                <div>Medidor serie: {odt.medidor || '—'}</div>
                <div>Fecha ingreso: {detailData?.odt?.fecha_ingreso || '—'}</div>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="text-xs font-bold text-amber-700 uppercase mb-2">🏭 OBRADOR (Físico)</div>
              <div className="text-xs text-amber-600 space-y-1">
                <div>Materiales: {consumos.length}</div>
                <div>Con serie: {analisis?.seriesConsumo?.length || 0}</div>
                <div>Stock entrega: {analisis?.stockEntregado?.length || 0}</div>
              </div>
            </div>
          </div>

          {/* Checklist de básicos */}
          <div className="bg-white border border-slate-200 rounded-lg p-3">
            <div className="text-xs font-semibold text-slate-600 uppercase mb-2">Verificación básica</div>
            <div className="flex gap-4 text-xs">
              {(() => {
                const counts = analisis?.countByCategory || {}
                const tieneCaja = (counts.caja || 0) > 0
                const tienePrecinto = (counts.precinto || 0) > 0
                const tieneMedidor = (counts.medidor || 0) > 0
                return (
                  <>
                    <span className={tieneCaja ? 'text-emerald-600' : 'text-rose-600'}>
                      {tieneCaja ? '✅' : '❌'} Caja
                    </span>
                    <span className={tienePrecinto ? 'text-emerald-600' : 'text-rose-600'}>
                      {tienePrecinto ? '✅' : '❌'} Precinto
                    </span>
                    <span className={tieneMedidor ? 'text-emerald-600' : 'text-rose-600'}>
                      {tieneMedidor ? '✅' : '❌'} Medidor
                    </span>
                  </>
                )
              })()}
            </div>
          </div>

          {loadingDetail ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw size={24} className="animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="text-xs font-semibold text-slate-600 uppercase px-3 py-2 bg-slate-100 border-b border-slate-200">
                Materiales consumidos ({consumos.length})
              </div>
              <div>
                {consumos.length === 0 ? (
                  <div className="text-sm text-slate-400 text-center py-3">Sin consumos</div>
                ) : (
                  consumos.map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-slate-500 font-mono shrink-0">{c.producto_codigo}</span>
                        <span className="text-slate-800 truncate">{c.producto_descripcion}</span>
                        {c.series && c.series !== 'N/A' && (
                          <button 
                            onClick={() => copiar(c.series || '', 'serie')}
                            className="text-blue-600 font-mono font-semibold hover:text-blue-800 shrink-0"
                            title="Click para copiar"
                          >
                            {c.series}
                          </button>
                        )}
                      </div>
                      <span className="font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] shrink-0 ml-2">×{c.cantidad}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {verificacion && (
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <span className="text-slate-400 text-[10px] uppercase font-semibold">Resultado Auditoría</span>
              <div className="text-sm text-slate-700 mt-1">
                {verificacion.materiales_ok}/{verificacion.total_materiales} materiales OK
              </div>
              {verificacion.notas_finales && (
                <div className="text-xs text-slate-500 mt-2 bg-slate-50 p-2 rounded">
                  {verificacion.notas_finales}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  )
}

export default function HomePage() {
  const {
    stockObrador, hallazgosObrador, stockPorCuadrilla
  } = useAudit()

  const [odtSeleccionada, setOdtSeleccionada] = useState<any | null>(null)
  const [busquedaLocal, setBusquedaLocal] = useState('')
  const [proxyStatus, setProxyStatus] = useState<ProxyStatus | null>(null)
  const [proxyLoading, setProxyLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [proxyUrlInput, setProxyUrlInput] = useState('')
  const [psmUrlInput, setPsmUrlInput] = useState('https://psm.emaservicios.com.ar')
  const [psmConnected, setPsmConnected] = useState(false)
  const [statsDB, setStatsDB] = useState<{consumos: number, movimientos: number, odts: number, verificaciones: number}>({
    consumos: 0, movimientos: 0, odts: 0, verificaciones: 0
  })

  // Optimized pagination state
  const [odtsOptimized, setOdtsOptimized] = useState<any[]>([])
  const [selectedOdts, setSelectedOdts] = useState<Set<string>>(new Set())
  const [loadingOptimized, setLoadingOptimized] = useState(false)
  const [page, setPage] = useState(0)
  const [totalOdts, setTotalOdts] = useState(0)
  const [statsApi, setStatsApi] = useState<{conMateriales: number, sinMateriales: number, rojo: number, amarillo: number, verde: number, naranja: number}>({ conMateriales: 0, sinMateriales: 0, rojo: 0, amarillo: 0, verde: 0, naranja: 0 })
  const [tieneMas, setTieneMas] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailData, setDetailData] = useState<any>(null)
  const [showClassifyModal, setShowClassifyModal] = useState(false)
  const [clasificando, setClasificando] = useState(false)
  const [cuadrillasList, setCuadrillasList] = useState<string[]>([]) // Lista de cuadrillas dinámica

  // Filters for optimized API
  const [filtroMateriales, setFiltroMateriales] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('') // Estado de auditoría
  const [filtroCuadrilla, setFiltroCuadrilla] = useState('')
  const [filtroPSM, setFiltroPSM] = useState('') // Estado PSM (R11, R20, etc)

  // Live refresh state
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return
    
    const interval = setInterval(() => {
      loadOdtsOptimized(true)
      setLastUpdate(new Date())
    }, 30000) // 30 seconds
    
    return () => clearInterval(interval)
  }, [autoRefresh, filtroMateriales, filtroEstado, filtroCuadrilla, filtroPSM, busquedaLocal])

  // Manual refresh handler
  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    await loadOdtsOptimized(true)
    setLastUpdate(new Date())
    setIsRefreshing(false)
  }

  // Load ODTs with pagination
  const loadOdtsOptimized = async (resetPage = false) => {
    const currentPage = resetPage ? 0 : page
    setLoadingOptimized(true)
    try {
      const params = new URLSearchParams()
      params.set('page', currentPage.toString())
      params.set('limit', '50')
      if (busquedaLocal) params.set('search', busquedaLocal)
      if (filtroMateriales) params.set('filtro', filtroMateriales)
      if (filtroEstado) params.set('estado', filtroEstado)
      if (filtroCuadrilla) params.set('cuadrilla', filtroCuadrilla)
      if (filtroPSM) params.set('psm_estado', filtroPSM)

      const res = await fetch(`/api/odts-optimized?${params.toString()}`)
      const data = await res.json()
      
        if (data.ok) {
        if (resetPage) {
          setOdtsOptimized(data.odts || [])
        } else {
          setOdtsOptimized(prev => [...prev, ...(data.odts || [])])
        }
        setTotalOdts(data.total || 0)
        setTieneMas(data.tieneMas || false)
        setPage(currentPage + 1)
        if (data.stats) {
          setStatsApi(data.stats)
        }
      }
    } catch (e) {
      console.error('Error loading ODTs:', e)
    } finally {
      setLoadingOptimized(false)
    }
  }

  // Load on-demand detail
  const loadOdtsDetail = async (odtId: string) => {
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/odt-detail/${encodeURIComponent(odtId)}`)
      const data = await res.json()
      if (data.ok) {
        setDetailData(data)
      }
    } catch (e) {
      console.error('Error loading detail:', e)
    } finally {
      setLoadingDetail(false)
    }
  }

  // Initial load
  useEffect(() => {
    loadOdtsOptimized(true)
  }, [filtroMateriales, filtroEstado, filtroCuadrilla, filtroPSM])

  // Cargar lista de cuadrillas
  useEffect(() => {
    const fetchCuadrillas = async () => {
      try {
        const res = await fetch('/api/odts-optimized', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getCuadrillas' })
        })
        const data = await res.json()
        if (data.ok && data.cuadrillas) {
          setCuadrillasList(data.cuadrillas.sort())
        }
      } catch (e) {
        console.error('Error loading cuadrillas:', e)
      }
    }
    fetchCuadrillas()
  }, [])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadOdtsOptimized(true)
    }, 300)
    return () => clearTimeout(timer)
  }, [busquedaLocal])

  // Cargar status del proxy cada 10 segundos
  useEffect(() => {
    const checkProxyStatus = async () => {
      try {
        const res = await fetch('/api/proxy')
        const data = await res.json()
        setProxyStatus(data)
      } catch (err) {
        setProxyStatus(null)
      }
    }
    checkProxyStatus()
    const interval = setInterval(checkProxyStatus, 10000)
    return () => clearInterval(interval)
  }, [])

  // Cargar settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings')
        const data = await res.json()
        if (data.proxy_control_url) {
          setProxyUrlInput(data.proxy_control_url)
        }
        if (data.psm_url) {
          setPsmUrlInput(data.psm_url)
          setPsmConnected(true)
        }
      } catch (err) {
        console.error('Error cargando settings:', err)
      }
    }
    loadSettings()
  }, [])

  // Cargar stats de la base de datos al inicio
  const loadStatsDB = async () => {
    try {
      const [{ count: conCount }, { count: movCount }, { count: odtCount }, { count: verifCount }] = await Promise.all([
        supabase.from('consumos').select('id', { count: 'exact' }),
        supabase.from('movimientos_obrador').select('id', { count: 'exact' }),
        supabase.from('odts').select('id', { count: 'exact' }),
        supabase.from('verificaciones_odt').select('id', { count: 'exact' })
      ])
      
      setStatsDB({
        consumos: conCount || 0,
        movimientos: movCount || 0,
        odts: odtCount || 0,
        verificaciones: verifCount || 0
      })
    } catch (e) {
      console.log('Error cargando stats:', e)
    }
  }

  // Llamar loadStatsDB al iniciar
  useEffect(() => {
    loadStatsDB()
  }, [])

  const saveProxyUrl = async () => {
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          proxy_control_url: proxyUrlInput,
          psm_url: psmUrlInput
        })
      })
      setShowSettings(false)
      if (psmUrlInput) {
        setPsmConnected(true)
      }
      // Verificar status
      const res = await fetch('/api/proxy')
      const data = await res.json()
      setProxyStatus(data)
    } catch (err) {
      console.error('Error guardando settings:', err)
    }
  }

  const handleStartProxy = async () => {
    setProxyLoading(true)
    try {
      const res = await fetch('/api/proxy?action=start', { method: 'POST' })
      const data = await res.json()
      if (!data.success) {
        alert('Error: ' + (data.error || 'Unknown error'))
      }
      // Actualizar status
      setTimeout(async () => {
        const res = await fetch('/api/proxy')
        const data = await res.json()
        setProxyStatus(data)
      }, 3000)
    } finally {
      setProxyLoading(false)
    }
  }

  const handleStopProxy = async () => {
    setProxyLoading(true)
    try {
      await fetch('/api/proxy?action=stop', { method: 'POST' })
      setTimeout(async () => {
        const res = await fetch('/api/proxy')
        const data = await res.json()
        setProxyStatus(data)
      }, 2000)
    } finally {
      setProxyLoading(false)
    }
  }

  const handleAuditar = async (odtId: string) => {
    if (!confirm(`¿Auditar ODT ${odtId}?`)) return
    
    try {
      const res = await fetch('/api/auditar-odt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ odt_codigo: odtId })
      })
      const text = await res.text()
      let data
      try {
        data = JSON.parse(text)
      } catch (e) {
        alert('Error: ' + text.substring(0, 200))
        return
      }
      
      if (data.ok) {
        alert(data.message)
        await loadOdtsOptimized(true)
      } else {
        alert('Error: ' + (data.error || 'Error desconocido'))
      }
    } catch (err: any) {
      console.error('Error auditando:', err)
      alert('Error al auditar: ' + (err.message || err))
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-lg font-bold text-slate-800">AUDITOR PRO</h1>
              <p className="text-xs text-slate-400">Control de ODTs y Auditoría Integral</p>
            </div>
            {/* Stats de base de datos */}
            <div className="flex items-center gap-3 ml-4 px-3 py-1 bg-slate-100 rounded-lg text-[10px]">
              <span className="text-slate-500">DB:</span>
              <span className="text-blue-600 font-medium">{statsDB.consumos.toLocaleString()} consumos</span>
              <span className="text-slate-300">|</span>
              <span className="text-emerald-600 font-medium">{statsDB.movimientos.toLocaleString()} movs</span>
              <span className="text-slate-300">|</span>
              <span className="text-amber-600 font-medium">{statsDB.odts.toLocaleString()} odts</span>
              <span className="text-slate-300">|</span>
              <span className="text-purple-600 font-medium">{statsDB.verificaciones.toLocaleString()} auditadas</span>
            </div>
          </div>
          
          {/* Dashboard KPIs en tiempo real */}
          <div className="flex items-center gap-2 mr-4">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-slate-100">
              <span className="text-slate-500 font-medium">Semáforo:</span>
              <span className="text-emerald-600 font-bold">{statsApi.verde}</span>
              <span className="text-slate-300">|</span>
              <span className="text-amber-600 font-bold">{statsApi.amarillo}</span>
              <span className="text-slate-300">|</span>
              <span className="text-orange-600 font-bold">{statsApi.naranja}</span>
              <span className="text-slate-300">|</span>
              <span className="text-rose-600 font-bold">{statsApi.rojo}</span>
            </div>
          </div>
          
          {/* Estado del Proxy */}
          <div className="flex items-center gap-2 mr-4">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
              psmConnected 
                ? 'bg-emerald-100 text-emerald-700' 
                : proxyStatus?.connected 
                  ? 'bg-amber-100 text-amber-700' 
                  : 'bg-slate-100 text-slate-500'
            }`}>
              {psmConnected ? <Wifi size={12} /> : proxyStatus?.connected ? <Wifi size={12} /> : <WifiOff size={12} />}
              <span className="hidden sm:inline">
                {psmConnected ? 'PSM Activo' : proxyStatus?.connected ? 'Proxy Listo' : 'Sin PSM'}
              </span>
            </div>
            
            {proxyStatus?.connected && (
              <button 
                onClick={proxyStatus?.psmRunning ? handleStopProxy : handleStartProxy}
                disabled={proxyLoading}
                className={`text-xs px-2 py-1 rounded border ${
                  proxyStatus?.psmRunning 
                    ? 'border-rose-200 text-rose-600 hover:bg-rose-50' 
                    : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                } disabled:opacity-50`}
              >
                {proxyLoading ? '...' : proxyStatus?.psmRunning ? 'Detener' : 'Iniciar'}
              </button>
            )}
            
            <button 
              onClick={() => setShowSettings(true)}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-400"
              title="Configuración"
            >
              <Settings size={14} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/balances" className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 bg-amber-50 border-amber-200 text-amber-700">
              <TrendingDown size={12} />
              Balances
            </Link>
            <button onClick={() => loadOdtsOptimized(true)} disabled={loadingOptimized || isRefreshing}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw size={12} className={(loadingOptimized || isRefreshing) ? 'animate-spin' : ''} />
              {(loadingOptimized || isRefreshing) ? 'Cargando...' : 'Actualizar'}
            </button>
            
            {/* Auto-refresh toggle */}
            <button 
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border ${autoRefresh ? 'border-green-300 bg-green-50 text-green-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              title={autoRefresh ? 'Auto-actualización cada 30s' : 'Activar auto-actualización'}
            >
              <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
              {autoRefresh ? 'En Vivo' : 'Auto'}
            </button>
            
            {/* Export button */}
            <button 
              onClick={async () => {
                if (!confirm(`Exportar ${totalOdts} ODTs a Excel?`)) return
                const params = new URLSearchParams()
                if (filtroMateriales) params.set('filtro', filtroMateriales)
                if (filtroCuadrilla) params.set('cuadrilla', filtroCuadrilla)
                if (filtroPSM) params.set('psm_estado', filtroPSM)
                
                const res = await fetch(`/api/export-odts?${params.toString()}`)
                const blob = await res.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `ODTs_${filtroMateriales || 'todos'}_${new Date().toISOString().split('T')[0]}.xlsx`
                a.click()
                window.URL.revokeObjectURL(url)
              }}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-emerald-50"
            >
              📥 Exportar
            </button>
            
            {/* Last update indicator */}
            {lastUpdate && (
              <span className="text-[10px] text-slate-400">
                {lastUpdate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
            {selectedOdts.size > 0 && (
              <div className="flex items-center gap-1 ml-2">
                <span className="text-xs text-slate-500">{selectedOdts.size} seleccionados</span>
                <button onClick={() => setShowClassifyModal(true)}
                  className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">
                  📋 Clasificar
                </button>
                <button onClick={() => setSelectedOdts(new Set())}
                  className="text-xs px-2 py-1 rounded bg-slate-200 text-slate-600 hover:bg-slate-300">
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full p-4 flex flex-col gap-4 flex-1">

        {/* KPIs */}
        <div className="grid grid-cols-8 gap-2">
          {[
            { label: 'Total ODTs', value: totalOdts, color: 'text-slate-700', bg: 'bg-white', border: 'border-slate-200', icon: <Clock size={14} /> },
            { label: '🟢 Verde', value: statsApi.verde || 0, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', icon: <CheckCircle size={14} /> },
            { label: '🟡 Amarillo', value: statsApi.amarillo || 0, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', icon: <CheckCircle size={14} /> },
            { label: '🔴 Rojo', value: statsApi.rojo || 0, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', icon: <XCircle size={14} /> },
            { label: '🟠 Naranja', value: statsApi.naranja || 0, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100', icon: <Clock size={14} /> },
            { label: 'Auditadas', value: statsDB.verificaciones, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100', icon: <CheckCircle size={14} /> },
            { label: 'c/Consumo', value: statsApi.conMateriales || 0, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', icon: <Play size={14} /> },
            { label: 's/Consumo', value: statsApi.sinMateriales || 0, color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-100', icon: <Play size={14} /> },
          ].map(k => (
            <div key={k.label} className={`${k.bg} rounded-xl p-3 border ${k.border}`}>
              <div className={`flex items-center gap-1 ${k.color} opacity-60 mb-1`}>{k.icon}<span className="text-[10px] font-medium">{k.label}</span></div>
              <div className={`text-2xl font-bold ${k.color}`}>{typeof k.value === 'number' ? k.value.toLocaleString() : k.value}</div>
            </div>
          ))}
        </div>

        {/* FILTROS */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-40">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Buscar por ODT, titular, dirección..."
              value={busquedaLocal}
              onChange={e => setBusquedaLocal(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-400 bg-slate-50"
            />
          </div>
          
          {/* Filtro Cuadrilla */}
          <select 
            value={filtroCuadrilla} 
            onChange={e => setFiltroCuadrilla(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-400 bg-white"
          >
            <option value="">Todas las Cuadrillas</option>
            {cuadrillasList.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Filtro Estado PSM (R11, R20, etc) */}
          <select 
            value={filtroPSM} 
            onChange={e => setFiltroPSM(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-400 bg-white"
          >
            <option value="">Estado PSM (Todos)</option>
            <option value="R11">R11 (Nueva Instalación)</option>
            <option value="R20">R20 (Reparación)</option>
            <option value="R30">R30 (Mantenimiento)</option>
            <option value="R99">R99 (Otro)</option>
          </select>

          {/* Filtro Estado Auditoría (Conforme, Observación, etc) */}
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-400 bg-white">
            <option value="">Auditoría (Todos)</option>
            <option value="conforme">Conforme</option>
            <option value="observacion">Observación</option>
            <option value="no_conforme">No conforme</option>
            <option value="pendiente">Pendiente</option>
          </select>
          <select value={filtroMateriales} onChange={e => setFiltroMateriales(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-400 bg-white">
            <option value="">Todos</option>
            <option value="con_materiales">Con materiales</option>
            <option value="sin_materiales">Sin materiales</option>
            <option value="naranja">🟠 Pendiente Datos</option>
            <option value="rojo">🔴 Incompletas</option>
            <option value="amarillo">🟡 Solo Básico</option>
            <option value="verde">🟢 Completas</option>
            <option value="duplicada">🟣 Serie Duplicada</option>
          </select>
        </div>

        {/* TABLA */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex-1">
          {loadingOptimized ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <RefreshCw size={28} className="animate-spin mb-3 opacity-40" />
              <p className="text-sm">Cargando ODTs...</p>
              <p className="text-xs mt-1 opacity-60">Con paginación optimizada</p>
            </div>
          ) : odtsOptimized.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Search size={28} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">No hay ODTs que coincidan</p>
              <p className="text-xs mt-1">Cambiá los filtros</p>
            </div>
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="border-b border-slate-200">
                    <th className="text-left px-2 py-3 text-slate-500 w-8">
                      <input type="checkbox" onChange={e => {
                        if (e.target.checked) {
                          setSelectedOdts(new Set(odtsOptimized.map(o => o.odtId)))
                        } else {
                          setSelectedOdts(new Set())
                        }
                      }} className="rounded" />
                    </th>
                    <th className="text-left px-4 py-3 text-slate-500 font-semibold">ODT</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-semibold">Fecha</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-semibold">Estado</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-semibold">Cuadrilla</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-semibold">Serie medidor</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-semibold">Validación</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {odtsOptimized.map((odt: any) => (
                    <tr key={odt.odtId}
                      className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => {
                        setOdtSeleccionada(odt as any)
                        loadOdtsDetail(odt.odtId)
                      }}
                    >
                      <td className="px-2 py-3 w-8">
                        <input 
                          type="checkbox" 
                          checked={selectedOdts.has(odt.odtId)}
                          onChange={e => {
                            const newSet = new Set(selectedOdts)
                            if (e.target.checked) {
                              newSet.add(odt.odtId)
                            } else {
                              newSet.delete(odt.odtId)
                            }
                            setSelectedOdts(newSet)
                          }}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-blue-600">{odt.odtId}</td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">{odt.fecha || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">{odt.estado || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">{odt.cuadrilla || '—'}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">{odt.medidor || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${
                          odt.estadoSemaforo === 'verde' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                          odt.estadoSemaforo === 'amarillo' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                          odt.estadoSemaforo === 'rojo' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                          odt.estadoSemaforo === 'naranja' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                          odt.estadoSemaforo === 'purpura' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                          'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {odt.estadoSemaforo === 'verde' ? '✅ Completa' : 
                           odt.estadoSemaforo === 'amarillo' ? '⚠️ Básico' : 
                           odt.estadoSemaforo === 'rojo' ? '❌ Incompleta' : 
                           odt.estadoSemaforo === 'naranja' ? '🟠 Pendiente' :
                           odt.estadoSemaforo === 'purpura' ? '🟣 Duplicada' :
                           'Sin datos'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <ChevronRight size={14} className="text-slate-300" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tieneMas && (
                <div className="p-3 text-center border-t border-slate-200">
                  <button 
                    onClick={() => loadOdtsOptimized(false)}
                    disabled={loadingOptimized}
                    className="text-xs px-4 py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 disabled:opacity-50"
                  >
                    {loadingOptimized ? 'Cargando...' : 'Cargar más'}
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="text-xs text-slate-400 text-center py-2 border-t border-slate-100">
            Mostrando {odtsOptimized.length} de {totalOdts} ODTs
          </div>
        </div>
      </div>

      {/* PANEL LATERAL */}
      {odtSeleccionada && (
        <DetalleODT
          odt={odtSeleccionada}
          detailData={detailData}
          loadingDetail={loadingDetail}
          onClose={() => setOdtSeleccionada(null)}
          onBuscar={(odtId: string) => {
            setOdtSeleccionada(null)
            setBusquedaLocal(odtId)
          }}
        />
      )}

      {/* MODAL SETTINGS */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800">Configuración</h2>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  URL del PSM (Obligatorrio)
                </label>
                <input
                  type="text"
                  value={psmUrlInput}
                  onChange={(e) => setPsmUrlInput(e.target.value)}
                  placeholder="Ej: https://abc123.ngrok.io"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
                />
                <p className="text-xs text-slate-500 mt-1">
                  URL de ngrok para PSM (la que inicia con iniciar-psm.bat)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  URL del Proxy Control (Opcional)
                </label>
                <input
                  type="text"
                  value={proxyUrlInput}
                  onChange={(e) => setProxyUrlInput(e.target.value)}
                  placeholder="Ej: abc123.ngrok.io"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Solo si querés controlar el proxy desde la app
                </p>
              </div>
              
              <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
                <p className="font-medium mb-1">¿Cómo obtener la URL del PSM?</p>
                <ol className="list-decimal list-inside text-xs space-y-1">
                  <li>Ejecutá <code className="bg-slate-200 px-1 rounded">iniciar-psm.bat</code> en tu PC</li>
                  <li>Copiá la URL que aparece (ej: https://xyz.ngrok.io)</li>
                  <li>Pegala aquí y guardá</li>
                </ol>
              </div>
              
              <button
                onClick={saveProxyUrl}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CLASIFICAR */}
      {showClassifyModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800">Clasificación por Lotes</h2>
              <button onClick={() => setShowClassifyModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <p className="text-sm text-slate-600 mb-4">
              Clasificando <strong>{selectedOdts.size}</strong> ODTs seleccionadas
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tipo de Inconsistencia
                </label>
                <select id="tipoInconsistencia" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 bg-white">
                  <option value="Falta Material">Falta Material</option>
                  <option value="Serie Errónea">Serie Errónea</option>
                  <option value="Sospecha de Omisión">Sospecha de Omisión</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Observación (opcional)
                </label>
                <textarea 
                  id="observacionClasificar"
                  placeholder="Agregar observación..." 
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 h-24 resize-none"
                />
              </div>
              
              <button
                onClick={async () => {
                  const tipo = (document.getElementById('tipoInconsistencia') as HTMLSelectElement).value
                  const obs = (document.getElementById('observacionClasificar') as HTMLTextAreaElement).value
                  
                  setClasificando(true)
                  try {
                    const res = await fetch('/api/classify-batch', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        odtCodes: Array.from(selectedOdts),
                        tipoInconsistencia: tipo,
                        observacion: obs,
                        auditor: 'Auditor'
                      })
                    })
                    const data = await res.json()
                    if (data.ok) {
                      alert(data.message)
                      setShowClassifyModal(false)
                      setSelectedOdts(new Set())
                      loadOdtsOptimized(true)
                      loadStatsDB()
                    } else {
                      alert('Error: ' + data.error)
                    }
                  } catch (err) {
                    alert('Error al clasificar')
                  } finally {
                    setClasificando(false)
                  }
                }}
                disabled={clasificando}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
              >
                {clasificando ? 'Clasificando...' : 'Confirmar Clasificación'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}




