import React from 'react'
import ReactDOM from 'react-dom/client'
import CustomerApp from './CustomerApp.jsx'
import './styles.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><CustomerApp /></React.StrictMode>,
)
