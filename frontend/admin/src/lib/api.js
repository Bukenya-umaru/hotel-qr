export const API_BASE_URL = (import.meta.env?.VITE_API_URL || '').replace(/\/+$/, '')
const API_REQUEST_BASE_URL = import.meta.env?.DEV ? API_BASE_URL : ''

export function apiAssetUrl(path) {
  if (!path?.startsWith('/') || path.startsWith('//')) return path
  if (API_BASE_URL) return `${API_BASE_URL}${path}`
  return import.meta.env?.DEV ? path : `/api/proxy${path}`
}

async function readResponse(response) {
  if (response.status === 204) return null

  const body = await response.text()
  if (!body) return null

  try {
    return JSON.parse(body)
  } catch {
    const error = new Error(
      `The API returned an unexpected response (HTTP ${response.status}). The request may not be reaching an API route; try again later or contact the site administrator.`,
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
  const requestUrl = import.meta.env?.DEV
    ? `${API_REQUEST_BASE_URL}${path}`
    : `/api/proxy?path=${encodeURIComponent(path)}`
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
