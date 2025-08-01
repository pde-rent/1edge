import React from 'react';
import { createPortal } from 'react-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  titleIcon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  maxHeight?: string;
  className?: string;
  contentClassName?: string;
  showCloseButton?: boolean;
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md', 
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
};

export function BaseModal({
  isOpen,
  onClose,
  title,
  titleIcon,
  children,
  footer,
  maxWidth = '2xl',
  maxHeight = '90vh',
  className,
  contentClassName,
  showCloseButton = true,
}: BaseModalProps) {
  // Handle ESC key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-center p-4"
      onClick={onClose}
    >
      <Card
        className={cn(
          'w-full bg-background/95 border-primary/50 shadow-2xl rounded-xl overflow-hidden',
          maxWidthClasses[maxWidth],
          className
        )}
        style={{ maxHeight }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || titleIcon || showCloseButton) && (
          <div className="flex items-center justify-between border-b border-primary/50 px-6 py-4 flex-shrink-0">
            {(title || titleIcon) && (
              <div className="flex items-center gap-3">
                {titleIcon}
                {title && (
                  <h2 className="text-xl font-bold text-primary">
                    {title}
                  </h2>
                )}
              </div>
            )}
            {showCloseButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}

        {/* Content */}
        <div 
          className={cn(
            'flex-1 overflow-hidden',
            footer && 'border-b border-primary/50',
            contentClassName
          )}
          style={{ 
            maxHeight: title || footer ? 'calc(90vh - 120px)' : 'calc(90vh - 24px)'
          }}
        >
          <ScrollArea className="h-full">
            <div className="p-6">
              {children}
            </div>
          </ScrollArea>
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex justify-end gap-3 px-6 py-4 flex-shrink-0 bg-background/50">
            {footer}
          </div>
        )}
      </Card>
    </div>
  );

  return createPortal(modalContent, document.body);
}

// Reusable content sections that follow the same styling patterns
export function ModalSection({ 
  title, 
  icon, 
  children, 
  className 
}: { 
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-4', className)}>
      {(title || icon) && (
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          {icon}
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

export function ModalInfoBox({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-muted/10 p-4 rounded-lg border border-muted/20', className)}>
      {children}
    </div>
  );
}

export function ModalKeyValue({ 
  label, 
  value, 
  className 
}: { 
  label: string; 
  value: React.ReactNode; 
  className?: string;
}) {
  return (
    <div className={cn('flex justify-between py-2 border-b border-muted/20', className)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-mono text-foreground">{value}</span>
    </div>
  );
}