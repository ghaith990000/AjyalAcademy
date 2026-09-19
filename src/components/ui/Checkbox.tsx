import { Check } from 'lucide-react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import { useId, type ComponentProps, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    // The button is 44px (a phone tap target) and the 24px box is drawn inside it; the negative margin keeps the
    // surrounding layout as if it were 24px.
    <CheckboxPrimitive.Root
      className={cn(
        'group -m-2.5 flex size-11 shrink-0 items-center justify-center rounded-full disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="flex size-6 items-center justify-center rounded-md border-2 border-ink-muted/60 bg-surface text-white transition-colors group-data-[state=checked]:border-brand-blue group-data-[state=checked]:bg-brand-blue">
        <CheckboxPrimitive.Indicator>
          <Check className="size-4" strokeWidth={3} aria-hidden />
        </CheckboxPrimitive.Indicator>
      </span>
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
