import * as React from "react"
import { cn } from "../../lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink transition-colors",
          "placeholder:text-ink-subtle hover:border-line-strong",
          "focus-visible:border-brand-600 focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60",
          "aria-[invalid=true]:border-due-fg",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
