import type { PropsWithChildren } from 'react'
import { cn } from '../../utils/cn'

interface PageContainerProps extends PropsWithChildren {
  className?: string
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn('page-container', className)}>
      {children}
    </div>
  )
}
