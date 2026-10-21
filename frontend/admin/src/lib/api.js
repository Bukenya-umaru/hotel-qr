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

// ---- Section load signal ----
// Sections fetch their own data, so the loading gate watches the API requests
// they start. A pending request keeps the skeleton up until the data is ready
// (no empty page in between), and a request that never reached the server is
// counted so the section can keep loading while the connection is down.
let pendingRequests = 0
let networkFailures = 0
const loadListeners = new Set()

const notifyLoadListeners = () => {
  const snapshot = { pending: pendingRequests, networkFailures }
  for (const listener of loadListeners) listener(snapshot)
}

const reportNetworkFailure = () => {
  networkFailures += 1
}

export const loadSnapshot = () => ({ pending: pendingRequests, networkFailures })

export function subscribeLoads(listener) {
  loadListeners.add(listener)
  return () => { loadListeners.delete(listener) }
}

// Errors are read by the person using the dashboard, so they talk about the
// internet connection they can fix — never about servers, APIs or proxies.
const internetMessage = () => (typeof navigator !== 'undefined' && navigator.onLine === false
  ? "You're offline. Connect to the internet and try again."
  : "Can't connect right now. Check your internet connection and try again.")

async function readResponse(response) {
  if (response.status === 204) return null

  const body = await response.text()
  if (!body) return null

  try {
    return JSON.parse(body)
  } catch {
    const error = new Error('Something went wrong while loading this. Please try again.')
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

  pendingRequests += 1
  notifyLoadListeners()

  let response
  try {
    response = await fetch(requestUrl, { credentials: 'include', ...options, headers })
  } catch (error) {
    // A TypeError here means the request never reached anyone — the device
    // has no working internet connection, not that the app is broken.
    if (error instanceof TypeError) {
      reportNetworkFailure()
      pendingRequests -= 1
      notifyLoadListeners()
      const offline = new Error(internetMessage())
      offline.network = true
      throw offline
    }
    pendingRequests -= 1
    notifyLoadListeners()
    throw error
  }

  try {
    const data = await readResponse(response)
    if (!response.ok) {
      const error = new Error(data?.message || 'Something went wrong. Please try again.')
      error.status = response.status
      error.network = [502, 503, 504].includes(response.status)
      throw error
    }
    return data
  } catch (error) {
    if (retries > 0 && (error.message.includes('invalid response') || response.status === 502 || response.status === 503)) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      return api(path, options, retries - 1)
    }
    // A retried request reports its own outcome, so the outer attempt stays quiet.
    if (error.network === true) reportNetworkFailure()
    throw error
  } finally {
    pendingRequests -= 1
    notifyLoadListeners()
  }
}
