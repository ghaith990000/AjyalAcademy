import { Check } from 'lucide-react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import { useId, type ComponentProps, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-md border-2 border-ink-muted/60 bg-surface text-white transition-colors data-[state=checked]:border-brand-blue data-[state=checked]:bg-brand-blue disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="size-4" strokeWidth={3} aria-hidden />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

/** Checkbox with a full-width 44px+ tappable label row. */
export function CheckboxField({
  label,
  hint,
  ...props
}: ComponentProps<typeof CheckboxPrimitive.Root> & { label: ReactNode; hint?: ReactNode }) {
  const id = useId()
  return (
    <div className="flex min-h-11 items-center gap-3">
      <Checkbox id={id} {...props} />
      <label htmlFor={id} className="flex-1 cursor-pointer">
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-[13px] text-ink-muted">{hint}</span>}
      </label>
    </div>
  )
}
