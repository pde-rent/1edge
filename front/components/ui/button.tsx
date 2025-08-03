import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive rounded-xl cursor-pointer",
  {
    variants: {
      variant: {
        // Primary variant - bright cyan background like "Launch App" button
        primary:
          "!bg-primary !text-black shadow-[0_0_30px_rgba(79,209,197,0.3)] hover:!bg-primary/90 hover:shadow-[0_0_40px_rgba(79,209,197,0.5)] hover:scale-105 transition-all duration-300",
        // Filled variant - dark background with cyan text like navbar "App" button  
        filled:
          "bg-slate-800 text-primary shadow-sm hover:bg-slate-700 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
        // Bordered variant - outline style like "Docs" button
        bordered:
          "border-2 border-primary/30 bg-transparent text-white hover:border-primary hover:bg-primary/5 hover:scale-105 transition-all duration-300",
        // Legacy variants for compatibility
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] border border-primary/20",
        destructive:
          "bg-destructive text-white shadow-sm hover:bg-destructive/90 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border-2 border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground hover:shadow-md hover:scale-[1.02] active:scale-[0.98] dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
        ghost:
          "hover:bg-accent hover:text-accent-foreground hover:scale-[1.02] active:scale-[0.98] dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline hover:scale-[1.02] active:scale-[0.98]",
      },
      size: {
        s: "h-7 text-xs px-2.5 has-[>svg]:px-2 gap-1.5",
        m: "h-9 text-sm px-4 py-2 has-[>svg]:px-3 gap-2",
        l: "h-11 text-base px-6 py-3 has-[>svg]:px-5 gap-2.5",
        // Legacy sizes for compatibility
        sm: "h-7 text-xs px-2.5 has-[>svg]:px-2 gap-1.5",
        default: "h-9 text-sm px-4 py-2 has-[>svg]:px-3 gap-2",
        lg: "h-11 text-base px-6 py-3 has-[>svg]:px-5 gap-2.5",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "m",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
