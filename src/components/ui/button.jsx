import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full text-xs font-semibold leading-none text-[#111827] transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827] focus-visible:ring-offset-2 active:translate-y-0 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-[#f1f3f4] text-[#111827] hover:bg-[#e5e7eb]",
        destructive:
          "border border-transparent bg-[#f1f3f4] text-[#dc2626] hover:bg-[#e5e7eb]",
        outline:
          "border border-transparent bg-[#f1f3f4] text-[#111827] hover:bg-[#e5e7eb]",
        secondary:
          "border border-transparent bg-[#f1f3f4] text-[#111827] hover:bg-[#e5e7eb]",
        ghost: "border border-transparent bg-transparent text-[#111827] hover:bg-[#f1f3f4]",
        link: "h-auto rounded-none bg-transparent px-0 text-[#111827] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[25px] px-2.5",
        sm: "h-[25px] px-2.5",
        lg: "h-[25px] px-2.5",
        icon: "h-[25px] w-[25px] rounded-full p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    (<Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />)
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
