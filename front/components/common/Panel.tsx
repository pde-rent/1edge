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
    <div className={`border border-primary/50 h-full ${className}`}>
      <div className="bg-background/80 backdrop-blur-sm h-full">
        <Card className="h-full bg-transparent border-0 overflow-hidden flex flex-col p-0 gap-0">
          {children}
        </Card>
      </div>
    </div>
  );
}