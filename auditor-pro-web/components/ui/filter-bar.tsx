'use client';

import React from 'react';
import { Search, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  children?: React.ReactNode;
  className?: string;
}

export function FilterBar({ 
  searchPlaceholder = "Buscar...", 
  searchValue, 
  onSearchChange,
  children,
  className 
}: FilterBarProps) {
  return (
    <div className={cn("flex gap-2 items-center flex-wrap", className)}>
      <div className="relative flex-1 min-w-[150px]">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input 
          type="text" 
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={e => onSearchChange(e.target.value)}
          className="w-full pl-7 pr-2 py-1.5 rounded border border-slate-200 text-xs focus:outline-none focus:border-blue-500"
        />
        {searchValue && (
          <button 
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

interface FilterButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

export function FilterButton({ label, active, onClick }: FilterButtonProps) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-2 py-1 rounded text-[10px] font-medium transition-colors",
        active ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      )}
    >
      {label}
    </button>
  );
}

interface FilterGroupProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}

export function FilterSelect({ label, value, onChange, options, className }: FilterGroupProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label && <span className="text-[10px] text-slate-500 font-medium">{label}</span>}
      <select 
        value={value} 
        onChange={e => onChange(e.target.value)}
        className="bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-600 focus:outline-none focus:border-blue-500"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
