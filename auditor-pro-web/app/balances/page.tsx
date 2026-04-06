'use client'

import { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, AlertTriangle, FileText, Search, ChevronDown, ChevronUp, Download, Filter, Calendar } from 'lucide-react'
import * as XLSX from 'xlsx'
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
  
  // Filters
  const [search, setSearch] = useState('')
  const [filterGravedad, setFilterGravedad] = useState('')
  const [filterDiff, setFilterDiff] = useState('')
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  
  // Sorting
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)

  const loadBalance = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stats/material-aggregation')
      if (!res.ok) throw new Error('Error en la respuesta del servidor')
      const data = await res.json()
      if (data.ok && Array.isArray(data.balance)) {
        setBalanceData(data.balance)
      } else {
        setBalanceData([])
      }
    } catch (e: any) {
      console.error('Error loading balance:', e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBalance()
  }, [])

  // Filter logic
  const filteredData = useMemo(() => {
    let data = balanceData.filter(b => 
      (b.cuadrilla || '').toLowerCase().includes(search.toLowerCase()) ||
      (b.cuadrilla_nombre || '').toLowerCase().includes(search.toLowerCase())
    )

    if (filterGravedad) {
      if (filterGravedad === 'rojo') data = data.filter(r => r.gravedad >= 10)
      else if (filterGravedad === 'amarillo') data = data.filter(r => r.gravedad > 0 && r.gravedad < 10)
      else if (filterGravedad === 'verde') data = data.filter(r => r.gravedad === 0)
    }

    // Simple diff filter (total absolute diff)
    // In a real scenario we'd use the date range on ODTs, but here we just filter by existence
    
    return data
  }, [balanceData, search, filterGravedad, dateRange])

  // Sort logic
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData
    
    return [...filteredData].sort((a, b) => {
      let aVal: any, bVal: any
      
      switch(sortConfig.key) {
        case 'gravedad': aVal = a.gravedad; bVal = b.gravedad; break
        case 'odtsCount': aVal = a.odtsCount; bVal = b.odtsCount; break
        case 'nombre': aVal = a.cuadrilla_nombre || ''; bVal = b.cuadrilla_nombre || ''; break
        case 'diferencia':
          // Calculate total absolute diff for sorting
          aVal = Object.values(a.diferencia).reduce((acc, v) => acc + Math.abs(Number(v)), 0)
          bVal = Object.values(b.diferencia).reduce((acc, v) => acc + Math.abs(Number(v)), 0)
          break
        default: return 0
      }
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredData, sortConfig])

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        if (prev.direction === 'desc') return null // Reset
        return { key, direction: 'desc' }
      }
      return { key, direction: 'asc' }
    })
  }

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ChevronDown size={14} className="text-slate-300" />
    return sortConfig.direction === 'asc' 
      ? <ChevronUp size={14} className="text-cyan-600" /> 
      : <ChevronDown size={14} className="text-cyan-600" />
  }

  // Export Logic
  const handleExport = () => {
    // 1. Prepare Resumen Sheet
    const resumenData = sortedData.map(b => {
      const row: any = {
        'ID Cuadrilla': b.cuadrilla,
        'Nombre Cuadrilla': b.cuadrilla_nombre,
        'Total ODTs': b.odtsCount,
        'ODTs Verdes': b.odtsVerdes,
        'ODTs Amarillas': b.odtsAmarillos,
        'Gravedad': b.gravedad,
        'Medidores Entregados': b.materiales.find(m => m.code === '072003015')?.entregado || 0,
        'Medidores Verificados': b.materiales.find(m => m.code === '072003015')?.verificado || 0,
        'Diferencia Medidor': b.diferencia['072003015'] || 0,
        'Cajas Entregadas': b.materiales.find(m => m.code === '070008001')?.entregado || 0,
        'Cajas Verificadas': b.materiales.find(m => m.code === '070008001')?.verificado || 0,
        'Diferencia Caja': b.diferencia['070008001'] || 0,
        'Precintos Entregados': b.materiales.find(m => m.code === '072002015')?.entregado || 0,
        'Precintos Verificados': b.materiales.find(m => m.code === '072002015')?.verificado || 0,
        'Diferencia Precinto': b.diferencia['072002015'] || 0,
        'Estado': b.gravedad > 10 ? 'ROJO' : b.gravedad > 0 ? 'AMARILLO' : 'VERDE'
      }
      return row
    })

    // 2. Prepare Detalle Sheet (flattened ODTs - this would ideally come from API, but we simulate for now or use available data)
    // NOTE: To fully implement this, we need the ODT list from API. We can mock or fetch.
    // For now, let's aggregate the series we have in detalleEntregado
    const detalleRows: any[] = []
    
    sortedData.forEach(b => {
      b.materiales.forEach(m => {
        if (m.detalleEntregado && m.detalleEntregado.length > 0) {
          m.detalleEntregado.forEach(d => {
            detalleRows.push({
              'Cuadrilla ID': b.cuadrilla,
              'Cuadrilla Nombre': b.cuadrilla_nombre,
              'Codigo Material': m.code,
              'Descripcion': m.desc,
              'Serie': d.serie,
              'Remito': d.remito,
              'Fecha': d.fecha,
              'Tipo': 'ENTREGADO'
            })
          })
        }
      })
    })

    const wb = XLSX.utils.book_new()
    
    const ws1 = XLSX.utils.json_to_sheet(resumenData)
    XLSX.utils.book_append_sheet(wb, ws1, "Resumen Balances")
    
    if (detalleRows.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(detalleRows)
      XLSX.utils.book_append_sheet(wb, ws2, "Detalle Series")
    }

    XLSX.writeFile(wb, `Auditoria_Balance_${new Date().toISOString().split('T')[0]}.xlsx`)
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
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Exportar Excel</span>
          </button>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
          >
            <FileText size={16} />
            <span className="hidden sm:inline">Reporte</span>
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-7xl mx-auto">
        
        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar cuadrilla..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border-none focus:outline-none text-sm text-slate-700 placeholder-slate-400"
            />
          </div>
          
          <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select
              value={filterGravedad}
              onChange={(e) => setFilterGravedad(e.target.value)}
              className="text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-cyan-500"
            >
              <option value="">Todas las Gravedades</option>
              <option value="rojo">Rojo (Alto)</option>
              <option value="amarillo">Amarillo (Medio)</option>
              <option value="verde">Verde (OK)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-slate-400" />
            <input 
              type="date" 
              className="text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none"
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
            />
            <span className="text-slate-400">-</span>
            <input 
              type="date" 
              className="text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
            />
          </div>
        </div>

        {balanceData.length > 0 && balanceData[0].isEstimated && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
            <AlertTriangle className="text-amber-600 mt-0.5" size={20} />
            <div>
              <h3 className="text-sm font-bold text-amber-800">Datos Estimados</h3>
              <p className="text-xs text-amber-700 mt-1">
                El "Entregado" se calcula en base al consumo.
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
            {sortedData.length === 0 ? (
              <div className="text-center py-12 text-slate-400">No se encontraron cuadrillas</div>
            ) : (
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-100 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-200" onClick={() => handleSort('nombre')}>
                          <div className="flex items-center gap-1">Cuadrilla {getSortIcon('nombre')}</div>
                        </th>
                        <th className="px-4 py-3 font-semibold text-center cursor-pointer hover:bg-slate-200" onClick={() => handleSort('odtsCount')}>
                          <div className="flex items-center justify-center gap-1">ODTs {getSortIcon('odtsCount')}</div>
                        </th>
                        <th className="px-4 py-3 font-semibold text-center">Entregado</th>
                        <th className="px-4 py-3 font-semibold text-center">Verificado</th>
                        <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-200" onClick={() => handleSort('diferencia')}>
                          <div className="flex items-center justify-center gap-1">Diferencia {getSortIcon('diferencia')}</div>
                        </th>
                        <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-200" onClick={() => handleSort('gravedad')}>
                          <div className="flex items-center justify-center gap-1">Gravedad {getSortIcon('gravedad')}</div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sortedData.map((balance) => {
                        const gravedad = Number(balance?.gravedad) || 0
                        const nombre = balance?.cuadrilla_nombre || 'Sin nombre'
                        const medidor = balance.materiales.find(m => m.code === '072003015')
                        const diff = balance.diferencia['072003015'] || 0

                        return (
                          <tr key={balance.cuadrilla} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-800">{balance.cuadrilla}</div>
                              <div className="text-xs text-slate-500">{nombre}</div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="text-slate-700">{balance.odtsCount}</div>
                              <div className="text-xs text-emerald-600">✓ {balance.odtsVerdes}</div>
                              <div className="text-xs text-amber-600">⚠ {balance.odtsAmarillos}</div>
                            </td>
                            <td className="px-4 py-3 text-center bg-blue-50/30">
                              <div className="font-bold text-blue-700">{medidor?.entregado || 0}</div>
                            </td>
                            <td className="px-4 py-3 text-center bg-emerald-50/30">
                              <div className="text-emerald-700">{medidor?.verificado || 0}</div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {getDiffBadge(diff)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-1 rounded text-xs font-bold ${
                                gravedad > 10 ? 'bg-rose-600 text-white' : 
                                gravedad > 0 ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'
                              }`}>
                                {gravedad}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}