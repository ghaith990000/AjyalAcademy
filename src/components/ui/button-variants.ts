import { cva } from 'class-variance-authority'

export const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 rounded-control font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand-blue text-white hover:bg-brand-blue-600 active:bg-brand-blue-600',
        accent: 'bg-brand-pink text-white hover:brightness-95 active:brightness-90',
        secondary: 'border border-line bg-surface text-brand-blue hover:bg-brand-blue-50',
        ghost: 'text-brand-blue hover:bg-brand-blue-50',
        danger: 'bg-danger text-white hover:brightness-90 active:brightness-85',
      },
      size: {
        md: 'min-h-11 px-5 text-[15px]',
        lg: 'min-h-12 px-6 text-base',
        icon: 'size-11',
      },
      fullWidth: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)
