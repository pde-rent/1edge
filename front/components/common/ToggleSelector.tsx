import React from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface ToggleOption {
  value: string;
  label?: string;
  icon?: React.ReactNode;
  ariaLabel?: string;
}

interface ToggleSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  options: ToggleOption[];
  className?: string;
}

/**
 * Reusable toggle selector component with consistent styling across panels.
 */
export function ToggleSelector({ value, onValueChange, options, className = "" }: ToggleSelectorProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(newValue) => {
        if (newValue) onValueChange(newValue);
      }}
      className={`bg-black/60 backdrop-blur-sm border border-slate-700/50 p-1 ${className}`}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          aria-label={option.ariaLabel || option.label}
          className="data-[state=on]:bg-gradient-to-r data-[state=on]:from-teal-600/20 data-[state=on]:to-emerald-600/20 data-[state=on]:border-teal-400/50 data-[state=on]:text-teal-200 hover:bg-slate-800/60 text-slate-400 px-3 py-1 text-xs font-medium border-0 transition-all duration-300"
        >
          {option.icon ? option.icon : option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}