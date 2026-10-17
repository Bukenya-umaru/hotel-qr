import { LoaderCircle } from 'lucide-react'

export function ActionProgress({ children, className = '' }) {
  return <span role="status" aria-live="polite" className={`inline-flex items-center gap-1.5 ${className}`}>
    <LoaderCircle aria-hidden="true" size={13} className="shrink-0 animate-spin" />
    {children}
  </span>
}
