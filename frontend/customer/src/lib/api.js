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
      throw new Error(`The server returned a webpage instead of menu or order data. Check that the backend is running and VITE_API_URL points to it${API_BASE_URL ? ` (${API_BASE_URL})` : ''}.`)
    }
    throw new Error('The server returned an invalid response. Please try again.')
  }
}

export async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    })
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Unable to reach the ordering service. Check that the backend is running and try again.')
    }
    throw error
  }
  const body = await readResponse(response)
  if (!response.ok) throw new Error(body?.message || 'Unable to complete your request.')
  return body
}
