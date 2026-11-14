import { LoaderCircle } from 'lucide-react'

interface LoadingProps {
  label?: string
}

export function Loading({ label = 'Loading' }: LoadingProps) {
  return (
    <div className="state-message" role="status" aria-live="polite">
      <LoaderCircle className="state-message__icon spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
