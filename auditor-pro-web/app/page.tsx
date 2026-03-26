'use client'

import React, { useState, useEffect } from 'react'
import { useAudit, ResultadoAuditoria } from '@/lib/audit-context'
import { RefreshCw, PlayCircle, Play, ChevronRight, User, MapPin, Calendar, Search, AlertTriangle, CheckCircle, XCircle, Clock, X, Wifi, WifiOff, Settings } from 'lucide-react'

interface ProxyStatus {
  connected: boolean
  proxyControlUrl: string | null
  psmUrl: string | null
  psmRunning: boolean
  psmConnected: boolean
  message: string
}

function EstadoBadge({ estado }: { estado: ResultadoAuditoria['estado'] }) {
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

function DetalleODT({ odt, onClose, onAuditar }: { odt: ResultadoAuditoria; onClose: () => void; onAuditar: () => void }) {
  const [copied, setCopied] = useState<string | null>(null)

  const copiar = (texto: string, tipo: string) => {
    navigator.clipboard.writeText(texto)
    setCopied(tipo)
    setTimeout(() => setCopied(null), 1500)
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
    {/* Panel lateral derecho */}
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-end">
      <div
        className="modal-panel bg-white w-full max-w-lg h-full shadow-2xl overflow-hidden flex flex-col animate-slide-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
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
            <EstadoBadge estado={odt.estado} />
          </div>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-700 text-slate-300">
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">

          {/* Info Cuadrilla y Fecha */}
          <div className="flex items-center gap-2">
            <div className="bg-white rounded px-3 py-2 border border-slate-200 flex-1">
              <span className="text-slate-400 text-[10px] uppercase font-semibold">Cuadrilla</span>
              <div className="font-medium text-slate-800 text-sm truncate">{odt.pieza.desc_cuadrilla || odt.pieza.cuadrilla || '—'}</div>
            </div>
            <div className="bg-white rounded px-3 py-2 border border-slate-200 w-24">
              <span className="text-slate-400 text-[10px] uppercase font-semibold">Fecha</span>
              <div className="font-medium text-slate-800 text-sm">{odt.pieza.fechaIngreso ? new Date(odt.pieza.fechaIngreso).toLocaleDateString('es-AR') : '—'}</div>
            </div>
          </div>

          {/* Fotos */}
          {odt.urlsFotos && odt.urlsFotos.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 p-3">
              <span className="text-slate-400 text-[10px] uppercase font-semibold">Fotos ({odt.urlsFotos.length})</span>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {odt.urlsFotos.slice(0, 4).map((url, i) => (
                  <a 
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-video bg-slate-100 rounded-lg overflow-hidden border border-slate-200 hover:border-blue-400 transition-colors"
                  >
                    <img 
                      src={url} 
                      alt={`Foto ${i + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f1f5f9" width="100" height="100"/><text x="50" y="50" text-anchor="middle" dy=".3em" fill="%2394a3b8" font-size="12">Foto no disponible</text></svg>'
                      }}
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Validación Stock - IRREGULARIDAD */}
          {odt.validacionStock && odt.validacionStock.some(v => v.tipo === 'error') && (
            <div className="bg-rose-100 border-2 border-rose-500 rounded-lg p-3">
              <div className="text-xs font-bold text-rose-800 uppercase flex items-center gap-2 mb-2">
                ⚠️ Irregularidad Stock
              </div>
              {odt.validacionStock.filter(v => v.tipo === 'error').map((v, i) => (
                <div key={i} className="text-sm text-rose-900 bg-white/80 rounded px-3 py-2 font-medium mb-1">
                  {v.descripcion.split(':').map((parte, idx) => (
                    <span key={idx}>
                      {idx === 1 && parte.includes('250') ? (
                        <button 
                          onClick={() => copiar(parte.trim(), 'serie')}
                          className="text-blue-600 underline hover:text-blue-800 font-mono"
                          title="Click para copiar"
                        >
                          {parte.trim()}
                        </button>
                      ) : idx === 1 && (parte.includes('N-') || /\d{8,}/.test(parte)) ? (
                        <button 
                          onClick={() => copiar(parte.trim(), 'odt')}
                          className="text-blue-600 underline hover:text-blue-800 font-mono"
                          title="Click para copiar"
                        >
                          {parte.trim()}
                        </button>
                      ) : (
                        parte
                      )}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Problemas / Hallazgos */}
          {odt.hallazgos.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
              <div className="text-xs font-bold text-amber-800 uppercase flex items-center gap-2 mb-2">
                <AlertTriangle size={12} /> Problemas ({odt.hallazgos.length})
              </div>
              <div className="space-y-1.5">
                {odt.hallazgos.map((h, i) => (
                  <div key={i} className={`text-sm rounded px-3 py-2 font-medium ${
                    h.tipo === 'error' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {h.tipo === 'error' ? '🔴' : '🟡'} {h.descripcion}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Materiales - todo visible sin scroll */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="text-xs font-semibold text-slate-600 uppercase px-3 py-2 bg-slate-100 border-b border-slate-200">
              Materiales ({odt.consumos.length})
            </div>
            <div>
              {odt.consumos.length === 0 ? (
                <div className="text-sm text-slate-400 text-center py-3">Sin consumos</div>
              ) : (
                odt.consumos.map((c, i) => (
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

          {/* Botón auditar */}
          {(odt.estado === 'pendiente' || odt.estado === 'observacion') && odt.urlsFotos.length > 0 && (
            <button
              onClick={onAuditar}
              className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <Play size={14} />
              Auditar ODTs
            </button>
          )}

          {odt.confianza !== null && (
            <div className="text-xs text-slate-400 text-right">Confianza: {odt.confianza}%</div>
          )}
        </div>
      </div>
    </div>
    </>
  )
}

export default function HomePage() {
  const {
    odtsFiltradas, stats, cuadrillas, loading,
    filtroEstado, filtroCuadrilla, filtroProblemas,
    ordenarPor, ordenarDir,
    setFiltroEstado, setFiltroCuadrilla, setFiltroProblemas,
    setOrdenarPor, setOrdenarDir,
    sincronizar, auditarODT, auditarTodas, setBusqueda,
    stockObrador, hallazgosObrador, stockPorCuadrilla
  } = useAudit()

  const [odtSeleccionada, setOdtSeleccionada] = useState<ResultadoAuditoria | null>(null)
  const [auditandoTodas, setAuditandoTodas] = useState(false)
  const [busquedaLocal, setBusquedaLocal] = useState('')
  const [sincronizando, setSincronizando] = useState(false)
  const [proxyStatus, setProxyStatus] = useState<ProxyStatus | null>(null)
  const [proxyLoading, setProxyLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [proxyUrlInput, setProxyUrlInput] = useState('')
  const [psmUrlInput, setPsmUrlInput] = useState('https://psm.emaservicios.com.ar')
  const [psmConnected, setPsmConnected] = useState(false)

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

  // Búsqueda con debounce para no re-renderizar en cada tecla
  useEffect(() => {
    const timer = setTimeout(() => {
      setBusqueda(busquedaLocal)
    }, 300)
    return () => clearTimeout(timer)
  }, [busquedaLocal, setBusqueda])

  const handleSincronizarPSM = async () => {
    setSincronizando(true)
    try {
      // Verificar que tenga la URL de PSM
      if (!psmUrlInput) {
        alert('Configurá la URL del PSM en Settings primero.')
        setSincronizando(false)
        return
      }
      
      // Guardar la URL en settings si no está
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          proxy_control_url: proxyUrlInput,
          psm_url: psmUrlInput
        })
      })
      
      // 1. Sincronizar PSM (ODTs + consumos)
      await fetch('/api/sync', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ psmUrl: psmUrlInput })
      })
      
      // 2. Sincronizar Obrador (stock)
      await fetch('/api/sync-obrador', { method: 'POST' })
      
      // 3. Sincronizar movimientos Obrador
      await fetch('/api/sync-movimientos-obrador', { method: 'POST' })
      
      // 4. Cargar datos en pantalla
      await sincronizar()
      
      setPsmConnected(true)
    } catch (err) {
      console.error('Error sincronizando:', err)
      alert('Error al sincronizar')
    } finally {
      setSincronizando(false)
    }
  }

  const handleAuditarTodas = async () => {
    setAuditandoTodas(true)
    await auditarTodas()
    setAuditandoTodas(false)
  }

  const handleAuditar = async (odtId: string) => {
    setOdtSeleccionada(null)
    await auditarODT(odtId)
    // Reabrir con datos actualizados
    setTimeout(() => {
      const updated = odtsFiltradas.find(o => o.odtId === odtId)
      if (updated) setOdtSeleccionada(updated)
    }, 500)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-lg font-bold text-slate-800">ControlODT</h1>
              <p className="text-xs text-slate-400">Auditoría automática con IA · EMA Servicios</p>
            </div>
            <a 
              href="/seguimiento"
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
            >
              Seguimiento
            </a>
            <a 
              href="/materiales"
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
            >
              Historial Materiales
            </a>
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
            <button onClick={() => sincronizar()} disabled={loading}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Cargando...' : 'Cargar'}
            </button>
            <button onClick={handleSincronizarPSM} disabled={sincronizando}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-50">
              <RefreshCw size={12} className={sincronizando ? 'animate-spin' : ''} />
              {sincronizando ? 'Sincronizando...' : 'Sincronizar PSM'}
            </button>
            <button onClick={handleAuditarTodas} disabled={auditandoTodas || stats.pendiente === 0}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              <PlayCircle size={12} />
              {auditandoTodas ? 'Auditando...' : `Auditar pendientes (${stats.pendiente})`}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full p-4 flex flex-col gap-4 flex-1">

        {/* KPIs */}
        <div className="grid grid-cols-6 gap-2">
          {[
            { label: 'Total', value: stats.total, color: 'text-slate-700', bg: 'bg-white', border: 'border-slate-200', icon: <Clock size={14} /> },
            { label: 'Conformes', value: stats.conforme, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', icon: <CheckCircle size={14} /> },
            { label: 'Pendientes', value: stats.pendiente, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', icon: <PlayCircle size={14} /> },
            { label: 'Stock Irregular', value: stats.stockIrregular, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', icon: <XCircle size={14} /> },
            { label: 'Con errores', value: stats.conErrores, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', icon: <XCircle size={14} /> },
            { label: 'Sin problemas', value: stats.sinProblemas, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', icon: <CheckCircle size={14} /> },
          ].map(k => (
            <div key={k.label} className={`${k.bg} rounded-xl p-3 border ${k.border}`}>
              <div className={`flex items-center gap-1 ${k.color} opacity-60 mb-1`}>{k.icon}<span className="text-[10px] font-medium">{k.label}</span></div>
              <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
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
            <option value="conforme">Conforme</option>
            <option value="observacion">Observación</option>
            <option value="no_conforme">No conforme</option>
            <option value="pendiente">Pendiente</option>
          </select>
          <input 
            type="text" 
            value={filtroCuadrilla} 
            onChange={e => setFiltroCuadrilla(e.target.value)}
            placeholder="Buscar cuadrilla..."
            list="cuadrillas-list"
            className="text-xs px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-400 bg-white w-48"
          />
          <datalist id="cuadrillas-list">
            {cuadrillas.map(c => <option key={c} value={c} />)}
          </datalist>
          <select value={filtroProblemas} onChange={e => setFiltroProblemas(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-400 bg-white">
            <option value="">Todos</option>
            <option value="stock-ok">Stock OK</option>
            <option value="stock-irregular">Stock Irregular</option>
            <option value="errores">Con errores</option>
            <option value="alertas">Con alertas</option>
            <option value="sin-problemas">Sin problemas</option>
          </select>
          <div className="flex items-center gap-1">
            <select value={ordenarPor} onChange={e => setOrdenarPor(e.target.value)}
              className="text-xs px-2 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-400 bg-white">
              <option value="fecha">Fecha</option>
              <option value="odt">ODT</option>
              <option value="serie">Serie</option>
              <option value="estado">Estado</option>
              <option value="problemas">Problemas</option>
            </select>
            <button onClick={() => setOrdenarDir(ordenarDir === 'asc' ? 'desc' : 'asc')}
              className="text-xs px-2 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 bg-white"
              title={ordenarDir === 'asc' ? 'Ascendente' : 'Descendente'}>
              {ordenarDir === 'asc' ? '↑' : '↓'}
            </button>
          </div>
          <span className="text-xs text-slate-400 ml-auto">{odtsFiltradas.length} ODTs</span>
        </div>

        {/* TABLA */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <RefreshCw size={28} className="animate-spin mb-3 opacity-40" />
              <p className="text-sm">Cargando y analizando ODTs desde PSM...</p>
              <p className="text-xs mt-1 opacity-60">Esto puede tomar unos segundos</p>
            </div>
          ) : odtsFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Search size={28} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">No hay ODTs que coincidan</p>
              <p className="text-xs mt-1">Cambiá los filtros o sincronizá de nuevo</p>
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
                    <th className="text-left px-4 py-3 text-slate-500 font-semibold">Problemas</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {odtsFiltradas.map(odt => (
                    <tr key={odt.odtId}
                      className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => setOdtSeleccionada(odt)}
                    >
                      <td className="px-4 py-3 font-mono font-bold text-blue-600">{odt.odtId}</td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">
                        {odt.pieza.fechaIngreso ? new Date(odt.pieza.fechaIngreso).toLocaleDateString('es-AR') : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">
                        {odt.pieza.desc_cuadrilla || odt.pieza.cuadrilla || '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500">
                        {odt.medidor_serie_sistema || '—'}
                      </td>
                      <td className="px-4 py-3"><EstadoBadge estado={odt.estado} /></td>
                      <td className="px-4 py-3">
                        {(odt.hallazgos.filter(h => h.tipo === 'error').length > 0 || odt.validacionStock?.some(v => v.tipo === 'error')) && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            ⚠️ {odt.hallazgos.filter(h => h.tipo === 'error').length + (odt.validacionStock?.some(v => v.tipo === 'error') ? 1 : 0)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {odt.estado === 'pendiente' && odt.urlsFotos.length > 0 && (
                            <button onClick={e => { e.stopPropagation(); auditarODT(odt.odtId) }}
                              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200">
                              <Play size={10} /> Auditar
                            </button>
                          )}
                          <ChevronRight size={14} className="text-slate-300" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* PANEL LATERAL */}
      {odtSeleccionada && (
        <DetalleODT
          odt={odtSeleccionada}
          onClose={() => setOdtSeleccionada(null)}
          onAuditar={() => handleAuditar(odtSeleccionada.odtId)}
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
