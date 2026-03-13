'use client'

import React, { useState, useEffect } from 'react'
import { useAudit, ResultadoAuditoria } from '@/lib/audit-context'
import { RefreshCw, PlayCircle, Play, ChevronRight, User, MapPin, Calendar, Search, AlertTriangle, CheckCircle, XCircle, Clock, Image as ImageIcon, X } from 'lucide-react'

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
  const [fotoActiva, setFotoActiva] = useState(0)

  return (
    // Modal completamente opaco y centrado
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div
        className="bg-white w-full max-w-2xl h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-5 py-4 flex justify-between items-center">
          <div>
            <div className="text-[11px] text-slate-400 font-mono uppercase tracking-wide">Orden de Trabajo</div>
            <div className="font-bold text-slate-800 text-2xl font-mono">{odt.odtId}</div>
          </div>
          <div className="flex items-center gap-2">
            <EstadoBadge estado={odt.estado} />
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 text-xl">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Info titular y cuadrilla */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Titular</div>
              <div className="font-semibold text-sm text-slate-700">{odt.pieza.nombreTitular || '—'}</div>
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                <MapPin size={10} className="shrink-0" />
                <span>{odt.pieza.direccionTitular} · {odt.pieza.localidad}</span>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Cuadrilla</div>
              <div className="font-semibold text-sm text-slate-700 flex items-center gap-1">
                <User size={12} />
                {odt.pieza.desc_cuadrilla || odt.pieza.cuadrilla || '—'}
              </div>
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                <Calendar size={10} />
                {odt.pieza.fechaIngreso || '—'}
              </div>
            </div>
          </div>

          {/* Hallazgos detectados */}
          {odt.hallazgos.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <AlertTriangle size={13} />
                Problemas detectados ({odt.hallazgos.length})
              </div>
              <div className="space-y-2">
                {odt.hallazgos.map((h, i) => (
                  <div key={i} className={`flex gap-2 items-start text-sm rounded-lg p-2.5 ${
                    h.tipo === 'error' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
                    h.tipo === 'warn' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                    'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}>
                    <span className="shrink-0 mt-0.5">
                      {h.tipo === 'error' ? '🔴' : h.tipo === 'warn' ? '🟡' : '🟢'}
                    </span>
                    <span>{h.descripcion}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fotos */}
          {odt.urlsFotos.length > 0 ? (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <ImageIcon size={12} />
                Fotos ({odt.urlsFotos.length})
              </div>
              <div className="bg-slate-100 rounded-xl overflow-hidden aspect-video relative">
                <img
                  src={odt.urlsFotos[fotoActiva]}
                  alt={`Foto ${fotoActiva + 1}`}
                  className="w-full h-full object-contain"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                {odt.urlsFotos.length > 1 && (
                  <>
                    <button
                      onClick={() => setFotoActiva(p => Math.max(0, p - 1))}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 text-white rounded-full flex items-center justify-center hover:bg-black/60"
                    >‹</button>
                    <button
                      onClick={() => setFotoActiva(p => Math.min(odt.urlsFotos.length - 1, p + 1))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 text-white rounded-full flex items-center justify-center hover:bg-black/60"
                    >›</button>
                    <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                      {odt.urlsFotos.map((_, i) => (
                        <button key={i} onClick={() => setFotoActiva(i)}
                          className={`w-1.5 h-1.5 rounded-full ${i === fotoActiva ? 'bg-white' : 'bg-white/40'}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
              {odt.urlsFotos.length > 1 && (
                <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">
                  {odt.urlsFotos.map((url, i) => (
                    <button key={i} onClick={() => setFotoActiva(i)}
                      className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 ${i === fotoActiva ? 'border-blue-500' : 'border-transparent'}`}>
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-slate-400 text-sm">
              <ImageIcon size={24} className="mx-auto mb-2 opacity-30" />
              Sin fotos registradas
            </div>
          )}

          {/* Resultado IA */}
          {odt.estado !== 'pendiente' && odt.estado !== 'procesando' && odt.medidor_serie_foto && (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Verificación IA</div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className={`rounded-xl p-3 border ${odt.medidor_coincide === false ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Serie leída en foto</div>
                  <div className={`font-mono font-bold ${odt.medidor_coincide === false ? 'text-rose-600' : 'text-slate-800'}`}>
                    {odt.medidor_serie_foto || '—'}
                  </div>
                </div>
                <div className={`rounded-xl p-3 border ${odt.medidor_coincide === false ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Serie en sistema</div>
                  <div className={`font-mono font-bold ${odt.medidor_coincide === false ? 'text-rose-600' : 'text-slate-800'}`}>
                    {odt.medidor_serie_sistema || '—'}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {[
                  { label: 'Medidor', ok: odt.medidor_coincide },
                  { label: 'Caja', ok: odt.caja_presente },
                  { label: 'Precinto', ok: odt.precinto_presente },
                ].map(item => (
                  <div key={item.label} className={`flex-1 rounded-xl p-2 text-center border ${
                    item.ok === true ? 'bg-emerald-50 border-emerald-200' :
                    item.ok === false ? 'bg-rose-50 border-rose-200' :
                    'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="text-base">{item.ok === true ? '✅' : item.ok === false ? '❌' : '—'}</div>
                    <div className="text-[10px] font-medium text-slate-600 mt-0.5">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Materiales */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Materiales registrados ({odt.consumos.length})
            </div>
            {odt.consumos.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl border border-slate-100">
                Sin consumos registrados en el sistema
              </div>
            ) : (
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                {odt.consumos.map((c, i) => (
                  <div key={i} className={`flex items-center justify-between px-3 py-2.5 text-xs ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-700 font-medium truncate">{c.producto_descripcion}</div>
                      <div className="text-slate-400 font-mono text-[10px]">{c.producto_codigo}</div>
                    </div>
                    {c.series && c.series !== 'N/A' && (
                      <span className="font-mono text-blue-500 text-[11px] mx-3 shrink-0">{c.series}</span>
                    )}
                    <span className="font-bold text-slate-700 shrink-0">×{c.cantidad}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botón auditar con IA */}
          {(odt.estado === 'pendiente' || odt.estado === 'observacion') && odt.urlsFotos.length > 0 && (
            <button
              onClick={onAuditar}
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <Play size={14} />
              Analizar fotos con IA
            </button>
          )}

          {odt.confianza !== null && (
            <div className="text-xs text-slate-400 text-right font-mono">Confianza IA: {odt.confianza}%</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function HomePage() {
  const {
    odtsFiltradas, stats, cuadrillas, loading,
    filtroEstado, filtroCuadrilla, filtroProblemas,
    setFiltroEstado, setFiltroCuadrilla, setFiltroProblemas,
    sincronizar, auditarODT, auditarTodas, setBusqueda
  } = useAudit()

  const [odtSeleccionada, setOdtSeleccionada] = useState<ResultadoAuditoria | null>(null)
  const [auditandoTodas, setAuditandoTodas] = useState(false)
  const [busquedaLocal, setBusquedaLocal] = useState('')

  // Búsqueda con debounce para no re-renderizar en cada tecla
  useEffect(() => {
    const timer = setTimeout(() => {
      setBusqueda(busquedaLocal)
    }, 300)
    return () => clearTimeout(timer)
  }, [busquedaLocal, setBusqueda])

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
          <div>
            <h1 className="text-lg font-bold text-slate-800">ControlODT</h1>
            <p className="text-xs text-slate-400">Auditoría automática con IA · EMA Servicios</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={sincronizar} disabled={loading}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Cargando...' : 'Sincronizar'}
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
        <div className="grid grid-cols-8 gap-2">
          {[
            { label: 'Total', value: stats.total, color: 'text-slate-700', bg: 'bg-white', border: 'border-slate-200', icon: <Clock size={14} /> },
            { label: 'Conformes', value: stats.conforme, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', icon: <CheckCircle size={14} /> },
            { label: 'Observación', value: stats.observacion, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', icon: <AlertTriangle size={14} /> },
            { label: 'No conformes', value: stats.no_conforme, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', icon: <XCircle size={14} /> },
            { label: 'Pendientes', value: stats.pendiente, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', icon: <PlayCircle size={14} /> },
            { label: 'Con errores', value: stats.conErrores, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', icon: <XCircle size={14} /> },
            { label: 'Con alertas', value: stats.conAlertas, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', icon: <AlertTriangle size={14} /> },
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
          <select value={filtroCuadrilla} onChange={e => setFiltroCuadrilla(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-400 bg-white">
            <option value="">Todas las cuadrillas</option>
            {cuadrillas.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filtroProblemas} onChange={e => setFiltroProblemas(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-400 bg-white">
            <option value="">Todos los problemas</option>
            <option value="errores">Con errores 🔴</option>
            <option value="alertas">Con alertas 🟡</option>
            <option value="sin-problemas">Sin problemas 🟢</option>
          </select>
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
                    <th className="text-left px-4 py-3 text-slate-500 font-semibold">Titular / Dirección</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-semibold">Cuadrilla</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-semibold">Serie medidor</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-semibold">Fotos</th>
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
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-700">{odt.pieza.nombreTitular || '—'}</div>
                        <div className="text-slate-400 text-[10px]">{odt.pieza.direccionTitular} · {odt.pieza.localidad}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">
                        {odt.pieza.desc_cuadrilla || odt.pieza.cuadrilla || '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500">
                        {odt.medidor_serie_sistema || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 text-[11px] ${odt.urlsFotos.length > 0 ? 'text-slate-500' : 'text-rose-400'}`}>
                          <ImageIcon size={11} />
                          {odt.urlsFotos.length}
                        </span>
                      </td>
                      <td className="px-4 py-3"><EstadoBadge estado={odt.estado} /></td>
                      <td className="px-4 py-3">
                        {odt.hallazgos.filter(h => h.tipo === 'error').length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            🔴 {odt.hallazgos.filter(h => h.tipo === 'error').length} errores
                          </span>
                        )}
                        {odt.hallazgos.filter(h => h.tipo === 'warn').length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 ml-1">
                            🟡 {odt.hallazgos.filter(h => h.tipo === 'warn').length} alertas
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
    </div>
  )
}
