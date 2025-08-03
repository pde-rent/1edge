import React from 'react';
import { cn } from '@/lib/utils';

interface SimpleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'filled' | 'bordered';
  size?: 's' | 'm' | 'l';
  children: React.ReactNode;
}

export const SimpleButton = React.forwardRef<HTMLButtonElement, SimpleButtonProps>(
  ({ className, variant = 'primary', size = 'm', children, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
    
    const variantStyles = {
      primary: "bg-[#4fd1c5] text-black shadow-[0_0_30px_rgba(79,209,197,0.3)] hover:bg-[#4fd1c5]/90 hover:shadow-[0_0_40px_rgba(79,209,197,0.5)] hover:scale-105",
      filled: "bg-slate-800 text-[#4fd1c5] shadow-sm hover:bg-slate-700 hover:shadow-md hover:scale-[1.02]",
      bordered: "border-2 border-[#4fd1c5]/30 bg-transparent text-white hover:border-[#4fd1c5] hover:bg-[#4fd1c5]/5 hover:scale-105"
    };
    
    const sizeStyles = {
      s: "h-7 text-xs px-2.5",
      m: "h-9 text-sm px-4 py-2", 
      l: "h-11 text-base px-6 py-3"
    };

    return (
      <button
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    );
  }
);

SimpleButton.displayName = "SimpleButton";