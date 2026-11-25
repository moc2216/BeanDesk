import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { applyDensity, loadDensity } from '@/lib/density'
import App from './App.tsx'

applyDensity(loadDensity())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
