import * as React from "react"
import { cn } from "../../lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive" | "subtle";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-semibold",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-brand-700 text-ink-inverted shadow-card hover:bg-brand-800": variant === "default",
            "border border-line-strong bg-surface text-ink hover:bg-surface-muted": variant === "outline",
            "text-ink-muted hover:bg-surface-muted hover:text-ink": variant === "ghost",
            "bg-brand-50 text-brand-800 hover:bg-brand-100": variant === "subtle",
            "bg-due-fg text-ink-inverted shadow-card hover:brightness-110": variant === "destructive",
            // 44px minimum touch target on the default and large sizes.
            "h-11 px-4 text-sm": size === "default",
            "h-9 px-3 text-xs": size === "sm",
            "h-12 px-6 text-base": size === "lg",
            "h-11 w-11": size === "icon",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
