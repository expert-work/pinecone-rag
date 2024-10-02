// Full path: /app/error.tsx
'use client'

import { ErrorProps } from 'next/error'

export const dynamic = 'force-static'

export default function Error({  }: ErrorProps) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button>Try again</button>
    </div>
  )
}