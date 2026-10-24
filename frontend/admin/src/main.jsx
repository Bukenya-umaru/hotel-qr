import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { InstallPrompt } from './components/InstallPrompt/InstallPrompt.jsx'
import './styles.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <InstallPrompt />
  </React.StrictMode>,
)
