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
      className={`bg-card backdrop-blur-sm border border-primary/25 p-1 ${className}`}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          aria-label={option.ariaLabel || option.label}
          className="data-[state=on]:bg-primary/20 data-[state=on]:border-primary data-[state=on]:text-primary hover:bg-primary/10 text-muted-foreground px-3 py-1 text-xs font-medium border-0 transition-all duration-300"
        >
          {option.icon ? option.icon : option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}