import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'

import { AppShell } from '@/components/app-shell'
import { AppUpdate } from '@/components/app-update'
import { DesktopGuard, DesktopProvider } from '@/components/desktop-gate'
import { KeptReports } from '@/components/kept-reports'
import { Toaster } from '@/components/ui/sonner'
import { UiZoomController } from '@/components/ui-zoom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/components/theme-provider'
import { WarmMainWindow } from '@/components/warm-main-window'
import { I18nProvider } from '@/i18n'
import { AccountDisplayProvider } from '@/lib/account-display'
import { TimeFilterProvider } from '@/lib/time-context'
const Settings = lazy(() =>
  import('@/pages/Settings').then((m) => ({ default: m.Settings })),
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system">
        <I18nProvider>
          <AccountDisplayProvider>
          <WarmMainWindow />
          <UiZoomController />
          <AppUpdate>
          <TimeFilterProvider>
            <TooltipProvider>
              <DesktopProvider>
                <BrowserRouter>
                  <AppShell>
                    <DesktopGuard>
                      <KeptReports />
                      <Routes>
                        <Route
                          path="/settings"
                          element={
                            <Suspense fallback={<div className="h-64" aria-hidden />}>
                              <Settings />
                            </Suspense>
                          }
                        />
                      </Routes>
                    </DesktopGuard>
                  </AppShell>
                </BrowserRouter>
                <Toaster position="bottom-right" />
              </DesktopProvider>
            </TooltipProvider>
          </TimeFilterProvider>
          </AppUpdate>
          </AccountDisplayProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
