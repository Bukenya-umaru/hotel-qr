import { io } from 'socket.io-client'

export const API_BASE_URL = (import.meta.env?.VITE_API_URL || '').replace(/\/+$/, '')

// Sockets connect same-origin ('', proxied by the host — Netlify/Vercel) in
// production so the HttpOnly session cookie travels on the handshake and the
// backend can identify the socket without cross-origin cookie rules. In dev,
// Vite proxies /socket.io to the backend via VITE_API_URL. Some serverless
// hosts (Vercel) can't stream Socket.IO's HTTP handshake through their
// functions; SOCKET_FALLBACK_URLS lets the caller retry direct against the
// Render origin (API_BASE_URL), whose cookie is SameSite=None once secure.
export const SOCKET_URL = API_BASE_URL
export const SOCKET_FALLBACK_URLS = API_BASE_URL && API_BASE_URL !== '' ? [API_BASE_URL] : []

// Connects the screen's socket first same-origin, then (on hosts that can't
// stream Socket.IO's handshake, e.g. Vercel serverless) retries direct
// against the Render origin. Shared by every page that displays live data.
export function connectSocket(candidates = [SOCKET_URL || undefined, ...SOCKET_FALLBACK_URLS]) {
  const urls = [...new Set(candidates.filter(url => url !== undefined && url !== ''))]
  if (urls.length === 0) urls.push(undefined)
  let socket = io(urls[0], { withCredentials: true, reconnectionDelayMax: 5000 })
  socket.on('connect_error', function retry() {
    socket.off('connect_error', retry)
    if (urls.length <= 1) return // stay on the only candidate; io retries itself
    socket.disconnect()
    urls.shift()
    socket = io(urls[0], { withCredentials: true, reconnectionDelayMax: 5000 })
  })
  return socket
}

export function apiAssetUrl(path) {
  // Upload images always load same-origin: in dev Vite proxies /uploads/ to
  // the backend, in production the host (Netlify/Vercel config) proxies it —
  // keeping requests and the SameSite=Lax session cookie confined to the
  // dashboard's own domain.
  return path
}

async function readResponse(response) {
  if (response.status === 204) return null

  const body = await response.text()
  if (!body) return null

  try {
    return JSON.parse(body)
  } catch {
    const error = new Error(
      `The API returned an unexpected response (HTTP ${response.status}). The request may not be reaching an API proxy; try again later or contact the site administrator.`,
    )
    error.status = response.status
    throw error
  }
}

export async function api(path, options = {}, retries = 2) {
  const isForm = options.body instanceof FormData
  const headers = {
    ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers,
  }

  // In production, Netlify uses the _redirects file to send /api requests to Render.
  // We ensure the path starts with /api to match the redirect rule.
  const requestUrl = path.startsWith('/api') ? path : `/api${path}`

  let response
  try {
    response = await fetch(requestUrl, { credentials: 'include', ...options, headers })
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Unable to reach the server. Check that the backend is running and try again.')
    }
    throw error
  }

  try {
    const data = await readResponse(response)
    if (!response.ok) {
      const error = new Error(data?.message || 'Something went wrong. Please try again.')
      error.status = response.status
      throw error
    }
    return data
  } catch (error) {
    if (retries > 0 && (error.message.includes('invalid response') || response.status === 502 || response.status === 503)) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      return api(path, options, retries - 1)
    }
    throw error
  }
}
