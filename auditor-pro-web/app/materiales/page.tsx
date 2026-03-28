'use client'

import React, { useState, useEffect } from 'react'
import { RefreshCw, Search, Package, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Box, Warehouse, ClipboardList } from 'lucide-react'

interface BalanceMaterial {
  codigo: string
  descripcion: string
  entregado: number
  consumido: number
  stock: number
  balance: number
  porCuadrilla: {
    cuadrilla: string
    entregado: number
    consumido: number
    balance: number
    odts: { odt: string; cantidad: number }[]
  }[]
}

interface Stock {
  producto_codigo: string
  producto_descripcion: string
  cantidad: number
}

export default function MaterialesPage() {
  const [balanceGeneral, setBalanceGeneral] = useState<BalanceMaterial[]>([])
  const [stock, setStock] = useState<Stock[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'balance' | 'stock'>('balance')
  const [expandedMaterial, setExpandedMaterial] = useState<string | null>(null)
  const [expandedCuadrilla, setExpandedCuadrilla] = useState<{material: string, cuadrilla: string} | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/materiales')
      const data = await res.json()
      
      setBalanceGeneral(data.balanceGeneral || [])
      setStock(data.stock || [])
    } catch (err) {
      console.error('Error cargando:', err)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  // Calculate totals
  const totales = balanceGeneral.reduce((acc, m) => ({
    entregado: acc.entregado + m.entregado,
    consumido: acc.consumido + m.consumido,
    stock: acc.stock + m.stock
  }), { entregado: 0, consumido: 0, stock: 0 })

  const filteredBalance = balanceGeneral.filter(m => {
    if (search && !m.codigo.includes(search) && 
        !m.descripcion?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="min-h-screen bg-slate-50 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Inventario de Materiales</h1>
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
            <a href="/" className="text-sm px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">
              ← Volver
            </a>
          </div>
        </div>
      </div>

      {/* Totals Cards */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
              <Package size={14} /> Total Entregado
            </div>
            <div className="text-2xl font-bold text-blue-600">{totales.entregado.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
              <ClipboardList size={14} /> Total Consumido
            </div>
            <div className="text-2xl font-bold text-amber-600">{totales.consumido.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
              <Warehouse size={14} /> Stock Total
            </div>
            <div className="text-2xl font-bold text-emerald-600">{totales.stock.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
              <Box size={14} /> Materiales
            </div>
            <div className="text-2xl font-bold text-slate-700">{balanceGeneral.length}</div>
          </div>
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

        {/* Balance Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="w-8 px-2"></th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600">Código</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600">Descripción</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-slate-600">Entregado</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-slate-600">Consumido</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-slate-600">Stock</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-slate-600">Balance</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
                      Cargando inventario...
                    </td>
                  </tr>
                ) : filteredBalance.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      No hay materiales
                    </td>
                  </tr>
                ) : (
                  filteredBalance.map((m, i) => (
                    <React.Fragment key={m.codigo}>
                      <tr className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-2">
                          <button 
                            onClick={() => setExpandedMaterial(expandedMaterial === m.codigo ? null : m.codigo)}
                            className="p-1 hover:bg-slate-100 rounded"
                          >
                            {expandedMaterial === m.codigo ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                        <td className="px-3 py-3 font-mono font-medium text-blue-600">{m.codigo}</td>
                        <td className="px-3 py-3 text-slate-700 max-w-xs truncate">{m.descripcion || '—'}</td>
                        <td className="px-3 py-3 text-right font-medium text-blue-600">{m.entregado}</td>
                        <td className="px-3 py-3 text-right font-medium text-amber-600">{m.consumido}</td>
                        <td className="px-3 py-3 text-right font-medium text-emerald-600">{m.stock}</td>
                        <td className="px-3 py-3 text-right">
                          <span className={`inline-flex items-center gap-1 font-bold ${
                            m.balance > 0 ? 'text-emerald-600' : m.balance < 0 ? 'text-rose-600' : 'text-slate-500'
                          }`}>
                            {m.balance > 0 ? <TrendingUp size={14} /> : m.balance < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                            {m.balance}
                          </span>
                        </td>
                      </tr>
                      
                      {/* Detalle por Cuadrilla */}
                      {expandedMaterial === m.codigo && m.porCuadrilla && m.porCuadrilla.length > 0 && (
                        <tr className="bg-slate-50">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="ml-6">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-slate-500 border-b border-slate-200">
                                    <th className="text-left py-2 w-8"></th>
                                    <th className="text-left py-2">Cuadrilla</th>
                                    <th className="text-right py-2">Entregado</th>
                                    <th className="text-right py-2">Consumido</th>
                                    <th className="text-right py-2">Balance</th>
                                    <th className="text-left py-2 pl-4">ODTs (consumido)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {m.porCuadrilla.map((cq, j) => (
                                    <React.Fragment key={j}>
                                      <tr className="border-b border-slate-200">
                                        <td className="py-1">
                                          <button 
                                            onClick={() => {
                                              const key = {material: m.codigo, cuadrilla: cq.cuadrilla}
                                              setExpandedCuadrilla(
                                                expandedCuadrilla?.material === m.codigo && expandedCuadrilla?.cuadrilla === cq.cuadrilla 
                                                  ? null 
                                                  : key
                                              )
                                            }}
                                            className="p-0.5 hover:bg-slate-200 rounded"
                                          >
                                            {expandedCuadrilla?.material === m.codigo && expandedCuadrilla?.cuadrilla === cq.cuadrilla 
                                              ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                          </button>
                                        </td>
                                        <td className="py-1 font-medium text-slate-700">{cq.cuadrilla}</td>
                                        <td className="py-1 text-right text-blue-600">{cq.entregado}</td>
                                        <td className="py-1 text-right text-amber-600">{cq.consumido}</td>
                                        <td className={`py-1 text-right font-medium ${
                                          cq.balance > 0 ? 'text-emerald-600' : cq.balance < 0 ? 'text-rose-600' : 'text-slate-500'
                                        }`}>{cq.balance}</td>
                                        <td className="py-1 pl-4 text-slate-500">
                                          {cq.odts.length} ODTs
                                        </td>
                                      </tr>
                                      
                                      {/* ODTs detail */}
                                      {expandedCuadrilla?.material === m.codigo && expandedCuadrilla?.cuadrilla === cq.cuadrilla && (
                                        <tr>
                                          <td colSpan={7} className="py-2 pl-12 pr-4">
                                            <div className="bg-white rounded border border-slate-200 p-2 max-h-40 overflow-y-auto">
                                              <div className="grid grid-cols-4 gap-2 text-xs">
                                                {cq.odts.slice(0, 50).map((odt, k) => (
                                                  <div key={k} className="flex items-center justify-between bg-slate-50 rounded px-2 py-1">
                                                    <span className="font-mono text-blue-600">{odt.odt}</span>
                                                    <span className="text-amber-600 font-medium">×{odt.cantidad}</span>
                                                  </div>
                                                ))}
                                                {cq.odts.length > 50 && (
                                                  <div className="col-span-4 text-center text-slate-400 py-1">
                                                    ... y {cq.odts.length - 50} más
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  ))}
                                </tbody>
                              </table>
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
        </div>
      </div>
    </div>
  )
}
