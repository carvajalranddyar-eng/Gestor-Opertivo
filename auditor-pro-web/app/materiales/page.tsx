'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  RefreshCw, Search, Package, TrendingUp, TrendingDown, Minus, 
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle, XCircle,
  Calendar, User, Box, ClipboardList, Warehouse, Eye, Filter
} from 'lucide-react'

interface Material {
  codigo: string
  descripcion: string
  entregas: any[]
  consumos: any[]
  stock_odt: any[]
  por_cuadrilla: {
    cuadrilla_codigo: string
    cuadrilla_nombre: string
    entregas_cantidad: number
    consumos_cantidad: number
    balance: number
    entregas_detalle: any[]
    consumos_detalle: any[]
  }[]
  total_entregado: number
  total_consumido: number
  stock_real: number
  balance_total: number
}

interface Duplicado {
  tipo: string
  key: string
  cantidad_duplicados: number
  registros: {
    odt: string
    material: string
    cuadrilla: string
    cantidad: number
    fecha: string
  }[]
}

interface Resumen {
  total_materiales: number
  total_entregas: number
  total_consumos_psm: number
  duplicados_encontrados: number
  stock_items: number
}

interface StockGeneral {
  codigo: string
  descripcion: string
  cantidad: number
  ubicacion?: string
}

export default function MaterialesPage() {
  const [materiales, setMateriales] = useState<Material[]>([])
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [duplicados, setDuplicados] = useState<Duplicado[]>([])
  const [stockGeneral, setStockGeneral] = useState<StockGeneral[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'auditoria' | 'duplicados' | 'stock'>('auditoria')
  const [expandedMaterial, setExpandedMaterial] = useState<string | null>(null)
  const [expandedCuadrilla, setExpandedCuadrilla] = useState<string | null>(null)
  const [filtroFecha, setFiltroFecha] = useState('')
  
  const loadData = async (codigo?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (codigo) params.set('codigo', codigo)
      if (filtroFecha) params.set('desde', filtroFecha)
      
      const res = await fetch(`/api/materiales?${params}`)
      const data = await res.json()
      
      setMateriales(data.materiales || [])
      setResumen(data.resumen)
      setDuplicados(data.duplicados || [])
      setStockGeneral(data.stock_general || [])
    } catch (err) {
      console.error('Error:', err)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [filtroFecha])

  const filteredMateriales = useMemo(() => {
    if (!search) return materiales
    const s = search.toLowerCase()
    return materiales.filter(m => 
      m.codigo.toLowerCase().includes(s) ||
      m.descripcion?.toLowerCase().includes(s)
    )
  }, [materiales, search])

  // Stats
  const stats = useMemo(() => {
    return {
      totalEntregado: materiales.reduce((sum, m) => sum + m.total_entregado, 0),
      totalConsumido: materiales.reduce((sum, m) => sum + m.total_consumido, 0),
      totalStock: materiales.reduce((sum, m) => sum + m.stock_real, 0),
      materialesConProblemas: materiales.filter(m => m.balance_total < 0).length
    }
  }, [materiales])

  const formatDate = (date: string) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 overflow-auto">
      {/* Header */}
      <div className="bg-slate-800 text-white px-4 py-4 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold">AUDITORÍA DE MATERIALES</h1>
              <p className="text-slate-400 text-sm">ControlODT · EMA Servicios</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={filtroFecha}
                onChange={e => setFiltroFecha(e.target.value)}
                className="px-3 py-1.5 text-sm rounded bg-slate-700 border border-slate-600 text-white"
              />
              <button 
                onClick={() => loadData()}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Actualizar
              </button>
              <a href="/" className="px-3 py-1.5 bg-slate-700 rounded hover:bg-slate-600">
                ← Volver
              </a>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-5 gap-3">
            <div className="bg-slate-700/50 rounded-lg p-3">
              <div className="text-xs text-slate-400">Total Entregado</div>
              <div className="text-xl font-bold text-blue-400">{stats.totalEntregado.toLocaleString()}</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3">
              <div className="text-xs text-slate-400">Total Consumido</div>
              <div className="text-xl font-bold text-amber-400">{stats.totalConsumido.toLocaleString()}</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3">
              <div className="text-xs text-slate-400">Stock Obrador</div>
              <div className="text-xl font-bold text-emerald-400">{stats.totalStock.toLocaleString()}</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3">
              <div className="text-xs text-slate-400">Con Problemas</div>
              <div className="text-xl font-bold text-red-400">{stats.materialesConProblemas}</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3">
              <div className="text-xs text-slate-400">Duplicados</div>
              <div className="text-xl font-bold text-orange-400">{duplicados.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('auditoria')}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
              activeTab === 'auditoria' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'
            }`}
          >
            <ClipboardList size={16} /> Auditoría por Material
          </button>
          <button
            onClick={() => setActiveTab('duplicados')}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
              activeTab === 'duplicados' ? 'bg-orange-600 text-white' : 'bg-white text-slate-600'
            }`}
          >
            <AlertTriangle size={16} /> Duplicados ({duplicados.length})
          </button>
          <button
            onClick={() => setActiveTab('stock')}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
              activeTab === 'stock' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600'
            }`}
          >
            <Warehouse size={16} /> Stock Obrador
          </button>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por código o descripción..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-slate-200"
            />
          </div>
        </div>

        {/* AUDITORIA TAB */}
        {activeTab === 'auditoria' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="w-8"></th>
                  <th className="text-left px-3 py-3 text-xs font-bold text-slate-600">CÓDIGO</th>
                  <th className="text-left px-3 py-3 text-xs font-bold text-slate-600">DESCRIPCIÓN</th>
                  <th className="text-right px-3 py-3 text-xs font-bold text-blue-600">ENTREGADO</th>
                  <th className="text-right px-3 py-3 text-xs font-bold text-amber-600">CONSUMIDO</th>
                  <th className="text-right px-3 py-3 text-xs font-bold text-emerald-600">STOCK</th>
                  <th className="text-right px-3 py-3 text-xs font-bold text-slate-600">BALANCE</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12"><RefreshCw className="animate-spin mx-auto" /></td></tr>
                ) : filteredMateriales.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400">No hay materiales</td></tr>
                ) : (
                  filteredMateriales.map(m => (
                    <React.Fragment key={m.codigo}>
                      <tr className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-2">
                          <button onClick={() => setExpandedMaterial(expandedMaterial === m.codigo ? null : m.codigo)} className="p-1 hover:bg-slate-100 rounded">
                            {expandedMaterial === m.codigo ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                        <td className="px-3 py-3 font-mono font-bold text-blue-700">{m.codigo}</td>
                        <td className="px-3 py-3 text-slate-700 max-w-xs truncate">{m.descripcion || '—'}</td>
                        <td className="px-3 py-3 text-right font-bold text-blue-600">{m.total_entregado}</td>
                        <td className="px-3 py-3 text-right font-bold text-amber-600">{m.total_consumido}</td>
                        <td className="px-3 py-3 text-right font-bold text-emerald-600">{m.stock_real}</td>
                        <td className="px-3 py-3 text-right">
                          <span className={`inline-flex items-center gap-1 font-bold ${
                            m.balance_total > 0 ? 'text-emerald-600' : m.balance_total < 0 ? 'text-red-600' : 'text-slate-500'
                          }`}>
                            {m.balance_total > 0 ? <TrendingUp size={14} /> : m.balance_total < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                            {m.balance_total}
                          </span>
                        </td>
                      </tr>
                      
                      {/* Detalle por Cuadrilla */}
                      {expandedMaterial === m.codigo && (
                        <tr className="bg-slate-50">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="ml-4 space-y-3">
                              <div className="text-xs font-bold text-slate-500 uppercase mb-2">Detalle por Cuadrilla</div>
                              {m.por_cuadrilla.map((cq, i) => (
                                <div key={i} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                  <div 
                                    className="px-4 py-2 bg-slate-100 flex items-center justify-between cursor-pointer"
                                    onClick={() => setExpandedCuadrilla(expandedCuadrilla === `${m.codigo}-${i}` ? null : `${m.codigo}-${i}`)}
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="font-medium text-slate-700">{cq.cuadrilla_nombre || cq.cuadrilla_codigo}</span>
                                      <span className="text-xs text-slate-400">({cq.cuadrilla_codigo})</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm">
                                      <span className="text-blue-600">Ent: {cq.entregas_cantidad}</span>
                                      <span className="text-amber-600">Cons: {cq.consumos_cantidad}</span>
                                      <span className={cq.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}>Bal: {cq.balance}</span>
                                      {expandedCuadrilla === `${m.codigo}-${i}` ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                                    </div>
                                  </div>
                                  
                                  {expandedCuadrilla === `${m.codigo}-${i}` && (
                                    <div className="p-4 grid grid-cols-2 gap-4">
                                      {/* Entregas */}
                                      <div>
                                        <div className="text-xs font-bold text-blue-600 mb-2 flex items-center gap-1">
                                          <Package size={12} /> ENTREGAS ({cq.entregas_detalle.length})
                                        </div>
                                        <div className="space-y-1 max-h-48 overflow-y-auto">
                                          {cq.entregas_detalle.length === 0 ? (
                                            <div className="text-xs text-slate-400 italic">Sin entregas registradas</div>
                                          ) : (
                                            cq.entregas_detalle.map((e, j) => (
                                              <div key={j} className="text-xs flex justify-between bg-blue-50 rounded px-2 py-1">
                                                <span className="font-mono text-blue-700">{e.cuadrilla_nombre || e.cuadrilla_codigo}</span>
                                                <span className="text-blue-600">×{e.cantidad}</span>
                                                <span className="text-slate-400">{formatDate(e.fecha)}</span>
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      </div>
                                      
                                      {/* Consumos */}
                                      <div>
                                        <div className="text-xs font-bold text-amber-600 mb-2 flex items-center gap-1">
                                          <ClipboardList size={12} /> CONSUMOS ({cq.consumos_detalle.length})
                                        </div>
                                        <div className="space-y-1 max-h-48 overflow-y-auto">
                                          {cq.consumos_detalle.map((c, j) => (
                                            <div key={j} className="text-xs flex justify-between bg-amber-50 rounded px-2 py-1">
                                              <span className="font-mono text-amber-700">{c.odt}</span>
                                              <span className="text-amber-600">×{c.cantidad}</span>
                                              <span className="text-slate-400">{formatDate(c.fecha)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* DUPLICADOS TAB */}
        {activeTab === 'duplicados' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {duplicados.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle size={48} className="mx-auto text-emerald-500 mb-4" />
                <div className="text-lg font-medium text-slate-700">No se encontraron duplicados</div>
                <div className="text-slate-500">La información está consistente</div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-orange-50 border-b border-orange-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-bold text-orange-700">TIPO</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-orange-700">MATERIAL</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-orange-700">ODT</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-orange-700">CUADRILLA</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-orange-700">CANTIDAD</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-orange-700">FECHA</th>
                  </tr>
                </thead>
                <tbody>
                  {duplicados.map((d, i) => (
                    d.registros.map((r, j) => (
                      <tr key={`${i}-${j}`} className="border-b border-orange-100 hover:bg-orange-50">
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1 text-orange-600 text-xs">
                            <AlertTriangle size={12} /> DUPLICADO
                          </span>
                        </td>
                        <td className="px-4 py-2 font-mono">{r.material}</td>
                        <td className="px-4 py-2 font-mono text-blue-600">{r.odt}</td>
                        <td className="px-4 py-2">{r.cuadrilla}</td>
                        <td className="px-4 py-2 text-right font-bold">{r.cantidad}</td>
                        <td className="px-4 py-2 text-slate-500">{formatDate(r.fecha)}</td>
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* STOCK TAB */}
        {activeTab === 'stock' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-emerald-50 border-b border-emerald-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-bold text-emerald-700">CÓDIGO</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-emerald-700">DESCRIPCIÓN</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-emerald-700">CANTIDAD</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-emerald-700">UBICACIÓN</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="text-center py-12"><RefreshCw className="animate-spin mx-auto" /></td></tr>
                ) : stockGeneral.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-12 text-slate-400">No hay stock</td></tr>
                ) : (
                  stockGeneral.map((s, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-medium">{s.codigo}</td>
                      <td className="px-4 py-3">{s.descripcion}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">{s.cantidad}</td>
                      <td className="px-4 py-3 text-slate-500">{s.ubicacion || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
