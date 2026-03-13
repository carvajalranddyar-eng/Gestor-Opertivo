'use client';

import React from 'react';
import { cn } from '@/lib/utils';

type StatusType = 'VALIDA' | 'REVISIÓN' | 'ADVERTENCIA' | 'PENDIENTE' | 'OK' | 'CANTIDAD_INCORRECTA' | 'MATERIAL_ERRONEO' | 'FALTANTE';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const statusConfig: Record<string, { bg: string; text: string; label: string; icon?: string }> = {
  'VALIDA': { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Válida' },
  'REVISIÓN': { bg: 'bg-rose-100', text: 'text-rose-700', label: 'Revisión' },
  'ADVERTENCIA': { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Advertencia' },
  'PENDIENTE': { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Pendiente' },
  'OK': { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'OK' },
  'CANTIDAD_INCORRECTA': { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Cant. Inc.' },
  'MATERIAL_ERRONEO': { bg: 'bg-red-100', text: 'text-red-700', label: 'Mat. Err.' },
  'FALTANTE': { bg: 'bg-rose-100', text: 'text-rose-700', label: 'Faltante' },
};

const sizeClasses = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-[10px]',
  lg: 'px-2.5 py-1 text-xs',
};

export function StatusBadge({ status, size = 'md', showLabel = false, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { bg: 'bg-slate-100', text: 'text-slate-600', label: status };
  
  return (
    <span className={cn(
      "inline-flex items-center rounded font-medium border",
      config.bg,
      config.text,
      sizeClasses[size],
      "border-transparent",
      className
    )}>
      {showLabel ? config.label : status}
    </span>
  );
}

export function StatusDot({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' | 'lg' }) {
  const config = statusConfig[status] || { bg: 'bg-slate-100', text: 'text-slate-600' };
  
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };
  
  return (
    <span className={cn("rounded-full", config.bg, config.text, sizeClasses[size])} />
  );
}

export function StatusIndicator({ status }: { status: string }) {
  if (status === 'VALIDA') return <span className="text-emerald-500">✓</span>;
  if (status === 'REVISIÓN') return <span className="text-rose-500">⚠</span>;
  if (status === 'ADVERTENCIA') return <span className="text-amber-500">⚠</span>;
  return <span className="text-slate-400">-</span>;
}
