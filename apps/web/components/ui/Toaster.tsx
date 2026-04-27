'use client'

import { createContext, useContext, useState, useCallback, useRef } from 'react'
import * as RadixToast from '@radix-ui/react-toast'
import { clsx } from 'clsx'

type ToastVariant = 'success' | 'error' | 'info'

interface Toast {
  id: string
  title: string
  description?: string
  variant: ToastVariant
}

interface ToastContextValue {
  toast: (opts: { title: string; description?: string; variant?: ToastVariant }) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a Toaster provider')
  return ctx
}

const variantStyles: Record<ToastVariant, string> = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  error: 'bg-red-50 border-red-200 text-red-900',
  info: 'bg-blue-50 border-blue-200 text-blue-900',
}

const variantIcons: Record<ToastVariant, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
}

const variantIconStyles: Record<ToastVariant, string> = {
  success: 'bg-emerald-500 text-white',
  error: 'bg-red-500 text-white',
  info: 'bg-blue-500 text-white',
}

export function Toaster({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)

  const toast = useCallback(
    ({
      title,
      description,
      variant = 'info',
    }: {
      title: string
      description?: string
      variant?: ToastVariant
    }) => {
      const id = String(++idRef.current)
      setToasts((prev) => [...prev, { id, title, description, variant }])
    },
    [],
  )

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      <RadixToast.Provider swipeDirection="right" duration={4000}>
        {children}

        {toasts.map((t) => (
          <RadixToast.Root
            key={t.id}
            className={clsx(
              'flex items-start gap-3 rounded-xl border p-4 shadow-lg',
              'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-4',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-80',
              'transition-all duration-200 w-[360px] max-w-[calc(100vw-2rem)]',
              variantStyles[t.variant],
            )}
            onOpenChange={(open) => {
              if (!open) remove(t.id)
            }}
          >
            <div
              className={clsx(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                variantIconStyles[t.variant],
              )}
            >
              {variantIcons[t.variant]}
            </div>

            <div className="flex-1 min-w-0">
              <RadixToast.Title className="text-sm font-semibold leading-tight">
                {t.title}
              </RadixToast.Title>
              {t.description && (
                <RadixToast.Description className="mt-0.5 text-xs opacity-80">
                  {t.description}
                </RadixToast.Description>
              )}
            </div>

            <RadixToast.Close className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100 transition-opacity text-xs">
              ✕
            </RadixToast.Close>
          </RadixToast.Root>
        ))}

        <RadixToast.Viewport className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 outline-none" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  )
}
