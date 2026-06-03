import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

export const TooltipProvider = TooltipPrimitive.Provider;
export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          // Layout + theme
          'z-50 max-w-xs rounded-md border border-white/10 bg-zinc-900 px-3 py-2 shadow-lg',
          // Typography — preserve newlines from string labels, allow word wrap
          'text-xs leading-snug text-white whitespace-pre-line break-words',
          // Animation
          'animate-in fade-in-0 zoom-in-95',
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}

/**
 * Convenience wrapper. Accepts either a string (multi-line via `\n`)
 * or arbitrary JSX for richer tooltips.
 */
export function Tooltip({
  label,
  children,
  side,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  return (
    <TooltipRoot delayDuration={300}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side ?? 'left'}>{label}</TooltipContent>
    </TooltipRoot>
  );
}
