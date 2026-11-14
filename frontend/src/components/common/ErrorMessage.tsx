import { CircleAlert } from 'lucide-react'

interface ErrorMessageProps {
  title?: string
  message: string
}

export function ErrorMessage({
  title = 'Something went wrong',
  message,
}: ErrorMessageProps) {
  return (
    <div className="error-message" role="alert">
      <CircleAlert aria-hidden="true" size={20} />
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
    </div>
  )
}
