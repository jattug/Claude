import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { indexedDbAvailable } from './storage-check'
import './styles.css'

const root = createRoot(document.getElementById('root')!)

function StorageBlocked({ reason }: { reason: string }) {
  return (
    <div style={{ maxWidth: 560, margin: '12vh auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: 22, marginBottom: 10 }}>Forge cannot reach local storage</h1>
      <p style={{ color: 'var(--text-secondary, #52514e)', lineHeight: 1.6 }}>{reason}</p>
      <p style={{ color: 'var(--text-secondary, #52514e)', lineHeight: 1.6 }}>
        Your journal is kept in this browser and never sent anywhere, so Forge needs storage
        access to work at all. Open this page in a normal window, or allow site data for it,
        and reload.
      </p>
    </div>
  )
}

/**
 * Forge stores everything locally, so if the browser will not give us storage
 * there is no app to show — say so plainly rather than hanging on a spinner.
 */
void indexedDbAvailable().then((storage) => {
  if (storage !== true) {
    root.render(<StorageBlocked reason={storage} />)
    return
  }
  root.render(
    <React.StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </React.StrictMode>,
  )
})
