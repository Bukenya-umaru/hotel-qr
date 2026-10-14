import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { InstallPrompt } from './components/InstallPrompt/InstallPrompt.jsx'
import './styles.css'

// Enable PWA installability: a passthrough service worker registered from the
// earliest moment the page can afford one (after load, so it never competes
// with first paint). No-ops silently on unsupported or non-secure origins.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* the app stays fully functional without the worker */ })
  })
}

// The install popup lives outside <App/> because App short-circuits to the
// login screen while signed out — the popup must exist on that first screen.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <InstallPrompt />
  </React.StrictMode>,
)
