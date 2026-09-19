import { Switch as SwitchPrimitive } from 'radix-ui'
import { useId, type ComponentProps, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'relative h-7 w-12 shrink-0 rounded-full bg-ink-muted/40 transition-colors data-[state=checked]:bg-brand-blue disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {/* Logical inset + a mirrored translate keep the thumb travelling the right way in RTL. */}
      <SwitchPrimitive.Thumb className="absolute start-0.5 top-0.5 block size-6 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-5 rtl:data-[state=checked]:-translate-x-5" />
    </SwitchPrimitive.Root>
  )
}

/** Switch with a full-width 44px+ tappable label row. */
export function SwitchField({
  label,
  hint,
  ...props
}: ComponentProps<typeof SwitchPrimitive.Root> & { label: ReactNode; hint?: ReactNode }) {
  const id = useId()
  return (
    <div className="flex min-h-11 items-center justify-between gap-4">
      <label htmlFor={id} className="flex-1 cursor-pointer">
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-[13px] text-ink-muted">{hint}</span>}
      </label>
      <Switch id={id} {...props} />
    </div>
  )
}
