import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { controlClass } from './Input'

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  // dir="auto" lets a mixed Arabic/English note align itself by its first strong character.
  return (
    <textarea dir="auto" className={cn(controlClass, 'min-h-24 py-2.5', className)} {...props} />
  )
}
