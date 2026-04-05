'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function DudososPage() {
  const params = useParams()
  const cuadrillaId = params.cuadrilla as string

  const [dudosos, setDudosos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/balances/${cuadrillaId}/dudosos`)
      .then(res => res.json())
      .then(data => {
        if (data.ok) setDudosos(data.dudosos)
      })
      .finally(() => setLoading(false))
  }, [cuadrillaId])

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-slate-800 px-4 py-3 flex items-center sticky top-0 z-10">
        <Link href="/balances" className="text-white hover:text-blue-300 mr-3">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-white font-bold text-lg">
          Auditoría Dudosos: {cuadrillaId}
        </h1>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="text-center py-10">Cargando...</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">ODT</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Fecha</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Tipo</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Estado</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {dudosos.map((d, i) => (
                  <tr key={i} className={d.estadoSemaforo === 'rojo' ? 'bg-red-50' : 'bg-amber-50'}>
                    <td className="px-4 py-2 text-sm font-mono text-slate-700">
                        {d.codigo_barras}
                        <div className="text-xs text-slate-400">Nro: {d.numero}</div>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">{d.fecha_ingreso}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">{d.estado}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        d.estadoSemaforo === 'rojo' ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'
                      }`}>
                        {d.estadoSemaforo.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600">{d.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dudosos.length === 0 && <div className="p-4 text-center text-slate-500">No hay dudosos</div>}
          </div>
        )}
      </div>
    </div>
  )
}
