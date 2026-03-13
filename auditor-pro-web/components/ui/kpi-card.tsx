'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  color?: 'slate' | 'emerald' | 'rose' | 'amber' | 'blue' | 'purple';
  bgColor?: string;
  className?: string;
}

const colorMap = {
  slate: { text: 'text-slate-600', bg: 'bg-slate-100' },
  emerald: { text: 'text-emerald-600', bg: 'bg-emerald-50' },
  rose: { text: 'text-rose-600', bg: 'bg-rose-50' },
  amber: { text: 'text-amber-600', bg: 'bg-amber-50' },
  blue: { text: 'text-blue-600', bg: 'bg-blue-50' },
  purple: { text: 'text-purple-600', bg: 'bg-purple-50' },
};

export function KPICard({ label, value, icon: Icon, color = 'slate', bgColor, className }: KPICardProps) {
  const colors = colorMap[color];
  
  return (
    <div className={cn(
      "rounded-xl p-3 border border-slate-200 shadow-sm",
      bgColor || colors.bg,
      className
    )}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold uppercase text-slate-500 truncate">{label}</span>
        <Icon className={cn("w-3.5 h-3.5", colors.text)} />
      </div>
      <div className={cn("text-xl font-bold", colors.text)}>{value}</div>
    </div>
  );
}

interface MiniStatProps {
  label: string;
  value: number;
  color?: 'slate' | 'emerald' | 'rose' | 'amber';
}

const miniColorMap = {
  slate: 'text-slate-600',
  emerald: 'text-emerald-600',
  rose: 'text-rose-600',
  amber: 'text-amber-600',
};

export function MiniStat({ label, value, color = 'slate' }: MiniStatProps) {
  return (
    <div className="flex items-center gap-1">
      <span className={cn("text-[10px] font-medium", miniColorMap[color])}>{label}</span>
      <span className={cn("text-[10px] font-bold", miniColorMap[color])}>{value}</span>
    </div>
  );
}
