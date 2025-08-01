import React from 'react';
import { Loader2 } from 'lucide-react';
import { CardContent } from '@/components/ui/card';

interface DocsLoaderProps {
  message?: string;
}

export function DocsLoader({ message = 'Loading documentation...' }: DocsLoaderProps) {
  return (
    <CardContent className="flex items-center justify-center py-16">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>{message}</span>
      </div>
    </CardContent>
  );
}