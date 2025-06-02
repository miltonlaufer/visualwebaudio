import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from '~/components/ErrorBoundary'
import { scan } from 'react-scan'

if (!import.meta.env.PROD) {
  scan({
    enabled: true,
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
