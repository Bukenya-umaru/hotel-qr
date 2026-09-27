export const API_BASE_URL = (import.meta.env?.VITE_API_URL || '').replace(/\/+$/, '')

export function apiAssetUrl(path) {
  return API_BASE_URL && path?.startsWith('/') && !path.startsWith('//')
    ? `${API_BASE_URL}${path}`
    : path
}

async function readResponse(response) {
  if (response.status === 204) return null

  const body = await response.text()
  if (!body) return null

  try {
    return JSON.parse(body)
  } catch {
    if (body.trimStart().startsWith('<')) {
      throw new Error(`The server returned a webpage instead of API data. Check that the backend is running and VITE_API_URL points to it${API_BASE_URL ? ` (${API_BASE_URL})` : ''}.`)
    }
    throw new Error('The server returned an invalid response. Please try again.')
  }
}

export async function api(path, options = {}) {
  const isForm = options.body instanceof FormData
  const headers = {
    ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers,
  }
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { credentials: 'include', ...options, headers })
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Unable to reach the server. Check that the backend is running and try again.')
    }
    throw error
  }
  const data = await readResponse(response)
  if (!response.ok) throw new Error(data?.message || 'Something went wrong. Please try again.')
  return data
}
