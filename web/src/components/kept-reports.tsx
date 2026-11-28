import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'

import { REPORT_PAGES } from '@/app-pages'
import { useDesktop } from '@/components/desktop-gate'

export function KeptReports() {
  const desktop = useDesktop()
  const { pathname } = useLocation()
  const [visited, setVisited] = useState<Set<string>>(() => new Set([pathname]))

  useEffect(() => {
    setVisited((previous) => {
      if (previous.has(pathname)) return previous
      const next = new Set(previous)
      next.add(pathname)
      return next
    })
  }, [pathname])

  if (desktop.status !== 'ready') return null

  return (
    <>
      {REPORT_PAGES.filter(({ path }) => path === pathname || visited.has(path)).map(
        ({ path, Page }) => (
          <div key={path} hidden={pathname !== path}>
            <Page />
          </div>
        ),
      )}
    </>
  )
}
