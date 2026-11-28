import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { applyDensity, loadDensity } from '@/lib/density'
import { applyUiZoom, getUiZoom } from '@/lib/ui-zoom'
import App from './App.tsx'

applyDensity(loadDensity())
void applyUiZoom(getUiZoom())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
