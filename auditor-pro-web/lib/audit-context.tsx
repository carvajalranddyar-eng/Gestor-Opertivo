'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface Consumo {
  odt: string
  producto_codigo: string
  producto_descripcion: string
  cantidad: number
  cuadrilla_codigo: string
  cuadrilla_descripcion: string
  created_at: string
  series: string | null
  series_text: string | null
}

export interface ODTPieza {
  codigoBarras: string
  numero: string
  cliente: string
  direccionTitular: string
  nombreTitular: string
  localidad: string
  estado: string
  fechaIngreso: string
  fechaAsignacion: string | null
  cuadrilla: number | null
  desc_cuadrilla: string | null
  foto: string | null
  fotosAdicionales: string[]
  medidor: string | null
  tipoServicio: string
  materiales: any
}

export interface ResultadoAuditoria {
  odtId: string
  pieza: ODTPieza
  consumos: Consumo[]
  urlsFotos: string[]
  estado: 'conforme' | 'observacion' | 'no_conforme' | 'pendiente' | 'procesando'
  confianza: number | null
  medidor_serie_foto: string | null
  medidor_serie_sistema: string | null
  medidor_coincide: boolean | null
  caja_presente: boolean | null
  precinto_presente: boolean | null
  hallazgos: { tipo: 'ok' | 'warn' | 'error'; descripcion: string; odtsRelacionadas?: string[] }[]
  requiere_humano: boolean
  motivo_humano: string | null
  validacionStock: {
    enStockObrador: boolean
    serieEncontrada: boolean
    descripcion: string
    tipo: 'ok' | 'error'
  }[]
}

interface AuditContextType {
  stockObrador: any[]
  hallazgosObrador: any[]
  stockPorCuadrilla: Map<string, any[]>
}

const AuditContext = createContext<AuditContextType | null>(null)

export function AuditProvider({ children }: { children: React.ReactNode }) {
  const [stockObrador, setStockObrador] = useState<any[]>([])
  const [hallazgosObrador, setHallazgosObrador] = useState<any[]>([])
  const [stockPorCuadrilla, setStockPorCuadrilla] = useState<Map<string, any[]>>(new Map())

  return (
    <AuditContext.Provider value={{
      stockObrador,
      hallazgosObrador,
      stockPorCuadrilla
    }}>
      {children}
    </AuditContext.Provider>
  )
}

export function useAudit() {
  const ctx = useContext(AuditContext)
  if (!ctx) throw new Error('useAudit debe usarse dentro de AuditProvider')
  return ctx
}
