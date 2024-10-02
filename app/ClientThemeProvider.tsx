// Full path: /app/ClientThemeProvider.tsx
'use client'

import { ReactNode, useEffect, useState } from 'react'

export function ClientThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<string>('light')

  useEffect(() => {
    // Read theme from cookie here
    const cookieTheme = document.cookie
      .split('; ')
      .find(row => row.startsWith('theme='))
      ?.split('=')[1]
    if (cookieTheme) {
      setTheme(cookieTheme)
    }
  }, [])

  return <div data-theme={theme}>{children}</div>
}