export const API_BASE_URL = (import.meta.env?.VITE_API_URL || '').replace(/\/+$/, '')

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

export async function api(path, options = {}) {
  const isForm = options.body instanceof FormData
  const headers = {
    ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers,
  }
  // Dev calls the backend through Vite's proxy; production calls the same
  // paths on the dashboard's own origin, where the host proxies to the API.
  const requestUrl = path
  let response
  try {
    response = await fetch(requestUrl, { credentials: 'include', ...options, headers })
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Unable to reach the server. Check that the backend is running and try again.')
    }
    throw error
  }
  const data = await readResponse(response)
  if (!response.ok) {
    const error = new Error(data?.message || 'Something went wrong. Please try again.')
    error.status = response.status
    throw error
  }
  return data
}
