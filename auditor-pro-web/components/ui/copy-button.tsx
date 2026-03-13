'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
  value: string;
  className?: string;
  showValue?: boolean;
}

export function CopyButton({ value, className, showValue = false }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "flex items-center gap-1 rounded transition-colors cursor-pointer",
        copied ? "text-emerald-500" : "text-slate-400 hover:text-slate-600",
        className
      )}
      title="Click to copy"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
      {showValue && <span className="text-xs">{value}</span>}
    </button>
  );
}

interface CopyTextProps {
  value: string;
  className?: string;
  as?: 'span' | 'div';
}

export function CopyText({ value, className, as: Component = 'span' }: CopyTextProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  return (
    <Component
      onClick={handleCopy}
      className={cn(
        "cursor-pointer transition-colors",
        copied ? "text-emerald-500" : "hover:text-blue-500",
        className
      )}
      title="Click to copy"
    >
      {value}
      {copied && <Check className="inline w-3 h-3 ml-1" />}
    </Component>
  );
}
