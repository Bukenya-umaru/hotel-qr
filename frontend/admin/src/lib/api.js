import { io } from 'socket.io-client'

export const API_BASE_URL = (import.meta.env?.VITE_API_URL || '').replace(/\/+$/, '')

export const SOCKET_URL = API_BASE_URL
export const SOCKET_FALLBACK_URLS = API_BASE_URL && API_BASE_URL !== '' ? [API_BASE_URL] : []

export function connectSocket(candidates = [SOCKET_URL || undefined, ...SOCKET_FALLBACK_URLS]) {
  const urls = [...new Set(candidates.filter(url => url !== undefined && url !== ''))]
  if (urls.length === 0) urls.push(undefined)
  let socket = io(urls[0], { withCredentials: true, reconnectionDelayMax: 5000 })
  socket.on('connect_error', function retry() {
    socket.off('connect_error', retry)
    if (urls.length <= 1) return
    socket.disconnect()
    urls.shift()
    socket = io(urls[0], { withCredentials: true, reconnectionDelayMax: 5000 })
  })
  return socket
}

export function apiAssetUrl(path) {
  return path
}

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

  const requestUrl = path.startsWith('/api') ? path : `/api${path}`

  pendingRequests += 1
  notifyLoadListeners()

  let response
  try {
    response = await fetch(requestUrl, { credentials: 'include', ...options, headers })
  } catch (error) {
    // fetch only rejects with TypeError when the request never reached the server.
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
    if (error.network === true) reportNetworkFailure()
    throw error
  } finally {
    pendingRequests -= 1
    notifyLoadListeners()
  }
}
