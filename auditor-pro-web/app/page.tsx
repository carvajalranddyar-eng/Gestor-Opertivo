'use client'

import React, { useState, useEffect } from 'react'
import { useAudit } from '@/lib/audit-context'
import { supabase } from '@/lib/supabase'
import { RefreshCw, Play, ChevronRight, Search, CheckCircle, XCircle, Clock, X, Wifi, WifiOff, Settings } from 'lucide-react'

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
  const estado = verificacion?.estado_auditoria || 'pendiente'

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
        className="modal-panel bg-white w-full max-w-lg h-full shadow-2xl overflow-hidden flex flex-col animate-slide-in"
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
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
              estado === 'conforme' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
              estado === 'no_conforme' ? 'bg-rose-100 text-rose-700 border-rose-200' :
              'bg-slate-100 text-slate-600 border-slate-200'
            }`}>{estado}</span>
          </div>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-700 text-slate-300">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
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

          {loadingDetail ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw size={24} className="animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="text-xs font-semibold text-slate-600 uppercase px-3 py-2 bg-slate-100 border-b border-slate-200">
                Materiales ({consumos.length})
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
  const [sincronizando, setSincronizando] = useState(false)
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
  const [loadingOptimized, setLoadingOptimized] = useState(false)
  const [page, setPage] = useState(0)
  const [totalOdts, setTotalOdts] = useState(0)
  const [tieneMas, setTieneMas] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailData, setDetailData] = useState<any>(null)

  // Filters for optimized API
  const [filtroMateriales, setFiltroMateriales] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

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
  }, [filtroMateriales, filtroEstado])

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

  const handleSincronizarPSM = async () => {
    if (!confirm('Esto sincronizará PSM y Obrador. ¿Continuar?')) return
    
    setSincronizando(true)
    const results: string[] = []
    
    try {
      // 1. Sincronizar PSM
      const res1 = await fetch('/api/sync', { method: 'POST' })
      const text1 = await res1.text()
      let data1
      try {
        data1 = JSON.parse(text1)
      } catch (e) {
        throw new Error(`Error en sync PSM: ${text1.substring(0, 200)}`)
      }
      
      if (!data1.ok) {
        throw new Error(data1.error || 'Error desconocido en sync PSM')
      }
      results.push(`PSM: ${data1.odts_procesadas || 0} ODTs, ${data1.consumos_procesados || 0} consumos`)
      
      // 2. Sincronizar Obrador (stock)
      const res2 = await fetch('/api/sync-obrador', { method: 'POST' })
      const text2 = await res2.text()
      let data2
      try {
        data2 = JSON.parse(text2)
      } catch (e) {
        throw new Error(`Error en sync Obrador: ${text2.substring(0, 200)}`)
      }
      
      if (data2.ok) {
        results.push(`Stock: ${data2.registros_procesados || 0} registros`)
      }
      
      // 3. Sincronizar movimientos Obrador
      const res3 = await fetch('/api/sync-movimientos-obrador', { method: 'POST' })
      const text3 = await res3.text()
      let data3
      try {
        data3 = JSON.parse(text3)
      } catch (e) {
        throw new Error(`Error en sync movimientos: ${text3.substring(0, 200)}`)
      }
      
      if (data3.ok) {
        results.push(`Movimientos: ${data3.registros_procesados || 0} registros`)
      }
      
      // 4. Recargar datos en pantalla
      await loadOdtsOptimized(true)
      
      // 5. Actualizar stats de la DB
      await loadStatsDB()
      
      alert(`Sincronización completada:\n${results.join('\n')}`)
      setPsmConnected(true)
    } catch (err: any) {
      console.error('Error sincronizando:', err)
      alert('Error al sincronizar: ' + (err.message || err))
    } finally {
      setSincronizando(false)
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
            <button onClick={() => loadOdtsOptimized(true)} disabled={loadingOptimized}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw size={12} className={loadingOptimized ? 'animate-spin' : ''} />
              {loadingOptimized ? 'Cargando...' : 'Actualizar'}
            </button>
            <button onClick={handleSincronizarPSM} disabled={sincronizando}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-50">
              <RefreshCw size={12} className={sincronizando ? 'animate-spin' : ''} />
              {sincronizando ? 'Sincronizando...' : 'Sincronizar'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full p-4 flex flex-col gap-4 flex-1">

        {/* KPIs */}
        <div className="grid grid-cols-6 gap-2">
          {[
            { label: 'Total', value: totalOdts, color: 'text-slate-700', bg: 'bg-white', border: 'border-slate-200', icon: <Clock size={14} /> },
            { label: 'Con materiales', value: statsDB.consumos, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', icon: <CheckCircle size={14} /> },
            { label: 'Pendientes', value: statsDB.odts - statsDB.verificaciones, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', icon: <Play size={14} /> },
            { label: 'Auditadas', value: statsDB.verificaciones, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100', icon: <XCircle size={14} /> },
            { label: 'ODTs', value: statsDB.odts, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', icon: <XCircle size={14} /> },
            { label: 'Movimientos', value: statsDB.movimientos, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-100', icon: <CheckCircle size={14} /> },
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
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-400 bg-white">
            <option value="">Todos los estados</option>
            <option value="R11">R11 (Completadas)</option>
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
                    <th className="text-left px-4 py-3 text-slate-500 font-semibold">ODT</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-semibold">Fecha</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-semibold">Cuadrilla</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-semibold">Serie medidor</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-semibold">Estado</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-semibold">Materiales</th>
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
                      <td className="px-4 py-3 font-mono font-bold text-blue-600">{odt.odtId}</td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">—</td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">{odt.cuadrilla || '—'}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">{odt.medidor || '—'}</td>
                      <td className="px-4 py-3"><span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                        odt.estadoAuditoria === 'conforme' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                        odt.estadoAuditoria === 'no_conforme' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>{odt.estadoAuditoria}</span></td>
                      <td className="px-4 py-3">
                        {odt.tieneConsumos ? (
                          <span className="text-emerald-600 text-[10px] font-medium">✓ {odt.materialesCount}</span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Sin materiales</span>
                        )}
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
    </div>
  )
}
