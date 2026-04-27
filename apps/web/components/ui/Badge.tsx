import { clsx } from 'clsx'

type BadgeVariant =
  | 'sun'
  | 'likely-sun'
  | 'shade'
  | 'unknown'
  | 'confirmed'
  | 'inferred'
  | 'open'
  | 'closed'
  | 'neutral'
  | 'pending'
  | 'approved'
  | 'rejected'

interface BadgeProps {
  variant: BadgeVariant
  label: string
  icon?: string
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  sun: 'bg-amber-100 text-amber-800 border border-amber-200',
  'likely-sun': 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  shade: 'bg-slate-100 text-slate-600 border border-slate-200',
  unknown: 'bg-stone-100 text-stone-500 border border-stone-200',
  confirmed: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  inferred: 'bg-blue-50 text-blue-600 border border-blue-200',
  open: 'bg-green-100 text-green-700 border border-green-200',
  closed: 'bg-red-50 text-red-600 border border-red-200',
  neutral: 'bg-stone-100 text-stone-600 border border-stone-200',
  pending: 'bg-orange-100 text-orange-700 border border-orange-200',
  approved: 'bg-green-100 text-green-700 border border-green-200',
  rejected: 'bg-red-100 text-red-600 border border-red-200',
}

export function Badge({ variant, label, icon, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
    >
      {icon && <span>{icon}</span>}
      {label}
    </span>
  )
}
