'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, AlertTriangle, Info, FileText, Search, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'

interface Material {
  code: string
  desc: string
  priority: number
  entregado: number
  verificado: number
  dudoso: number
  devuelto: number
  detalleEntregado?: { serie: string, remito: string, fecha: string }[]
}

interface BalanceData {
  cuadrilla: string
  cuadrilla_nombre?: string
  materiales: Material[]
  diferencia: Record<string, number>
  gravedad: number
  odtsCount: number
  odtsVerdes: number
  odtsAmarillos: number
  isEstimated?: boolean
}

export default function BalancesPage() {
  const [balanceData, setBalanceData] = useState<BalanceData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtroGravedad, setFiltroGravedad] = useState('')
  const [search, setSearch] = useState('')
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [expandedMaterials, setExpandedMaterials] = useState<Set<string>>(new Set()) // Track expanded material details

  const loadBalance = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filtroGravedad) params.set('gravedad', filtroGravedad)
      
      const res = await fetch(`/api/stats/material-aggregation?${params.toString()}`)
      
      if (!res.ok) throw new Error('Error en la respuesta del servidor')
      
      const data = await res.json()
      
      if (data.ok && Array.isArray(data.balance)) {
        setBalanceData(data.balance)
      } else {
        setBalanceData([])
      }
    } catch (e: any) {
      console.error('Error loading balance:', e)
      setError(e.message || 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBalance()
  }, [filtroGravedad])

  const filteredData = balanceData.filter(b => 
    (b.cuadrilla || '').toLowerCase().includes(search.toLowerCase()) ||
    (b.cuadrilla_nombre || '').toLowerCase().includes(search.toLowerCase())
  )

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedCards)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedCards(newExpanded)
  }

  const toggleMaterialDetail = (key: string) => {
    const newExpanded = new Set(expandedMaterials)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedMaterials(newExpanded)
  }

  const getDiffBadge = (val: number) => {
    if (val > 0) return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">+{val}</span>
    if (val < 0) return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">{val}</span>
    return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">OK</span>
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-slate-900 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-md">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-300 hover:text-white">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-white font-bold text-lg tracking-wide">AUDITOR<span className="text-cyan-400">PRO</span> - Balance</h1>
        </div>
        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
        >
          <FileText size={16} />
          <span className="hidden sm:inline">Reporte</span>
        </button>
      </div>

      <div className="p-4 space-y-4 max-w-7xl mx-auto">
        <div className="flex gap-2 flex-col sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar cuadrilla o nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-cyan-500 shadow-sm"
            />
          </div>
          <select
            value={filtroGravedad}
            onChange={(e) => setFiltroGravedad(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white shadow-sm"
          >
            <option value="">Todas las alertas</option>
            <option value="rojo">Solo Rojas (Gravedad &gt; 10)</option>
            <option value="amarillo">Solo Amarillas (Gravedad &lt; 10)</option>
          </select>
        </div>

        {balanceData.length > 0 && balanceData[0].isEstimated && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
            <AlertTriangle className="text-amber-600 mt-0.5" size={20} />
            <div>
              <h3 className="text-sm font-bold text-amber-800">Datos Estimados</h3>
              <p className="text-xs text-amber-700 mt-1">
                El "Entregado" se está calculando en base al consumo. 
                Sincronizá el pañol para obtener datos reales.
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center text-red-700">
            <p>Error al cargar: {error}</p>
            <button onClick={loadBalance} className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
              Reintentar
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredData.length === 0 ? (
              <div className="text-center py-12 text-slate-400">No se encontraron cuadrillas</div>
            ) : (
              filteredData.map((balance, index) => {
                const id = balance?.cuadrilla || `temp-${index}`
                const gravedad = Number(balance?.gravedad) || 0
                const nombre = balance?.cuadrilla_nombre || 'Sin nombre'
                const isExpanded = expandedCards.has(id)
                
                return (
                  <div key={id} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                    {/* Header */}
                    <div 
                      className={`px-4 py-3 flex justify-between items-center cursor-pointer ${
                        gravedad > 10 ? 'bg-rose-50' : 
                        gravedad > 0 ? 'bg-amber-50' : 'bg-slate-50'
                      }`}
                      onClick={() => toggleExpand(id)}
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <span className="font-bold text-slate-800 text-lg">{id}</span>
                          <span className="mx-2 text-slate-300">/</span>
                          <span className="text-sm text-slate-600 font-medium">{nombre}</span>
                        </div>
                        {gravedad > 10 && (
                          <span className="text-[10px] bg-rose-600 text-white px-2 py-0.5 rounded font-bold shadow-sm">
                            AUDITAR
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-xs text-slate-500 hidden sm:block">
                          ODTs: <span className="font-semibold">{Number(balance?.odtsCount) || 0}</span> | 
                          <span className="text-emerald-600"> ✓ {Number(balance?.odtsVerdes) || 0}</span> | 
                          <span className="text-amber-600"> ⚠ {Number(balance?.odtsAmarillos) || 0}</span>
                        </div>
                        <div className="text-xs font-bold text-slate-400">
                          Gravedad: <span className={gravedad > 10 ? 'text-rose-600' : gravedad > 0 ? 'text-amber-600' : 'text-emerald-600'}>{gravedad}</span>
                        </div>
                        {isExpanded ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                      </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-100 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3 font-semibold w-24">Código</th>
                            <th className="px-4 py-3 font-semibold">Descripción Material</th>
                            <th className="px-4 py-3 text-center font-semibold w-24 bg-blue-50 text-blue-700">Entregado</th>
                            <th className="px-4 py-3 text-center font-semibold w-24 bg-emerald-50 text-emerald-700">Verificado</th>
                            <th className="px-4 py-3 text-center font-semibold w-24">Diferencia</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {balance?.materiales?.map((mat) => {
                            const diff = balance.diferencia[mat.code] || 0
                            const detailKey = `${id}-${mat.code}`
                            const hasDetail = mat.detalleEntregado && mat.detalleEntregado.length > 0
                            const isDetailExpanded = expandedMaterials.has(detailKey)

                            return (
                              <>
                                <tr key={mat.code} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-4 py-2 font-mono text-slate-600 text-xs">{mat.code}</td>
                                  <td className="px-4 py-2 text-slate-700 font-medium max-w-xs truncate" title={mat.desc}>
                                    {mat.desc}
                                  </td>
                                  <td 
                                    className={`px-4 py-2 text-center font-bold cursor-pointer hover:bg-blue-50 transition-colors ${hasDetail ? 'text-blue-700' : 'text-blue-800 bg-blue-50/30'}`}
                                    onClick={() => hasDetail && toggleMaterialDetail(detailKey)}
                                    title={hasDetail ? "Click para ver series" : ""}
                                  >
                                    {mat.entregado}
                                    {hasDetail && <span className="ml-1 text-[10px]">📋</span>}
                                  </td>
                                  <td className="px-4 py-2 text-center bg-emerald-50/30 text-emerald-800">{mat.verificado}</td>
                                  <td className="px-4 py-2 text-center">
                                    {getDiffBadge(diff)}
                                  </td>
                                </tr>
                                {hasDetail && isDetailExpanded && (
                                  <tr className="bg-blue-50/50">
                                    <td colSpan={5} className="px-4 py-3">
                                      <div className="text-xs font-semibold text-blue-800 mb-2">Detalle de Entrega (Serie / Remito / Fecha)</div>
                                      <div className="flex flex-wrap gap-2">
                                        {mat.detalleEntregado?.map((det, i) => (
                                          <div key={i} className="bg-white border border-blue-200 rounded px-2 py-1 text-xs font-mono text-slate-600 flex gap-2">
                                            <span className="font-bold text-blue-700">{det.serie}</span>
                                            <span className="text-slate-400">|</span>
                                            <span>{det.remito}</span>
                                            <span className="text-slate-400">|</span>
                                            <span className="text-slate-500">{det.fecha}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </>
                            )
                          })}
                          {(!balance?.materiales || balance.materiales.length === 0) && (
                             <tr><td colSpan={5} className="text-center py-4 text-slate-400 italic">Sin materiales registrados</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}