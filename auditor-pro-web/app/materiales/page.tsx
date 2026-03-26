'use client'

import React, { useState, useEffect } from 'react'
import { RefreshCw, Search, Package, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react'

interface ResumenCuadrilla {
  cuadrilla: string
  entregado: number
  consumido: number
  balance: number
  odts: number
}

interface Material {
  codigo: string
  descripcion: string
  cantidad: number
  serie?: string | null
}

interface DetalleOdt {
  odt: string
  cuadrilla: string
  fecha: string
  materiales: Material[]
}

interface Stock {
  codigo_producto: string
  descripcion: string
  cantidad: number
  ubicacion?: string
}

export default function MaterialesPage() {
  const [resumenCuadrillas, setResumenCuadrillas] = useState<ResumenCuadrilla[]>([])
  const [detallePorOdt, setDetallePorOdt] = useState<DetalleOdt[]>([])
  const [stock, setStock] = useState<Stock[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cuadrillaFilter, setCuadrillaFilter] = useState('')
  const [expandedOdt, setExpandedOdt] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'resumen' | 'detalle' | 'stock'>('resumen')

  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (cuadrillaFilter) params.set('cuadrilla', cuadrillaFilter)
      
      const res = await fetch(`/api/materiales?${params}`)
      const data = await res.json()
      
      setResumenCuadrillas(data.resumenCuadrillas || [])
      setDetallePorOdt(data.detallePorOdt || [])
      setStock(data.stock || [])
    } catch (err) {
      console.error('Error cargando:', err)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [cuadrillaFilter])

  const cuadrillas = [...new Set(resumenCuadrillas.map(r => r.cuadrilla))].filter(Boolean).sort()

  const filteredResumen = resumenCuadrillas.filter(r => {
    if (search && !r.cuadrilla.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const filteredDetalle = detallePorOdt.filter(d => {
    if (search && !d.odt.includes(search) && !d.cuadrilla.toLowerCase().includes(search.toLowerCase())) return false
    if (cuadrillaFilter && !d.cuadrilla.toLowerCase().includes(cuadrillaFilter.toLowerCase())) return false
    return true
  })

  const filteredStock = stock.filter(s => {
    if (search && !s.codigo_producto?.includes(search) && !s.descripcion?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const formatDate = (date: string) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Historial de Materiales</h1>
            <p className="text-sm text-slate-500">ControlODT · EMA Servicios</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Actualizar
            </button>
            <a 
              href="/"
              className="text-sm px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
            >
              ← Volver
            </a>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <div className="flex gap-4 items-center flex-wrap">
            <div className="flex-1 min-w-[200px] relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-slate-200"
              />
            </div>
            <select
              value={cuadrillaFilter}
              onChange={e => setCuadrillaFilter(e.target.value)}
              className="text-sm px-3 py-2 rounded-lg border border-slate-200"
            >
              <option value="">Todas las cuadrillas</option>
              {cuadrillas.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('resumen')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              activeTab === 'resumen' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Resumen por Cuadrilla
          </button>
          <button
            onClick={() => setActiveTab('detalle')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              activeTab === 'detalle' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Detalle por ODT
          </button>
          <button
            onClick={() => setActiveTab('stock')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              activeTab === 'stock' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Stock Actual
          </button>
        </div>

        {/* Resumen Tab */}
        {activeTab === 'resumen' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Cuadrilla</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600">Entregado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600">Consumido</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600">Balance</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600">ODTs</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400">
                      <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
                      Cargando...
                    </td>
                  </tr>
                ) : filteredResumen.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400">
                      No hay datos
                    </td>
                  </tr>
                ) : (
                  filteredResumen.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-800">{r.cuadrilla || 'Sin cuadrilla'}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{r.entregado}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{r.consumido}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center gap-1 text-sm font-medium ${
                          r.balance > 0 ? 'text-emerald-600' :
                          r.balance < 0 ? 'text-rose-600' : 'text-slate-500'
                        }`}>
                          {r.balance > 0 ? <TrendingUp size={14} /> : r.balance < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                          {r.balance}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-slate-500">{r.odts}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Detalle Tab */}
        {activeTab === 'detalle' && (
          <div className="space-y-2">
            {loading ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
                <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
                Cargando...
              </div>
            ) : filteredDetalle.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
                No hay datos
              </div>
            ) : (
              filteredDetalle.map((odt, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div 
                    className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                    onClick={() => setExpandedOdt(expandedOdt === odt.odt ? null : odt.odt)}
                  >
                    <div className="flex items-center gap-4">
                      {expandedOdt === odt.odt ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                      <div>
                        <a 
                          href={`https://psm.emaservicios.com.ar/informe-piezas-odt`}
                          target="_blank"
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          ODT: {odt.odt}
                        </a>
                        <span className="text-xs text-slate-400 ml-2">{odt.cuadrilla}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>{odt.materiales.length} materiales</span>
                      <span>{formatDate(odt.fecha)}</span>
                    </div>
                  </div>
                  
                  {expandedOdt === odt.odt && (
                    <div className="border-t border-slate-100 bg-slate-50 p-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-slate-500">
                            <th className="text-left pb-2">Código</th>
                            <th className="text-left pb-2">Material</th>
                            <th className="text-right pb-2">Cantidad</th>
                            <th className="text-left pb-2">Serie</th>
                          </tr>
                        </thead>
                        <tbody>
                          {odt.materiales.map((m, j) => (
                            <tr key={j} className="border-t border-slate-100">
                              <td className="py-2 font-mono text-xs">{m.codigo}</td>
                              <td className="py-2">{m.descripcion}</td>
                              <td className="py-2 text-right font-medium">{m.cantidad}</td>
                              <td className="py-2 font-mono text-xs text-slate-500">{m.serie || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Stock Tab */}
        {activeTab === 'stock' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Código</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Descripción</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-slate-400">
                      <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
                      Cargando...
                    </td>
                  </tr>
                ) : filteredStock.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-slate-400">
                      No hay stock
                    </td>
                  </tr>
                ) : (
                  filteredStock.map((s, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-mono">{s.codigo_producto}</td>
                      <td className="px-4 py-3 text-sm">{s.descripcion}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{s.cantidad}</td>
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
