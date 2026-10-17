import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './assets/main.css'
import App from './App'
import { PreferencesProvider } from './preferences'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PreferencesProvider>
      <App />
    </PreferencesProvider>
  </StrictMode>
)
