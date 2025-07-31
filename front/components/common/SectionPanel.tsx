import React from 'react';
import { THEME } from '@common/constants';

interface SectionPanelProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

/**
 * Shared section panel component that applies consistent app styling
 * to different sections like sidebar, content, and TOC.
 * Reuses the same gradient and border styling as the main app panels.
 */
export function SectionPanel({ children, className = "", title }: SectionPanelProps) {
  return (
    <div className={`bg-background border border-primary/50 rounded-lg ${className}`}>
      <div className="bg-card backdrop-blur-sm rounded-lg">
        <div className="bg-background/80 backdrop-blur-xl border-0 rounded-lg p-4">
          {title && (
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4">
              {title}
            </h2>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}