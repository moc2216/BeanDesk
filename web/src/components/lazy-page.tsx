import { lazy, Suspense, type ComponentType } from 'react'

/** Keep route chunks out of the first paint while preserving each page's state. */
export function lazyPage(load: () => Promise<{ default: ComponentType }>): ComponentType {
  const Page = lazy(load)
  return function LazyPage() {
    return (
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Page />
      </Suspense>
    )
  }
}
