import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastOptions {
  /** Already-translated text. */
  title: string
  description?: string
  tone?: ToastTone
}

export const ToastContext = createContext<((options: ToastOptions) => void) | null>(null)

/** `const toast = useToast(); toast({ title: t('players:saved'), tone: 'success' })` */
export function useToast(): (options: ToastOptions) => void {
  const toast = useContext(ToastContext)
  if (!toast) throw new Error('useToast must be used inside <ToastProvider>')
  return toast
}
