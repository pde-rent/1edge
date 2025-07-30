import React from 'react';
import { Card } from '@/components/ui/card';

interface PanelWrapperProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Reusable panel wrapper component for consistent styling across all panels.
 * Eliminates code duplication and ensures uniform appearance.
 */
export function PanelWrapper({ children, className = "" }: PanelWrapperProps) {
  return (
    <div className={`bg-gradient-to-br from-teal-500/20 via-emerald-500/10 to-cyan-500/20 border border-teal-700 h-full ${className}`}>
      <div className="bg-slate-800/30 backdrop-blur-sm h-full">
        <Card className="h-full bg-black/80 backdrop-blur-xl border-0 overflow-hidden flex flex-col p-0 gap-0">
          {children}
        </Card>
      </div>
    </div>
  );
}