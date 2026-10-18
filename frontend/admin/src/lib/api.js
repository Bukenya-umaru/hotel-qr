export const API_BASE_URL = (import.meta.env?.VITE_API_URL || '').replace(/\/+$/, '')
const API_REQUEST_BASE_URL = import.meta.env?.DEV ? API_BASE_URL : ''

export function apiAssetUrl(path) {
  if (!path?.startsWith('/') || path.startsWith('//')) return path
  if (API_BASE_URL) return `${API_BASE_URL}${path}`
  return import.meta.env?.DEV ? path : `/api/proxy${path}`
}

async function readResponse(response) {
  if (response.status === 204) return null

  const contentType = response.headers.get('content-type')
  const body = await response.text()
  if (!body) return null

  if (contentType && contentType.includes('application/json')) {
    try {
      return JSON.parse(body)
    } catch {
      // Fall through to error if JSON is malformed
    }
  }

  const error = new Error(
    `The server returned an invalid response (HTTP ${response.status}). This often happens when the API is down or returning an HTML error page. Please try again later.`,
  )
  error.status = response.status
  // Log the body to the console in development/staging to help debug the HTML error
  if (import.meta.env?.DEV) console.error('Invalid API response body:', body)
  throw error
}

export async function api(path, options = {}, retries = 2) {
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

  try {
    const data = await readResponse(response)
    if (!response.ok) {
      const error = new Error(data?.message || 'Something went wrong. Please try again.')
      error.status = response.status
      throw error
    }
    return data
  } catch (error) {
    // If we get an "invalid response" (HTML instead of JSON) and have retries left, try again.
    // This handles Render "cold starts" where the first request might return a loading page.
    if (retries > 0 && (error.message.includes('invalid response') || response.status === 502 || response.status === 503)) {
      console.log(`Invalid response received. Retrying... (${retries} attempts left)`)
      // Wait 2 seconds before retrying to give the server time to wake up
      await new Promise(resolve => setTimeout(resolve, 2000))
      return api(path, options, retries - 1)
    }
    throw error
  }
}
